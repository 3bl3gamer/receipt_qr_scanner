import { $, $in, cloneNodeDeep, onError, searchBinary } from './utils'

/**
 * @typedef {{
 *   fiscalNum: string,
 *   fiscalDoc: string,
 *   fiscalSign: string,
 *   kind: string,
 *   summ: string,
 *   createdAt: string,
 * }} ReceiptRef
 */

/**
 * @typedef {{
 *   id: number,
 *   savedAt: string,
 *   updatedAt: string,
 *   ref: ReceiptRef,
 *   isCorrect: boolean,
 *   refText: string,
 *   data: string,
 *   retriesLeft: number,
 *   nextRetryAt: string,
 * }} Receipt
 */

/** @typedef {'id'|'created_at'} SortMode */

/**
 * @param {(receipts:Receipt[]) => unknown} onChunk
 */
function ReceiptsLoader(onChunk) {
	this.receiptSource = /** @type {EventSource|null} */ (null)
	this.isWaitingInitialReceipts = false
	this.isLoadingChunk = false
	this.hasFullyLoaded = false
	this.abortController = new AbortController()
	this.onChunk = onChunk
}
ReceiptsLoader.prototype.canPreload = function () {
	return !this.isWaitingInitialReceipts && !this.isLoadingChunk && !this.hasFullyLoaded
}
/**
 * @param {SortMode} sortMode
 * @param {string} searchQuery
 */
ReceiptsLoader.prototype.reopen = function (sortMode, searchQuery) {
	this.isWaitingInitialReceipts = true
	this.hasFullyLoaded = false

	if (this.receiptSource !== null) this.receiptSource.close()

	let path = `./api/receipts_list?sse=1&sort_mode=${sortMode}&search=${encodeURIComponent(searchQuery)}`

	this.receiptSource = new EventSource(path)
	this.receiptSource.addEventListener('initial_receipts', event => {
		this.isWaitingInitialReceipts = false
		this.onChunk(JSON.parse(/**@type {*}*/ (event).data))
	})
	this.receiptSource.addEventListener('receipt', event => {
		this.onChunk([JSON.parse(/**@type {*}*/ (event).data)])
	})
	this.receiptSource.addEventListener('error', () => {
		setTimeout(() => this.reopen(sortMode, searchQuery), 2000)
	})
}
/**
 * @param {SortMode} sortMode
 * @param {string} searchQuery
 * @param {Receipt|null} lastReceipt
 */
ReceiptsLoader.prototype.loadChunk = function (sortMode, searchQuery, lastReceipt) {
	this.isLoadingChunk = true
	this.abortController.abort()
	this.abortController = new AbortController()

	let path = `./api/receipts_list?sse=0&sort_mode=${sortMode}&search=${encodeURIComponent(searchQuery)}`
	if (lastReceipt !== null) {
		if (sortMode === 'created_at') {
			path += '&before_time=' + encodeURIComponent(new Date(lastReceipt.ref.createdAt).toISOString())
		} else {
			path += '&before_id=' + lastReceipt.id
		}
	}

	fetch(path, { signal: this.abortController.signal })
		.then(r => r.json())
		.then(res => {
			if (!res.ok) throw new Error(`${res.error}: ${res.description}`)
			if (res.result.length === 0) this.hasFullyLoaded = true
			this.onChunk(res.result)
		})
		.catch(onError)
		.finally(() => {
			this.isLoadingChunk = false
		})
}

/**
 * @param {string} text
 * @param {string} substr
 */
function highlighted(text, substr) {
	const textLC = text.toLowerCase()
	substr = substr.toLowerCase()
	const res = document.createDocumentFragment()
	if (substr.length == 0) {
		res.appendChild(document.createTextNode(text))
		return res
	}
	let prevEnd = 0
	while (true) {
		const index = textLC.indexOf(substr, prevEnd) //не совсем правильно, но для русских и английских символов должно работать
		if (index === -1) {
			res.appendChild(document.createTextNode(text.slice(prevEnd)))
			break
		}
		res.appendChild(document.createTextNode(text.slice(prevEnd, index)))
		const hl = document.createElement('span')
		hl.className = 'highlight'
		hl.textContent = text.slice(index, index + substr.length)
		res.appendChild(hl)
		prevEnd = index + substr.length
	}
	return res
}

export function setupReceiptListComponent() {
	const receipts = /** @type {Receipt[]} */ ([])
	const receiptElemById = new Map()

	let sortMode = /**@type {SortMode}*/ ('id')
	let searchQuery = ''

	let clearOnNextUpdate = false
	const loader = new ReceiptsLoader(receipts => {
		if (clearOnNextUpdate) clearReceipts()
		clearOnNextUpdate = false
		listWrap.classList.remove('stale')
		const addAnimated = receipts.length === 1
		receipts.forEach(rec => addOrUpdateRceipt(rec, addAnimated))
	})

	/** @param {string|null|undefined} text @param {string} [suffix] */
	function highlightedSearch(text, suffix) {
		if (!text) return document.createTextNode('—')
		return highlighted(text + (suffix || ''), searchQuery)
	}

	/** @returns {(a:Receipt, b:Receipt) => number} */
	function getSortFunc() {
		if (sortMode === 'created_at')
			return (a, b) => b.ref.createdAt.localeCompare(a.ref.createdAt) || b.id - a.id
		return (a, b) => b.id - a.id
	}

	/**
	 * @param {Receipt} rec
	 * @param {boolean} addAnimated
	 */
	function addOrUpdateRceipt(rec, addAnimated) {
		const [index, exists] = searchBinary(receipts, rec, getSortFunc())
		if (!exists) {
			receipts.splice(index, 0, rec)

			const elem = cloneNodeDeep($('.template.receipt-list-item', HTMLDivElement))
			elem.classList.remove('template')
			receiptElemById.set(rec.id, elem)

			const wrap = $('.receipt-list-wrap', HTMLDivElement)
			index == 0 ? wrap.prepend(elem) : wrap.insertBefore(elem, wrap.children[index])

			if (addAnimated) {
				elem.classList.add('collapsed')
				elem.offsetWidth
				elem.classList.remove('collapsed')
			}
		}
		updateRceipt(rec)
	}

	function getReceiptDataFrom(data) {
		if ('ticket' in data) return data.ticket.document.receipt //FNS API version 2
		return data.document.receipt //FNS API version 1
	}

	function updateRceipt(rec) {
		const elem = receiptElemById.get(rec.id)
		const data = rec.data ? getReceiptDataFrom(JSON.parse(rec.data)) : null
		elem.classList.toggle('correct', rec.isCorrect)
		elem.classList.toggle('filled', !!data)
		elem.classList.toggle('failed', !rec.isCorrect && rec.retriesLeft == 0)
		$in(elem, '.id', Element).textContent = '#' + rec.id
		$in(elem, '.created_at', Element).textContent = new Date(rec.ref.createdAt).toLocaleString()
		$in(elem, '.total_sum', Element).appendChild(
			highlightedSearch(data && (data.totalSum / 100).toFixed(2), ' ₽'),
		)
		$in(elem, '.user', Element).appendChild(highlightedSearch(data && data.user))
		$in(elem, '.items_count', Element).textContent = ((data && data.items.length) || '??') + ' шт'
		$in(elem, '.retries_left', Element).textContent = 'x' + rec.retriesLeft
		$in(elem, '.retail_place_address', Element).appendChild(
			highlightedSearch(data && data.retailPlaceAddress),
		)
	}

	function clearReceipts() {
		receipts.length = 0
		receiptElemById.clear()
		const wrap = $('.receipt-list-wrap', HTMLDivElement)
		wrap.innerHTML = ''
		wrap.scrollTop = 0
	}

	function getDataFromFilterForm() {
		sortMode = $('.receipt-filter-form', HTMLFormElement).sort_mode.value
		searchQuery = $('.receipt-filter-form', HTMLFormElement).search.value.toLowerCase()
	}

	const panel = $('.receipt-side-panel', HTMLDivElement)
	panel.onclick = e => {
		if (panel.classList.contains('hidden')) {
			panel.classList.remove('hidden')
			e.stopPropagation()
		} else {
			const isCollapseBtn =
				e.target instanceof Element && e.target.classList.contains('receipt-side-panel-collapse-btn')
			if (isCollapseBtn) panel.classList.add('hidden')
		}
	}

	const filterForm = $('.receipt-filter-form', HTMLFormElement)
	filterForm.onchange = () => {
		getDataFromFilterForm()
		$('.receipt-list-wrap', HTMLDivElement).classList.add('stale')
		clearOnNextUpdate = true
		loader.reopen(sortMode, searchQuery)
	}
	filterForm.onsubmit = e => e.preventDefault()

	const listWrap = $('.receipt-list-wrap', HTMLDivElement)
	listWrap.addEventListener(
		'scroll',
		() => {
			if (loader.canPreload()) {
				const isNearBottom =
					listWrap.scrollTop + listWrap.getBoundingClientRect().height > listWrap.scrollHeight - 512
				if (isNearBottom)
					loader.loadChunk(sortMode, searchQuery, receipts[receipts.length - 1] || null)
			}
		},
		{ passive: true },
	)

	getDataFromFilterForm()
	loader.reopen(sortMode, searchQuery)
}

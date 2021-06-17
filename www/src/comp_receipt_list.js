import { $, cloneNodeDeep, onError, searchBinary } from './utils'

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
 */
ReceiptsLoader.prototype.reopen = function (sortMode) {
	this.isWaitingInitialReceipts = true
	this.hasFullyLoaded = false

	if (this.receiptSource !== null) this.receiptSource.close()

	let path = `./api/receipts_list?sse=1&sort_mode=${sortMode}`

	this.receiptSource = new EventSource(path)
	this.receiptSource.addEventListener('initial_receipts', event => {
		this.isWaitingInitialReceipts = false
		this.onChunk(JSON.parse(/**@type {*}*/ (event).data))
	})
	this.receiptSource.addEventListener('receipt', event => {
		this.onChunk([JSON.parse(/**@type {*}*/ (event).data)])
	})
	this.receiptSource.addEventListener('error', () => {
		setTimeout(() => this.reopen(sortMode), 2000)
	})
}
/**
 * @param {SortMode} sortMode
 * @param {Receipt|null} lastReceipt
 */
ReceiptsLoader.prototype.loadChunk = function (sortMode, lastReceipt) {
	this.isLoadingChunk = true
	this.abortController.abort()
	this.abortController = new AbortController()

	let path = `./api/receipts_list?sse=0&sort_mode=${sortMode}`
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

export function setupReceiptListComponent() {
	const receipts = /** @type {Receipt[]} */ ([])
	const receiptElemById = new Map()
	let sortMode = /**@type {SortMode}*/ ('id')
	let clearOnNextUpdate = false
	const loader = new ReceiptsLoader(receipts => {
		if (clearOnNextUpdate) clearReceipts()
		clearOnNextUpdate = false
		listWrap.classList.remove('stale')
		const addAnimated = receipts.length === 1
		receipts.forEach(rec => addOrUpdateRceipt(rec, addAnimated))
	})

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
		elem.querySelector('.id').textContent = '#' + rec.id
		elem.querySelector('.created_at').textContent = new Date(rec.ref.createdAt).toLocaleString()
		elem.querySelector('.total_sum').textContent = data && (data.totalSum / 100).toFixed(2) + ' ₽'
		elem.querySelector('.user').textContent = (data && data.user) || '—'
		elem.querySelector('.items_count').textContent = ((data && data.items.length) || '??') + ' шт'
		elem.querySelector('.items_count').textContent = ((data && data.items.length) || '??') + ' шт'
		elem.querySelector('.retries_left').textContent = 'x' + rec.retriesLeft
		elem.querySelector('.retail_place_address').textContent = (data && data.retailPlaceAddress) || '—'
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

	$('.receipt-filter-form', HTMLFormElement).onchange = () => {
		getDataFromFilterForm()
		$('.receipt-list-wrap', HTMLDivElement).classList.add('stale')
		clearOnNextUpdate = true
		loader.reopen(sortMode)
	}

	const listWrap = $('.receipt-list-wrap', HTMLDivElement)
	listWrap.addEventListener(
		'scroll',
		() => {
			if (loader.canPreload()) {
				const isNearBottom =
					listWrap.scrollTop + listWrap.getBoundingClientRect().height > listWrap.scrollHeight - 512
				if (isNearBottom)
					loader.loadChunk(sortMode, receipts.length === 0 ? null : receipts[receipts.length - 1])
			}
		},
		{ passive: true },
	)

	getDataFromFilterForm()
	loader.reopen(sortMode)
}

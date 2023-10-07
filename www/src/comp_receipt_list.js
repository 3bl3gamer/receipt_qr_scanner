import { showReceiptView } from './comp_receipt_view'
import {
	$,
	$child,
	$in,
	$template,
	createElem,
	dateStrAsYMDHM,
	getReceiptDataFrom,
	highlightedIfFound,
	onError,
	searchBinary,
} from './utils'

/** @typedef {import('./utils').Receipt} Receipt */

/** @typedef {'id'|'created_at'} SortMode */

/**
 * @param {(receipts:Receipt[], isUpdate:boolean) => unknown} onChunk
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
		this.onChunk(JSON.parse(/**@type {*}*/ (event).data), false)
	})
	this.receiptSource.addEventListener('receipt', event => {
		this.onChunk([JSON.parse(/**@type {*}*/ (event).data)], true)
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
			path += '&before_time=' + encodeURIComponent(new Date(lastReceipt.createdAt).toISOString())
		} else {
			path += '&before_id=' + lastReceipt.id
		}
	}

	fetch(path, { signal: this.abortController.signal })
		.then(r => r.json())
		.then(res => {
			if (!res.ok) throw new Error(`${res.error}: ${res.description}`)
			if (res.result.length === 0) this.hasFullyLoaded = true
			this.onChunk(res.result, false)
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
	let searchQuery = ''

	let clearOnNextUpdate = false
	const loader = new ReceiptsLoader((receipts, isUpdate) => {
		if (clearOnNextUpdate) clearReceipts()
		clearOnNextUpdate = false
		listWrap.classList.remove('stale')
		receipts.forEach(rec => addOrUpdateRceipt(rec, isUpdate))
	})

	/**
	 * @param {string|null|undefined} text
	 * @param {string} [suffix]
	 */
	function highlightedSearch(text, suffix = '') {
		if (!text) return document.createTextNode('—' + suffix)
		const frag = highlightedIfFound(text + suffix, searchQuery)
		return frag || document.createTextNode(text + suffix)
	}

	/** @returns {(a:Receipt, b:Receipt) => number} */
	function getSortFunc() {
		if (sortMode === 'created_at') return (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id
		return (a, b) => b.id - a.id
	}

	/**
	 * @param {Receipt} rec
	 * @param {boolean} addAnimated
	 */
	function addOrUpdateRceipt(rec, addAnimated) {
		const [index, exists] = searchBinary(receipts, rec, getSortFunc())
		if (exists) {
			receipts[index] = rec
		} else {
			receipts.splice(index, 0, rec)

			const elem = $template('.template.receipt-list-item', HTMLDivElement)
			elem.dataset.id = rec.id + ''
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

	/** @param {Receipt} rec */
	function updateRceipt(rec) {
		const elem = receiptElemById.get(rec.id)
		const data = getReceiptDataFrom(rec)
		const currencySuffix = data ? ' ' + data.common.currencySymbol : ''

		elem.classList.toggle('correct', rec.isCorrect)
		elem.classList.toggle('filled', !!data)
		elem.classList.toggle('failed', !rec.isCorrect && rec.retriesLeft == 0)
		$in(elem, '.id', Element).textContent = '#' + rec.id
		$child(elem, '.created_at', highlightedSearch(dateStrAsYMDHM(rec.createdAt)))
		$child(elem, '.total_sum', highlightedSearch(data?.common.totalSum?.toFixed(2), currencySuffix))
		$child(elem, '.title .value', highlightedSearch(data?.common.title))
		$child(elem, '.title .flag', highlightedSearch(data?.common.flag))
		$in(elem, '.items_count', Element).textContent = (data?.common.itemsCount || '??') + ' шт'
		$in(elem, '.retries_left', Element).textContent = 'x' + rec.retriesLeft
		$child(elem, '.retail_place_address', highlightedSearch(data && data.common.address))

		const searchedDetailsWrap = $in(elem, '.searched_details', HTMLDivElement)
		searchedDetailsWrap.innerHTML = ''
		if (searchQuery !== '') {
			let found = false
			if (data !== null) {
				// ищем в списке товаров
				for (const item of data.common.items) {
					const frag = highlightedIfFound(item.name, searchQuery)
					if (frag !== null) {
						frag.prepend(document.createTextNode(' '))
						if (item.quantity !== 1)
							frag.prepend(createElem('span', 'quantity', ` x${item.quantity}`))
						frag.prepend(createElem('span', 'price', item.price?.toFixed(2) + currencySuffix))
						searchedDetailsWrap.appendChild(frag)
						found = true
						break
					}
				}
			}
			// ищем в searchKey'е
			if (!found) {
				const frag = highlightedIfFound(rec.searchKey, searchQuery, 20, 60)
				if (frag) searchedDetailsWrap.appendChild(frag)
			}
		}
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
			return
		}
		const isCollapseBtn =
			e.target instanceof Element && e.target.classList.contains('receipt-side-panel-collapse-btn')
		if (isCollapseBtn) {
			panel.classList.add('hidden')
			return
		}
		const recListItem = e.target instanceof Element && e.target.closest('.receipt-list-item')
		if (recListItem instanceof HTMLElement) {
			const rec = receipts.find(x => x.id === parseInt(recListItem.dataset.id + ''))
			if (rec) showReceiptView(rec, searchQuery)
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

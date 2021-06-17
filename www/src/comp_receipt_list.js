import { $, cloneNodeDeep, searchBinary } from './utils'

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

export function setupReceiptListComponent() {
	let receiptSource = /** @type {EventSource|null} */ (null)
	const receipts = /** @type {Receipt[]} */ ([])
	const receiptElemById = new Map()
	let sortMode = /**@type {SortMode}*/ ('id')

	/** @param {boolean} clear */
	function reopen(clear) {
		if (receiptSource !== null) receiptSource.close()

		const listWrap = $('.receipt-list-wrap', HTMLDivElement)
		if (clear) listWrap.classList.add('stale')

		// const maxUpdatedAt = receipts.length == 0 ? null : receipts.map(x => x.updatedAt).reduce((a, b) => (a > b ? a : b))
		// const sortMode = $('.receipt-filter-form', HTMLFormElement).sort_mode.value

		let path = `./api/receipts_list?sse=1&sort_mode=${sortMode}`
		// if (receipts.length > 0) {
		// 	const maxUpdatedAt = receipts.map(x => x.updatedAt).reduce((a, b) => (a > b ? a : b))
		// 	path += '?time_from=' + new Date(maxUpdatedAt).toISOString()
		// 	TODO
		// }

		receiptSource = new EventSource(path)
		receiptSource.addEventListener('initial_receipts', event => {
			listWrap.classList.remove('stale')
			if (clear) clearReceipts()
			JSON.parse(/**@type {*}*/ (event).data).forEach(rec => addOrUpdateRceipt(rec, false))
		})
		receiptSource.addEventListener('receipt', event => {
			listWrap.classList.remove('stale')
			if (clear) clearReceipts()
			addOrUpdateRceipt(JSON.parse(/**@type {*}*/ (event).data), true)
		})
		receiptSource.addEventListener('error', () => {
			setTimeout(() => reopen(false), 2000)
		})
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
		$('.receipt-list-wrap', HTMLDivElement).innerHTML = ''
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
		sortMode = $('.receipt-filter-form', HTMLFormElement).sort_mode.value
		reopen(true)
	}

	reopen(false)
}

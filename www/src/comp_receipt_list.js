import { $, cloneNodeDeep } from './utils'

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

export function setupReceiptListComponent() {
	let receiptSource = /** @type {EventSource|null} */ (null)
	const receipts = /** @type {Receipt[]} */ ([])
	const receiptById = new Map()
	const receiptElemById = new Map()

	function reopen() {
		if (receiptSource !== null) receiptSource.close()

		let path = './api/receipts_list'
		if (receipts.length > 0) {
			const maxUpdatedAt = receipts.map(x => x.updatedAt).reduce((a, b) => (a > b ? a : b))
			path += '?time_from=' + new Date(maxUpdatedAt).toISOString()
		}

		receiptSource = new EventSource(path)
		receiptSource.addEventListener('initial_receipts', event => {
			JSON.parse(/**@type {*}*/ (event).data).forEach(handleInitialReceipt)
		})
		receiptSource.addEventListener('receipt', event => {
			handleReceipt(JSON.parse(/**@type {*}*/ (event).data))
		})
		receiptSource.addEventListener('error', () => {
			setTimeout(reopen, 2000)
		})
	}

	function handleInitialReceipt(rec) {
		addRceipt(rec, true)
	}

	function handleReceipt(rec) {
		if (receiptById.has(rec.id)) {
			updateRceipt(rec)
		} else {
			addRceipt(rec, false)
		}
	}

	function addRceipt(rec, isInitial) {
		const elem = cloneNodeDeep($('.template.receipt-list-item', HTMLDivElement))
		elem.classList.remove('template')

		receiptElemById.set(rec.id, elem)
		receiptById.set(rec.id, rec)
		if (isInitial) {
			receipts.push(rec)
			receipts.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
		} else {
			receipts.unshift(rec)
		}

		const wrap = $('.receipt-list-wrap', HTMLDivElement)
		const index = receipts.indexOf(rec)
		index == 0 ? wrap.prepend(elem) : wrap.insertBefore(elem, wrap.children[index])

		if (!isInitial) {
			elem.classList.add('collapsed')
			elem.offsetWidth
			elem.classList.remove('collapsed')
		}
		updateRceipt(rec)
	}

	function getReceiptFrom(data) {
		if ('ticket' in data) return data.ticket.document.receipt //FNS API version 2
		return data.document.receipt //FNS API version 1
	}

	function updateRceipt(rec) {
		const elem = receiptElemById.get(rec.id)
		const data = rec.data ? getReceiptFrom(JSON.parse(rec.data)) : null
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

	const wrap = $('.receipt-list-wrap', HTMLDivElement)
	wrap.onclick = () => {
		wrap.classList.toggle('hidden')
	}
	reopen()
}

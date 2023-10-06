import {
	$,
	$child,
	$in,
	$removeIn,
	$template,
	createElem,
	createFragment,
	dateStrAsYMDHM,
	dimKops,
	getReceiptDataFrom,
	highlightedIfFound,
	makeReceiptTitle,
	parseRefText,
} from './utils'

/** @typedef {import('./utils').Receipt} Receipt */

/**
 * @param {Receipt} rec
 * @param {string} searchQuery
 */
export function showReceiptView(rec, searchQuery) {
	const wrap = $('.receipt-view-wrap', HTMLDivElement)
	wrap.classList.remove('hidden')
	$removeIn(wrap, '.receipt-view')
	wrap.appendChild($template('.receipt-view', HTMLDivElement))
	$in(wrap, '.receipt-view', Element).scrollTop = 0

	const receiptItemsElem = $in(wrap, '.receipt-items', HTMLDivElement)
	receiptItemsElem.innerHTML = ''

	/**
	 * @param {string|number|null|undefined} text
	 * @param {string} [suffix]
	 */
	function highlightedSearch(text, suffix = '') {
		if (!text) return createFragment('—' + suffix)
		const frag = highlightedIfFound(text + suffix, searchQuery)
		return frag || createFragment(text + '')
	}
	function url(text, urlPrefix = '') {
		const frag = highlightedSearch(text)
		if (!text) return frag
		const a = createElem('a', null, frag)
		a.href = urlPrefix + text
		return a
	}
	function kopeks(value) {
		const text = (value / 100).toFixed(2)
		const frag = highlightedIfFound(text, searchQuery)
		return frag || dimKops(value / 100)
	}
	function withIndex(i, text) {
		const res = highlightedSearch(text)
		res.prepend(createElem('b', null, i + '. '))
		return res
	}

	const refData = parseRefText(rec.refText)
	const realRecData = getReceiptDataFrom(rec)
	const data = realRecData || { items: [], totalSum: 0 }

	for (let i = 0; i < data.items.length; i++) {
		const item = data.items[i]
		const elem = $template('.template.receipt-item', HTMLDivElement)
		$child(elem, '.name', withIndex(i + 1, item.name))
		if (item.quantity !== 1) {
			const frag = createFragment()
			frag.appendChild(highlightedSearch(item.quantity))
			frag.appendChild(document.createTextNode(' x '))
			frag.appendChild(kopeks(item.price))
			frag.appendChild(document.createTextNode(' = '))
			$child(elem, '.price .summ-details', frag)
		}
		$child(elem, '.price .summ', kopeks(item.sum))
		receiptItemsElem.appendChild(elem)
	}
	$child(wrap, '.receipt-items-total .summ', kopeks(data.totalSum))

	$child(wrap, '.kkt-reg-id', highlightedSearch(data.kktRegId))
	$child(wrap, '.fiscal-drive-number', highlightedSearch(data.fiscalDriveNumber || refData.fiscalNum))
	$child(wrap, '.fiscal-document-number', highlightedSearch(data.fiscalDocumentNumber || refData.fiscalDoc))
	$child(wrap, '.fiscal-sign', highlightedSearch(data.fiscalSign || refData.fiscalSign))

	const isEmail = !!data.buyerPhoneOrAddress && data.buyerPhoneOrAddress.includes('@')
	$in(wrap, '.buyer-email-label', Element).classList.toggle('hidden', !isEmail)
	$in(wrap, '.buyer-phone-label', Element).classList.toggle('hidden', isEmail)
	$child(wrap, '.buyer-phone-or-address', url(data.buyerPhoneOrAddress, 'mailto:'))
	$child(wrap, '.seller-address', url(data.sellerAddress, 'mailto:'))
	$child(wrap, '.fns-url', url(data.fnsUrl))

	$child(wrap, '.operator', highlightedSearch(data.operator)) // TODO: "operationType": 1
	$child(wrap, '.shift-number', highlightedSearch(data.shiftNumber))
	$child(wrap, '.user', highlightedSearch(data.user))
	$child(wrap, '.user-inn', highlightedSearch(data.userInn))
	$child(wrap, '.retail-place', highlightedSearch(data.retailPlace))
	$child(wrap, '.retail-place-address', highlightedSearch(data.retailPlaceAddress))

	$in(wrap, '.title', Element).textContent = makeReceiptTitle(realRecData, 'Чек')

	$child(wrap, '.created-at', highlightedSearch(dateStrAsYMDHM(rec.createdAt)))
	$child(wrap, '.saved-at', highlightedSearch(dateStrAsYMDHM(rec.savedAt)))
	$child(wrap, '.updated-at', highlightedSearch(dateStrAsYMDHM(rec.updatedAt)))

	$child(wrap, '.receipt-seach-key', highlightedSearch(rec.searchKey))
	$child(wrap, '.receipt-json-data', highlightedSearch(JSON.stringify(realRecData, null, '  ')))
}

function hideReceiptView() {
	$('.receipt-view-wrap', HTMLDivElement).classList.add('hidden')
}

export function setupReceiptViewComponent() {
	$('.receipt-view-wrap .close', HTMLButtonElement).addEventListener('click', hideReceiptView)
	window.addEventListener('keydown', e => e.key === 'Escape' && hideReceiptView())
}

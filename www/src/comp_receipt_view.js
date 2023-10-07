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
	/** @param {string|undefined} text */
	function url(text, urlPrefix = '') {
		const frag = highlightedSearch(text)
		if (!text) return frag
		const a = createElem('a', null, frag)
		a.href = urlPrefix + text
		return a
	}
	/** @param {number|undefined} value */
	function kopeks(value) {
		if (value === undefined) return document.createTextNode('—')
		const text = value.toFixed(2)
		const frag = highlightedIfFound(text, searchQuery)
		return frag ?? dimKops(value)
	}
	/**
	 * @param {number} i
	 * @param {string|undefined} text
	 */
	function withIndex(i, text) {
		const res = highlightedSearch(text)
		res.prepend(createElem('b', null, i + '. '))
		return res
	}

	// const refData = parseRefText(rec.domain, rec.refText)
	const data = getReceiptDataFrom(rec)

	if (data) {
		for (let i = 0; i < data.common.items.length; i++) {
			const item = data.common.items[i]
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
	}
	$child(wrap, '.receipt-items-total .summ', kopeks(data?.common.totalSum))

	if (data && 'ruFns' in data) {
		const x = data.ruFns
		const b = $in(wrap, '.receipt-info tbody', HTMLTableSectionElement)
		row(b, 'РН ККТ', 'Регистрационный номер ККТ', highlightedSearch(x.kktRegId))
		row(b, 'ФН №', 'Заводской номер фискального накопителя', highlightedSearch(x.fiscalDriveNumber))
		row(b, 'ФД №', 'Порядковй номер фискального документа', highlightedSearch(x.fiscalDocumentNumber))
		row(b, 'ФП', 'Фискальный признак документа', highlightedSearch(x.fiscalDocumentSign))
	}
	if (data && 'kgGns' in data) {
		const x = data.kgGns
		const b = $in(wrap, '.receipt-info tbody', HTMLTableSectionElement)
		row(b, 'РН ККМ', 'регистрационный номер ККМ', highlightedSearch(x.kktRegNumber))
		row(b, 'ФМ №', 'Серийный номер фискального модуля', highlightedSearch(x.fiscalModuleSerialNumber))
		row(b, 'ФД №', 'Номер фискального документа', highlightedSearch(x.fiscalDocumentNumber))
		row(b, 'ФПД', 'Фискальный признак документа', highlightedSearch(x.fiscalDocumentSign))
	}

	{
		const b = $in(wrap, '.receipt-contacts tbody', HTMLTableSectionElement)
		if (data && 'ruFns' in data) {
			const isEmail = !!data.ruFns.buyerPhoneOrAddress && data.ruFns.buyerPhoneOrAddress.includes('@')
			const label = isEmail ? 'Е-мейл покупателя' : 'Телефон покупателя'
			row(b, label, '', url(data.ruFns.buyerPhoneOrAddress, 'mailto:'))
			row(b, 'Е-мейл продавца', '', url(data.ruFns.sellerAddress, 'mailto:'))
		}
		row(b, 'Сайт для проверки ФПД', '', url(data?.common.taxOrgUrl))
	}

	$child(wrap, '.operator', highlightedSearch(data?.common.cashierName)) // TODO: "operationType": 1
	$child(wrap, '.shift-number', highlightedSearch(data?.common.shiftNumber))
	$child(wrap, '.retail-place', highlightedSearch(data?.common.placeName))
	$child(wrap, '.retail-place-address', highlightedSearch(data?.common.address))
	{
		const b = $in(wrap, '.receipt-place-info tbody.user-section', HTMLTableSectionElement)
		if (data && 'ruFns' in data) {
			row(b, 'Пользователь', '', highlightedSearch(data.ruFns.orgName))
			row(b, 'Его ИНН', '', highlightedSearch(data?.common.orgInn))
		} else {
			row(b, 'ИНН', '', highlightedSearch(data?.common.orgInn))
		}
	}

	$in(wrap, '.title', Element).textContent = data?.common.title ?? 'Чек'

	$child(wrap, '.created-at', highlightedSearch(dateStrAsYMDHM(rec.createdAt)))
	$child(wrap, '.saved-at', highlightedSearch(dateStrAsYMDHM(rec.savedAt)))
	$child(wrap, '.updated-at', highlightedSearch(dateStrAsYMDHM(rec.updatedAt)))

	$child(wrap, '.receipt-seach-key', highlightedSearch(rec.searchKey))
	$child(wrap, '.receipt-json-data', highlightedSearch(JSON.stringify(data?.raw, null, '  ')))

	/**
	 * @param {HTMLTableSectionElement} tbody
	 * @param {string} name
	 * @param {string} title
	 * @param {string|Node} value
	 */
	function row(tbody, name, title, value) {
		const row = tbody.insertRow(-1)
		const nameCell = row.insertCell(-1)
		nameCell.textContent = name
		if (title) nameCell.title = title
		row.insertCell(-1).append(value)
	}
}

function hideReceiptView() {
	$('.receipt-view-wrap', HTMLDivElement).classList.add('hidden')
}

export function setupReceiptViewComponent() {
	$('.receipt-view-wrap .close', HTMLButtonElement).addEventListener('click', hideReceiptView)
	window.addEventListener('keydown', e => e.key === 'Escape' && hideReceiptView())
}

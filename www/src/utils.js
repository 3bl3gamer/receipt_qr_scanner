/**
 * @typedef {{
 *   id: number,
 *   domain: string,
 *   savedAt: string,
 *   updatedAt: string,
 *   createdAt: string,
 *   refText: string,
 *   isCorrect: boolean,
 *   data: string,
 *   searchKey: string,
 *   retriesLeft: number,
 *   nextRetryAt: string,
 * }} Receipt
 */

/** @param {unknown} err */
export function onError(err) {
	// eslint-disable-next-line no-console
	console.error(err)
}

/**
 * @template T
 * @param {T|null} val
 * @returns {T}
 */
export function mustBeNotNull(val) {
	if (val === null) throw new Error('must not be null')
	return val
}

/**
 * @template T
 * @param {T|undefined} val
 * @returns {T}
 */
export function mustBeDefined(val) {
	if (val === undefined) throw new Error('must not be undefined')
	return val
}

/**
 * @template {{new (...args: any): any}[]} T
 * @param {any} obj
 * @param {T} classes
 * @returns {InstanceType<T[number]>}
 */
export function mustBeInstanceOf(obj, ...classes) {
	for (const class_ of classes) {
		if (obj instanceof class_) return obj
	}
	throw new Error(`object is ${obj}, expected ${classes.map(x => x.name).join('|')}`)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>|null}
 */
export function $inOpt(parent, selector, class_) {
	const elem = parent.querySelector(selector)
	return mustBeInstanceOf(elem, class_)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $in(parent, selector, class_) {
	const elem = $inOpt(parent, selector, class_)
	if (elem === null) throw new Error(`elem not found in ${parent} by '${selector}'`)
	return elem
}

/**
 * @param {ParentNode} parent
 * @param {string} selector
 */
export function $removeIn(parent, selector) {
	const elems = parent.querySelectorAll(selector)
	for (let i = 0; i < elems.length; i++) elems[i].remove()
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $template(selector, class_) {
	const elem = cloneNodeDeep($(selector, class_))
	elem.classList.remove('template')
	return elem
}

/**
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {Node} child
 */
export function $child(parent, selector, child) {
	const elem = $in(parent, selector, Element)
	elem.innerHTML = ''
	elem.appendChild(child)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>|null}
 */
export function $opt(selector, class_) {
	return $inOpt(document, selector, class_)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $(selector, class_) {
	const elem = $opt(selector, class_)
	if (elem === null) throw new Error(`elem not found by '${selector}'`)
	return elem
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {string|null|undefined} [className]
 * @param {string|Node|null|undefined} [child]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createElem(tagName, className, child) {
	const el = document.createElement(tagName)
	if (className) el.className = className
	if (typeof child === 'string') {
		el.appendChild(document.createTextNode(child))
	} else if (child) {
		el.appendChild(child)
	}
	return el
}

/**
 * @param {string|Node|null|undefined} [child]
 * @returns {DocumentFragment}
 */
export function createFragment(child) {
	const frag = document.createDocumentFragment()
	if (typeof child === 'string') {
		frag.appendChild(document.createTextNode(child))
	} else if (child) {
		frag.appendChild(child)
	}
	return frag
}

/**
 * @template {Node} T
 * @param {T} node
 * @returns {T}
 */
export function cloneNodeDeep(node) {
	return /** @type {T} */ (node.cloneNode(true))
}

/**
 * @template T
 * @param {readonly T[]} arr
 * @param {T} elem
 * @param {(a: T, b: T) => number} sortFunc
 * @returns {[number,boolean]}
 */
export function searchBinary(arr, elem, sortFunc) {
	let startI = 0
	let endI = arr.length
	while (startI < endI) {
		let midI = Math.floor((startI + endI) / 2)
		const cmp = sortFunc(elem, arr[midI])
		if (cmp < 0) {
			endI = midI
		} else if (cmp > 0) {
			startI = midI + 1
		} else {
			return [midI, true]
		}
	}
	return [startI, false]
}

/** @param {number} num */
function pad00(num) {
	return num < 10 ? '0' + num : '' + num
}

/** @param {string} str */
export function dateStrAsYMDHM(str) {
	const date = new Date(str)
	const y = date.getFullYear()
	const m = pad00(date.getMonth() + 1)
	const d = pad00(date.getDate())
	const hr = pad00(date.getHours())
	const mn = pad00(date.getMinutes())
	return `${y}-${m}-${d} ${hr}:${mn}`
}

export const DOMAIN_CURRENCY_SYMBOLS = new Map([
	['ru-fns', '₽'],
	['kg-gns', 'с'],
])

/** @param {string} refText */
export function guessDomain(refText) {
	if (refText.match(/^https?:\/\/[^/]+\.kg\//)) {
		return 'kg-gns'
	}
	return 'ru-fns'
}
/**
 * @param {string|null} domain
 * @param {string} refText
 */
export function parseRefText(domain, refText) {
	if (!domain) domain = guessDomain(refText)
	if (domain === 'ru-fns') return parseRuFnsRefText(refText)
	if (domain === 'kg-gns') return parseKgGnsRefText(refText)
	return null
}

/** @param {string} refText */
export function parseRuFnsRefText(refText) {
	const params = new URLSearchParams(refText)
	return {
		fiscalNum: params.get('fn'),
		fiscalDocumentNumber: params.get('i'),
		fiscalDocumentSign: params.get('fp'),
		kind: params.get('n'),
		sum: params.get('s'),
		createdAt: params.get('t'),
	}
}

/** @param {string} refText */
export function parseKgGnsRefText(refText) {
	let url
	try {
		url = new URL(refText)
	} catch (ex) {
		onError(ex)
		return null
	}
	const params = url.searchParams
	return {
		createdAt: params.get('date'),
		type: params.get('type'),
		operationType: params.get('operation_type'),
		fiscalModuleSerialNumber: params.get('fn_number'),
		fiscalDocumentNumber: params.get('fd_number'),
		fiscalDocumentSign: params.get('fm'),
		taxpayerIdNumber: params.get('tin'),
		kktRegNumber: params.get('regNumber'),
		sum: params.get('sum'),
	}
}

/**
 * @typedef {{
 *   title: string,
 *   flag: string,
 *   totalSum: number | undefined,
 *   itemsCount: number | undefined,
 *   placeName: string | undefined,
 *   orgInn: string | undefined,
 *   address: string | undefined,
 *   cashierName: string | undefined,
 *   shiftNumber: number | undefined,
 *   taxOrgUrl: string | undefined,
 *   items: {
 *     name: string | undefined,
 *     quantity: number | undefined,
 *     price: number | undefined,
 *     sum: number | undefined,
 *   }[]
 * }} CommonReceiptData
 */

/** @param {Receipt} rec */
export function getReceiptDataFrom(rec) {
	if (!rec.data) return null
	if (rec.domain === 'ru-fns') return getRuFnsReceiptDataFrom(rec)
	if (rec.domain === 'kg-gns') return getKgGnsReceiptDataFrom(rec)
	return null
}
/** @param {Receipt} rec */
function getRuFnsReceiptDataFrom(rec) {
	const data = JSON.parse(rec.data)
	const receipt =
		'ticket' in data
			? data.ticket.document.receipt //FNS API version 2
			: data.document.receipt //FNS API version 1
	const refData = parseRuFnsRefText(rec.refText)
	return {
		/** @type {CommonReceiptData} */
		common: {
			title: makeRuFnsReceiptTitle(receipt) ?? '—',
			flag: '🇷🇺',
			totalSum: receipt.totalSum / 100,
			itemsCount: receipt.items.length,
			placeName: receipt.retailPlace,
			orgInn: receipt.userInn,
			address: receipt.retailPlaceAddress,
			cashierName: receipt.operator,
			shiftNumber: receipt.shiftNumber,
			taxOrgUrl: receipt.fnsUrl,
			items: /**@type {any[]}*/ (receipt.items).map(x => ({
				name: x.name,
				quantity: x.quantity,
				price: x.price / 100,
				sum: x.sum / 100,
			})),
		},
		ruFns: {
			kktRegId: receipt.kktRegId,
			fiscalDriveNumber: receipt.fiscalDriveNumber ?? refData.fiscalNum,
			fiscalDocumentNumber: receipt.fiscalDoc ?? refData.fiscalDocumentNumber,
			fiscalDocumentSign: receipt.fiscalSign ?? refData.fiscalDocumentSign,
			orgName: receipt.user,
			buyerPhoneOrAddress: receipt.buyerPhoneOrAddress,
			sellerAddress: receipt.sellerAddress,
		},
		raw: data,
	}
}
/** @param {Receipt} rec */
function getKgGnsReceiptDataFrom(rec) {
	const data = JSON.parse(rec.data)
	const refData = parseKgGnsRefText(rec.refText)
	return {
		/** @type {CommonReceiptData} */
		common: {
			title: data.crData.locationName,
			flag: '🇰🇬',
			totalSum: data.ticketTotalSum / 100,
			itemsCount: data.items.length,
			placeName: data.crData.locationName,
			orgInn: data.tin,
			address: data.crData.locationAddress,
			cashierName: data.crData.cashierName,
			shiftNumber: data.crData.shiftNumber,
			taxOrgUrl: kgGnsUrl(rec.refText),
			items: /**@type {any[]}*/ (data.items).map(x => ({
				name: x.goodName,
				quantity: x.goodQuantity,
				price: x.goodPrice / 100,
				sum: x.goodCost / 100,
			})),
		},
		kgGns: {
			// https://www.sti.gov.kg/docs/default-source/kkm/form_fd.pdf
			kktRegNumber: data.crRegisterNumber ?? refData?.kktRegNumber, //РН ККМ, регистрационный номер ККМ
			fiscalModuleSerialNumber: data.fnSerialNumber ?? refData?.fiscalModuleSerialNumber, //ФМ, серийный номер фискального модуля
			fiscalDocumentNumber: data.fdNumber ?? refData?.fiscalDocumentNumber, //ФД, номер фискального документа
			fiscalDocumentSign: data.documentFiscalMark ?? refData?.fiscalDocumentSign, //ФПД, фискальный признак документа
		},
		raw: data,
	}
}
/** @param {string} refText */
function kgGnsUrl(refText) {
	const m = refText.match(/^https?:\/\/([^/]+)/)
	return m ? m[1] : undefined
}

/**
 * @param {Record<string, any>|null} recData
 * @returns {string|null}
 */
export function makeRuFnsReceiptTitle(recData) {
	if (recData !== null) {
		let t
		let placeName = ''
		let placeFullName = ''
		if (recData.retailPlace) {
			placeFullName = recData.retailPlace.trim()
			placeName = recData.retailPlace
			if ((t = RECEIPT_NAME_EXCEPTIONS[placeName])) return t
			placeName = chooseLongestURL(placeName)
				.replace(/^магазин(\s+самообслуживания)?\s/i, '')
				.replace(/^https?:\/\/(www\.)?/, '')
				.replace(/\/$/, '')
				.replace(/;$/, '')
				.trim()
			if ((t = RECEIPT_NAME_EXCEPTIONS[placeName])) return t
		}

		let userName = ''
		let userNameIsActualName = false
		if (recData.user) {
			userName = recData.user.trim()
			if (isLikePersonName(userName)) userNameIsActualName = true
			if ((t = RECEIPT_NAME_EXCEPTIONS[userName])) return t
			userName = userName
				.trim()
				.replace(/общество с ограниченной ответственностью\s+/i, '')
				.replace(/(публичное |открытое )?акционерное общество\s+/i, '')
				.replace(/^авиакомпания\s+/i, '')
				.replace(/^(ооо|ао|зао)(?=\W)/i, '')
				.trim()
			if ((t = RECEIPT_NAME_EXCEPTIONS[userName])) return t
		}

		return (
			(placeName.length > userName.length || userNameIsActualName ? placeName : userName) ||
			placeFullName ||
			userName
		)
	}
	return null

	/** @param {string} name */
	function isLikePersonName(name) {
		name = name.trim().replace(/^(ип|индивидуальный предприниматель)\s+/i, '')
		return /^[а-яёА-ЯЁ\s]*$/.test(name) && name.split(/\s+/).length === 3
	}

	/** @param {string} name */
	function chooseLongestURL(name) {
		const items = name.split(';')
		if (items.length === 1 || !items.every(x => /^\s*https?:\/\//.test(x))) return name
		return items.sort((a, b) => b.length - a.length)[0]
	}
}
/** @type {Record<string, string|undefined>} */
const RECEIPT_NAME_EXCEPTIONS = {
	'Магазин "Читай-Город"': '"Читай-Город"',
	'Магазин упаковки': 'Магазин упаковки',
	'"МОБИЛЬНЫЕ ТЕЛЕСИСТЕМЫ"': 'МТС',
	'dom.ru': 'dom.ru',
}

/**
 * @param {string|undefined} text
 * @param {string} substr
 * @param {number} [maxFirstOffset]
 * @param {number} [maxTotalLen]
 * @returns {DocumentFragment|null}
 */
export function highlightedIfFound(text, substr, maxFirstOffset, maxTotalLen) {
	if (!text || substr.length == 0) return null
	let textLC = text.toLowerCase()
	substr = substr.toLowerCase()

	const res = createFragment()
	let prevEnd = 0
	while (true) {
		const isFirstIter = prevEnd === 0
		let index = textLC.indexOf(substr, prevEnd) //не совсем правильно, но для русских и английских символов должно работать
		if (isFirstIter && index === -1) return null
		if (index === -1) index = text.length

		if (prevEnd === 0 && maxFirstOffset !== undefined && index > maxFirstOffset) {
			const offset = index - Math.ceil(maxFirstOffset * 0.8)
			text = '…' + text.slice(offset)
			textLC = '…' + textLC.slice(offset)
			index = index - offset + '…'.length
		}

		if (maxTotalLen !== undefined && index > maxTotalLen) {
			res.appendChild(document.createTextNode(text.slice(prevEnd, maxTotalLen) + '…'))
			break
		}
		res.appendChild(document.createTextNode(text.slice(prevEnd, index)))
		if (index === text.length) break

		res.appendChild(createElem('span', 'highlight', text.slice(index, index + substr.length)))
		prevEnd = index + substr.length
	}
	return res
}

/** @param {number} summ */
export function dimKops(summ) {
	const [int, fract] = summ.toFixed(2).split('.')
	const frag = createFragment()
	frag.appendChild(document.createTextNode(int))
	frag.appendChild(createElem('span', 'kopeks', '.' + fract))
	return frag
}

export type Receipt = {
	id: number
	domain: string
	savedAt: string
	updatedAt: string
	createdAt: string
	refText: string
	isCorrect: boolean
	data: string
	searchKey: string
	retriesLeft: number
	nextRetryAt: string
}

export function onError(err: unknown): void {
	// eslint-disable-next-line no-console
	console.error(err)
}

export function isNil(x: unknown): x is null | undefined {
	return x == void 0
}

export function mustBeNotNull<T>(val: T | null): T {
	if (val === null) throw new Error('must not be null')
	return val
}

export function mustBeDefined<T>(val: T | undefined): T {
	if (val === undefined) throw new Error('must not be undefined')
	return val
}

export function mustBeInstanceOf<T extends Array<new (...args: unknown[]) => unknown>>(
	obj: unknown,
	...classes: T
): InstanceType<T[number]> {
	for (const class_ of classes) {
		if (obj instanceof class_) return obj as InstanceType<T[number]>
	}
	throw new Error(`object is ${obj}, expected ${classes.map(x => x.name).join('|')}`)
}

export function $inOpt<T extends new (...args: unknown[]) => unknown>(
	parent: ParentNode,
	selector: string,
	class_: T,
): InstanceType<T> | null {
	const elem = parent.querySelector(selector)
	return mustBeInstanceOf(elem, class_)
}

export function $in<T extends new (...args: unknown[]) => unknown>(
	parent: ParentNode,
	selector: string,
	class_: T,
): InstanceType<T> {
	const elem = $inOpt(parent, selector, class_)
	if (elem === null) throw new Error(`elem not found in ${parent} by '${selector}'`)
	return elem
}

export function $removeIn(parent: ParentNode, selector: string): void {
	const elems = parent.querySelectorAll(selector)
	for (let i = 0; i < elems.length; i++) elems[i].remove()
}

export function $template<T extends new (...args: unknown[]) => Element>(
	selector: string,
	class_: T,
): InstanceType<T> {
	const elem = cloneNodeDeep($(selector, class_))
	elem.classList.remove('template')
	return elem
}

export function $child(parent: ParentNode, selector: string, child: Node): void {
	const elem = $in(parent, selector, Element)
	elem.innerHTML = ''
	elem.appendChild(child)
}

export function $opt<T extends new (...args: unknown[]) => unknown>(
	selector: string,
	class_: T,
): InstanceType<T> | null {
	return $inOpt(document, selector, class_)
}

export function $<T extends new (...args: unknown[]) => unknown>(
	selector: string,
	class_: T,
): InstanceType<T> {
	const elem = $opt(selector, class_)
	if (elem === null) throw new Error(`elem not found by '${selector}'`)
	return elem
}

export function createElem<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	className?: string | null,
	child?: string | Node | null,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tagName)
	if (className) el.className = className
	if (typeof child === 'string') {
		el.appendChild(document.createTextNode(child))
	} else if (child) {
		el.appendChild(child)
	}
	return el
}

export function createFragment(child?: string | Node | null): DocumentFragment {
	const frag = document.createDocumentFragment()
	if (typeof child === 'string') {
		frag.appendChild(document.createTextNode(child))
	} else if (child) {
		frag.appendChild(child)
	}
	return frag
}

export function cloneNodeDeep<T extends Node>(node: T): T {
	return node.cloneNode(true) as T
}

export function searchBinary<T>(
	arr: readonly T[],
	elem: T,
	sortFunc: (a: T, b: T) => number,
): [number, boolean] {
	let startI = 0
	let endI = arr.length
	while (startI < endI) {
		const midI = Math.floor((startI + endI) / 2)
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

function pad00(num: number): string {
	return num < 10 ? '0' + num : '' + num
}

export function dateStrAsYMDHM(str: string): string {
	const date = new Date(str)
	const y = date.getFullYear()
	const m = pad00(date.getMonth() + 1)
	const d = pad00(date.getDate())
	const hr = pad00(date.getHours())
	const mn = pad00(date.getMinutes())
	return `${y}-${m}-${d} ${hr}:${mn}`
}

function parseRuFnsRefText(refText: string): Record<string, string | null> {
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

function parseKgGnsRefText(refText: string): Record<string, string | null> | null {
	let url: URL
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

function parseKzKtcRefText(refText: string): Record<string, string | null> | null {
	let url: URL
	try {
		url = new URL(refText)
	} catch (ex) {
		onError(ex)
		return null
	}
	const params = url.searchParams
	return {
		fiscalId: params.get('i'),
		kkmFnsId: params.get('f'),
		sum: params.get('s'),
		createdAt: params.get('t'),
	}
}

export type ReceiptData<T> = {
	common: CommonReceiptData
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	raw: any
} & T

export type CommonReceiptData = {
	title: string
	totalSum: number | undefined
	itemsCount: number | undefined
	placeName: string | undefined
	orgInn: string | undefined
	address: string | undefined
	cashierName: string | undefined
	shiftNumber: number | undefined
	taxOrgUrl: string | undefined
	items: {
		name: string | undefined
		quantity: number | undefined
		price: number | undefined
		sum: number | undefined
	}[]
}

export type FullReceiptData = Exclude<ReturnType<typeof getReceiptDataFrom>, null>

export function getReceiptDataFrom(rec: Receipt) {
	if (!rec.data) return null
	if (rec.domain === 'ru-fns') return getRuFnsReceiptDataFrom(rec)
	if (rec.domain === 'kg-gns') return getKgGnsReceiptDataFrom(rec)
	if (rec.domain === 'kz-ktc') return getKzKtcReceiptDataFrom(rec)
	return null
}

type RuFnsExtraData = {
	kktRegId: ReturnType<typeof optStr>
	fiscalDriveNumber: ReturnType<typeof optStr>
	fiscalDocumentNumber: ReturnType<typeof optStr>
	fiscalDocumentSign: ReturnType<typeof optStr>
	orgName: ReturnType<typeof optStr>
	buyerPhoneOrAddress: ReturnType<typeof optStr>
	sellerAddress: ReturnType<typeof optStr>
}
function getRuFnsReceiptDataFrom(rec: Receipt): ReceiptData<{ ruFns: RuFnsExtraData }> {
	const data = JSON.parse(rec.data)
	const receipt =
		'ticket' in data
			? data.ticket.document.receipt //FNS API version 2
			: data.document.receipt //FNS API version 1
	const refData = parseRuFnsRefText(rec.refText)
	return {
		common: {
			title: makeRuFnsReceiptTitle(receipt) ?? '—',
			totalSum: receipt.totalSum / 100,
			itemsCount: receipt.items.length,
			placeName: receipt.retailPlace,
			orgInn: receipt.userInn,
			address: receipt.retailPlaceAddress,
			cashierName: receipt.operator,
			shiftNumber: receipt.shiftNumber,
			taxOrgUrl: receipt.fnsUrl,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			items: (receipt.items as any[]).map(x => ({
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

/** https://www.sti.gov.kg/docs/default-source/kkm/form_fd.pdf */
type KgGnsExtraData = {
	kktRegNumber: ReturnType<typeof optStr>
	fiscalModuleSerialNumber: ReturnType<typeof optStr>
	fiscalDocumentNumber: ReturnType<typeof optStr>
	fiscalDocumentSign: ReturnType<typeof optStr>
}
function getKgGnsReceiptDataFrom(rec: Receipt): ReceiptData<{ kgGns: KgGnsExtraData }> {
	const data = JSON.parse(rec.data)
	const refData = parseKgGnsRefText(rec.refText)
	return {
		common: {
			title: makeKgGnsReceiptTitle(data.crData.locationName),
			totalSum: data.ticketTotalSum / 100,
			itemsCount: data.items.length,
			placeName: data.crData.locationName,
			orgInn: data.tin,
			address: data.crData.locationAddress,
			cashierName: data.crData.cashierName,
			shiftNumber: data.crData.shiftNumber,
			taxOrgUrl: kgGnsUrl(rec.refText),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			items: (data.items as any[]).map(x => ({
				name: x.goodName,
				quantity: x.goodQuantity,
				price: x.goodPrice / 100,
				sum: x.goodCost / 100,
			})),
		},
		kgGns: {
			// https://www.sti.gov.kg/docs/default-source/kkm/form_fd.pdf
			kktRegNumber: optStr(data.crRegisterNumber ?? refData?.kktRegNumber), //РН ККМ, регистрационный номер ККМ
			fiscalModuleSerialNumber: optStr(data.fnSerialNumber ?? refData?.fiscalModuleSerialNumber), //ФМ, серийный номер фискального модуля
			fiscalDocumentNumber: optStr(data.fdNumber ?? refData?.fiscalDocumentNumber), //ФД, номер фискального документа
			fiscalDocumentSign: optStr(data.documentFiscalMark ?? refData?.fiscalDocumentSign), //ФПД, фискальный признак документа
		},
		raw: data,
	}
}

type KzKtcExtraData = {
	kkmSerialNumber: ReturnType<typeof optStr>
	kkmFnsId: ReturnType<typeof optStr>
	fiscalId: ReturnType<typeof optStr>
	orgId: ReturnType<typeof optStr>
}
function getKzKtcReceiptDataFrom(rec: Receipt): ReceiptData<{ kzKtc: KzKtcExtraData }> {
	const data = JSON.parse(rec.data)
	const ticket = data.ticket
	const refData = parseKzKtcRefText(rec.refText)

	// Фильтруем только товарные позиции (itemType === 1)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const productItems = (ticket.items as any[]).filter(x => x.itemType === 1)

	return {
		common: {
			title: makeKzKtcReceiptTitle(data.orgTitle),
			totalSum: ticket.totalSum,
			itemsCount: productItems.length,
			placeName: data.orgTitle,
			orgInn: data.orgId,
			address: data.retailPlaceAddress,
			cashierName: ticket.operator?.name,
			shiftNumber: ticket.shiftNumber,
			taxOrgUrl: kzKtcUrl(rec.refText),
			items: productItems.map(x => ({
				name: x.commodity?.name,
				quantity: x.commodity?.quantity,
				price: x.commodity?.price,
				sum: x.commodity?.sum,
			})),
		},
		kzKtc: {
			kkmSerialNumber: optStr(data.kkmSerialNumber),
			kkmFnsId: optStr(data.kkmFnsId ?? refData?.kkmFnsId),
			fiscalId: optStr(ticket.fiscalId ?? refData?.fiscalId),
			orgId: optStr(data.orgId),
		},
		raw: data,
	}
}

function kgGnsUrl(refText: string): string | undefined {
	const m = refText.match(/^https?:\/\/([^/]+)/)
	return m ? m[1] : undefined
}

function kzKtcUrl(refText: string): string | undefined {
	const m = refText.match(/^https?:\/\/([^/]+)/)
	return m ? m[1] : undefined
}

export function makeKzKtcReceiptTitle(orgTitle: string): string {
	return orgTitle
		.replace(/товарищество с ограниченной ответственностью\s+/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

function optStr(val: unknown): string | null | undefined {
	if (typeof val === 'string') return val
	if (isNil(val)) return val
	return val + ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeRuFnsReceiptTitle(recData: Record<string, any> | null): string | null {
	if (recData !== null) {
		let t: string | undefined
		let placeName = ''
		let placeFullName = ''
		if (recData.retailPlace) {
			placeFullName = recData.retailPlace.trim()
			placeName = recData.retailPlace
			if ((t = RECEIPT_NAME_EXCEPTIONS[placeName])) return t
			placeName = chooseLongestURL(placeName)
				.replace(/^магазин(\s+самообслуживания)?\s+/i, '')
				.replace(/^https?:\/\/(www\.)?/, '')
				.replace(/\/$/, '')
				.replace(/;$/, '')
				.replace(/^"([^"]*)"$/, '$1')
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
				.replace(/^(ооо|ао|зао)\s*(?=\W)/i, '')
				.replace(/^"([^"]*)"$/, '$1')
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

	function isLikePersonName(name: string): boolean {
		name = name.trim().replace(/^(ип|индивидуальный предприниматель)\s+/i, '')
		return /^[а-яёА-ЯЁ\s]*$/.test(name) && name.split(/\s+/).length === 3
	}

	function chooseLongestURL(name: string): string {
		const items = name.split(';')
		if (items.length === 1 || !items.every(x => /^\s*https?:\/\//.test(x))) return name
		return items.sort((a, b) => b.length - a.length)[0]
	}
}

const RECEIPT_NAME_EXCEPTIONS: Record<string, string | undefined> = {
	'Магазин "Читай-Город"': 'Читай-Город',
	'Магазин упаковки': 'Магазин упаковки',
	'МОБИЛЬНЫЕ ТЕЛЕСИСТЕМЫ': 'МТС',
	'dom.ru': 'dom.ru',
}

export function makeKgGnsReceiptTitle(locationName: string): string {
	return locationName
		.replace(/^осоо(?=\W)/i, '')
		.replace(/^магазин\s/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

export function isAbortError(err: unknown): boolean {
	return err instanceof Error && err.name === 'AbortError'
}

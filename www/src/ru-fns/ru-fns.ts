import { Receipt, ReceiptData } from '../receipts'
import { divBy100, isRecord, optArr, optNum, optStr, OptStr } from '../utils'

type RuFnsExtraData = {
	kktRegId: OptStr
	fiscalDriveNumber: OptStr
	fiscalDocumentNumber: OptStr
	fiscalDocumentSign: OptStr
	orgName: OptStr
	buyerPhoneOrAddress: OptStr
	sellerAddress: OptStr
}
export function getRuFnsReceiptDataFrom(rec: Receipt): ReceiptData<{ ruFns: RuFnsExtraData }> {
	const data = JSON.parse(rec.data)
	const receipt: Record<string, unknown> =
		'ticket' in data
			? data.ticket.document.receipt //FNS API version 2
			: data.document.receipt //FNS API version 1
	const refData = parseRefText(rec.refText)
	return {
		common: {
			title: makeRuFnsReceiptTitle(receipt) ?? '—',
			totalSum: optNum(receipt.totalSum, divBy100),
			itemsCount: optArr(receipt.items)?.length,
			placeName: optStr(receipt.retailPlace),
			orgInn: optStr(receipt.userInn),
			address: optStr(receipt.retailPlaceAddress),
			cashierName: optStr(receipt.operator),
			shiftNumber: optStr(receipt.shiftNumber),
			taxOrgUrl: optStr(receipt.fnsUrl),
			items: optArr(receipt.items, []).map(item => {
				const x = isRecord(item) ? item : { name: item }
				return {
					name: optStr(x.name),
					quantity: optNum(x.quantity),
					price: optNum(x.price, divBy100),
					sum: optNum(x.sum, divBy100),
				}
			}),
			parseErrors: [],
		},
		ruFns: {
			kktRegId: optStr(receipt.kktRegId),
			fiscalDriveNumber: optStr(receipt.fiscalDriveNumber ?? refData.fiscalNum),
			fiscalDocumentNumber: optStr(receipt.fiscalDoc ?? refData.fiscalDocumentNumber),
			fiscalDocumentSign: optStr(receipt.fiscalSign ?? refData.fiscalDocumentSign),
			orgName: optStr(receipt.user),
			buyerPhoneOrAddress: optStr(receipt.buyerPhoneOrAddress),
			sellerAddress: optStr(receipt.sellerAddress),
		},
		raw: data,
	}
}

function parseRefText(refText: string): Record<string, string | null> {
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

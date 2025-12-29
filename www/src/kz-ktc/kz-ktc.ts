import { Receipt, ReceiptData } from '../receipts'
import { optStr, onError, urlWithoutProtocol, OptStr, isRecord, optArr, optNum } from '../utils'

/** https://online.zakon.kz/Document/?doc_id=35619701 */
type KzKtcExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kkmSerialNumber: OptStr
	/** Код ККМ, РНМ, регистрационный номер ККМ */
	kkmFnsId: OptStr
	/** ФП, фискальный признак ККМ */
	fiscalId: OptStr
	/** БИН, Бизнес-идентификационный номер организации */
	orgId: OptStr
}
export function getKzKtcReceiptDataFrom(rec: Receipt): ReceiptData<{ kzKtc: KzKtcExtraData }> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	const ticket = isRecord(data.ticket) ? data.ticket : {}
	const refData = parseKzKtcRefText(rec.refText)

	// Фильтруем только товарные позиции (itemType === 1)
	const productItems = optArr(ticket.items, []).filter(x => isRecord(x) && x.itemType === 1)

	return {
		common: {
			title: makeKzKtcReceiptTitle(optStr(data.orgTitle)),
			totalSum: optNum(ticket.totalSum),
			itemsCount: productItems.length,
			placeName: optStr(data.orgTitle),
			orgInn: optStr(data.orgId),
			address: optStr(data.retailPlaceAddress),
			cashierName: isRecord(ticket.operator) ? optStr(ticket.operator.name) : undefined,
			shiftNumber: optStr(ticket.shiftNumber),
			taxOrgUrl: urlWithoutProtocol(rec.refText),
			items: productItems.map(item => {
				const x = isRecord(item) && isRecord(item.commodity) ? item : { name: item }
				return {
					name: optStr(x.name),
					quantity: optNum(x.quantity),
					price: optNum(x.price),
					sum: optNum(x.sum),
				}
			}),
			parseErrors: [],
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

export function makeKzKtcReceiptTitle(orgTitle: OptStr): OptStr {
	if (!orgTitle) return orgTitle
	return orgTitle
		.replace(/^товарищество с ограниченной ответственностью\s+/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

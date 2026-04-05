import { Receipt } from '../api'
import { parseKzRefText } from '../kz-common'
import { ReceiptData } from '../receipts'
import { isRecord, optArr, optNum, OptStr, optStr } from '../utils'

/** https://online.zakon.kz/Document/?doc_id=35619701 */
type KzKtcExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kz_kkmSerialNumber: OptStr
	/** Код ККМ, РНМ, регистрационный номер ККМ */
	kz_kkmFnsId: OptStr
	/** ФП, фискальный признак ККМ */
	kz_fiscalId: OptStr
	/** БИН, Бизнес-идентификационный номер организации */
	kz_orgId: OptStr
}
export function getKzKtcReceiptDataFrom(rec: Receipt): ReceiptData<KzKtcExtraData> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	const ticket = isRecord(data.ticket) ? data.ticket : {}
	const refData = parseKzRefText(rec.refText)

	// Фильтруем только товарные позиции (itemType === 1)
	const productItems = optArr(ticket.items, []).filter(x => isRecord(x) && x.itemType === 1)

	return {
		common: {
			title: makeKzKtcReceiptTitle(optStr(data.orgTitle)),
			totalSum: optNum(ticket.totalSum),
			itemsCount: productItems.length,
			placeName: optStr(data.orgTitle),
			orgInn: optStr(data.orgId),
			orgInnLabel: { text: 'БИН', title: 'Бизнес-идентификационный номер организации' },
			address: optStr(data.retailPlaceAddress),
			cashierName: isRecord(ticket.operator) ? optStr(ticket.operator.name) : undefined,
			shiftNumber: optStr(ticket.shiftNumber),
			taxOrgUrl: undefined,
			items: productItems.map(item => {
				const x = isRecord(item) && isRecord(item.commodity) ? item.commodity : { name: item }
				return {
					name: optStr(x.name),
					quantity: optNum(x.quantity),
					price: optNum(x.price),
					sum: optNum(x.sum),
				}
			}),
		},
		extra: {
			kz_kkmSerialNumber: optStr(data.kkmSerialNumber),
			kz_kkmFnsId: optStr(data.kkmFnsId ?? refData?.kkmFnsId),
			kz_fiscalId: optStr(ticket.fiscalId ?? refData?.fiscalId),
			kz_orgId: optStr(data.orgId),
		},
		parseErrors: [],
		raw: data,
	}
}

export function makeKzKtcReceiptTitle(orgTitle: OptStr): OptStr {
	if (!orgTitle) return orgTitle
	return orgTitle
		.replace(/^товарищество с ограниченной ответственностью\s+/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

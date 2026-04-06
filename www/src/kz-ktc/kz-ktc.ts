import { Receipt } from '../api'
import { makeKzReceiptTitle, parseKzRefText } from '../kz-common'
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
			title: makeKzReceiptTitle(optStr(data.orgTitle)),

			items: productItems.map(item => {
				const x = isRecord(item) && isRecord(item.commodity) ? item.commodity : { name: item }
				return {
					name: optStr(x.name),
					quantity: optNum(x.quantity),
					price: optNum(x.price),
					sum: optNum(x.sum),
				}
			}),
			itemsCount: productItems.length,
			totalSum: optNum(ticket.totalSum),

			orgName: undefined,
			placeName: optStr(data.orgTitle),
			placeAddress: optStr(data.retailPlaceAddress),

			cashierName: isRecord(ticket.operator) ? optStr(ticket.operator.name) : undefined,
			cashierCode: undefined,
			shiftNumber: optStr(ticket.shiftNumber),

			taxOrgUrl: undefined,
			checkOrgUrl: undefined,
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

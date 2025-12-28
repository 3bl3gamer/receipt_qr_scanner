import { Receipt, ReceiptData } from '../receipts'
import { optStr, onError, urlWithoutProtocol } from '../utils'

type KzKtcExtraData = {
	kkmSerialNumber: ReturnType<typeof optStr>
	kkmFnsId: ReturnType<typeof optStr>
	fiscalId: ReturnType<typeof optStr>
	orgId: ReturnType<typeof optStr>
}
export function getKzKtcReceiptDataFrom(rec: Receipt): ReceiptData<{ kzKtc: KzKtcExtraData }> {
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
			taxOrgUrl: urlWithoutProtocol(rec.refText),
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

export function makeKzKtcReceiptTitle(orgTitle: string): string {
	return orgTitle
		.replace(/товарищество с ограниченной ответственностью\s+/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

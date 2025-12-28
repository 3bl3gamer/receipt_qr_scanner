import { Receipt, ReceiptData } from '../receipts'
import { optStr, onError, urlWithoutProtocol } from '../utils'

type KgGnsExtraData = {
	/** РН ККМ, регистрационный номер контрольно-кассовой машины */
	kktRegNumber: ReturnType<typeof optStr>
	/** ФМ, серийный номер фискального модуля */
	fiscalModuleSerialNumber: ReturnType<typeof optStr>
	/** ФД, номер фискального документа */
	fiscalDocumentNumber: ReturnType<typeof optStr>
	/** ФПД, фискальный признак документа */
	fiscalDocumentSign: ReturnType<typeof optStr>
}
export function getKgGnsReceiptDataFrom(rec: Receipt): ReceiptData<{ kgGns: KgGnsExtraData }> {
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
			taxOrgUrl: urlWithoutProtocol(rec.refText),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			items: (data.items as any[]).map(x => ({
				name: x.goodName,
				quantity: x.goodQuantity,
				price: x.goodPrice / 100,
				sum: x.goodCost / 100,
			})),
		},
		kgGns: {
			kktRegNumber: optStr(data.crRegisterNumber ?? refData?.kktRegNumber),
			fiscalModuleSerialNumber: optStr(data.fnSerialNumber ?? refData?.fiscalModuleSerialNumber),
			fiscalDocumentNumber: optStr(data.fdNumber ?? refData?.fiscalDocumentNumber),
			fiscalDocumentSign: optStr(data.documentFiscalMark ?? refData?.fiscalDocumentSign),
		},
		raw: data,
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
	// описания поей в kg_gns.ReceiptRefData
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

export function makeKgGnsReceiptTitle(locationName: string): string {
	return locationName
		.replace(/^осоо(?=\W)/i, '')
		.replace(/^магазин\s/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

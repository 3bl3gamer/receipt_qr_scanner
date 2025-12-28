import { Receipt, ReceiptData } from '../receipts'
import { optStr, onError, urlWithoutProtocol } from '../utils'

/** https://www.sti.gov.kg/docs/default-source/kkm/form_fd.pdf */
type KgGnsExtraData = {
	kktRegNumber: ReturnType<typeof optStr>
	fiscalModuleSerialNumber: ReturnType<typeof optStr>
	fiscalDocumentNumber: ReturnType<typeof optStr>
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
			// https://www.sti.gov.kg/docs/default-source/kkm/form_fd.pdf
			kktRegNumber: optStr(data.crRegisterNumber ?? refData?.kktRegNumber), //РН ККМ, регистрационный номер ККМ
			fiscalModuleSerialNumber: optStr(data.fnSerialNumber ?? refData?.fiscalModuleSerialNumber), //ФМ, серийный номер фискального модуля
			fiscalDocumentNumber: optStr(data.fdNumber ?? refData?.fiscalDocumentNumber), //ФД, номер фискального документа
			fiscalDocumentSign: optStr(data.documentFiscalMark ?? refData?.fiscalDocumentSign), //ФПД, фискальный признак документа
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

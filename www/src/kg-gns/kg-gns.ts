import { Receipt } from '../api'
import { ReceiptData } from '../receipts'
import { divBy100, isRecord, onError, optArr, optNum, OptStr, optStr, urlWithoutProtocol } from '../utils'

type KgGnsExtraData = {
	/** РН ККМ, регистрационный номер контрольно-кассовой машины */
	kktRegNumber: OptStr
	/** ФМ, серийный номер фискального модуля */
	fiscalModuleSerialNumber: OptStr
	/** ФД, номер фискального документа */
	fiscalDocumentNumber: OptStr
	/** ФПД, фискальный признак документа */
	fiscalDocumentSign: OptStr
}
export function getKgGnsReceiptDataFrom(rec: Receipt): ReceiptData<{ kgGns: KgGnsExtraData }> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	const data_crData = isRecord(data.crData) ? data.crData : {}
	const refData = parseKgGnsRefText(rec.refText)
	return {
		common: {
			title: makeKgGnsReceiptTitle(optStr(data_crData.locationName)),
			totalSum: optNum(data.ticketTotalSum, divBy100),
			itemsCount: optArr(data.items)?.length,
			placeName: optStr(data_crData.locationName),
			orgInn: optStr(data.tin),
			address: optStr(data_crData.locationAddress),
			cashierName: optStr(data_crData.cashierName),
			shiftNumber: optStr(data_crData.shiftNumber),
			taxOrgUrl: urlWithoutProtocol(rec.refText),
			items: optArr(data.items, []).map(item => {
				const x = isRecord(item) ? item : { name: item }
				return {
					name: optStr(x.goodName),
					quantity: optNum(x.goodQuantity),
					price: optNum(x.goodPrice, divBy100),
					sum: optNum(x.goodCost, divBy100),
				}
			}),
			parseErrors: [],
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

export function makeKgGnsReceiptTitle(locationName: OptStr): OptStr {
	if (!locationName) return locationName
	return locationName
		.replace(/^осоо(?=\W)/i, '')
		.replace(/^магазин\s/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

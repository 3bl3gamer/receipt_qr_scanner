import { Receipt } from './api'
import { getKgGnsReceiptDataFrom } from './kg-gns/kg-gns'
import { getKzBeeReceiptDataFrom } from './kz-bee/kz-bee'
import { getKzJusReceiptDataFrom } from './kz-jus/kz-jus'
import { getKzKtcReceiptDataFrom } from './kz-ktc/kz-ktc'
import { getKzTtcReceiptDataFrom } from './kz-ttc/kz-ttc'
import { getKzWfdReceiptDataFrom } from './kz-wfd/kz-wfd'
import { getRuFnsReceiptDataFrom } from './ru-fns/ru-fns'
import { OptNum, OptStr } from './utils'

export type ReceiptData<T extends Record<string, unknown>> = {
	common: CommonReceiptData
	extra: T
	parseErrors: string[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	raw: any
}

export type CommonReceiptData = {
	title: OptStr
	totalSum: OptNum
	itemsCount: OptNum
	placeName: OptStr
	orgInn: OptStr
	orgInnLabel: { text: string; title: OptStr }
	address: OptStr
	cashierName: OptStr
	shiftNumber: OptStr
	taxOrgUrl: OptStr
	items: {
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}[]
}

export type FullReceiptData = ReturnType<(typeof domainParsersMap)[keyof typeof domainParsersMap]>

const domainParsersMap = {
	'ru-fns': getRuFnsReceiptDataFrom,
	'kg-gns': getKgGnsReceiptDataFrom,
	'kz-ktc': getKzKtcReceiptDataFrom,
	'kz-jus': getKzJusReceiptDataFrom,
	'kz-ttc': getKzTtcReceiptDataFrom,
	'kz-bee': getKzBeeReceiptDataFrom,
	'kz-wfd': getKzWfdReceiptDataFrom,
}

export function getReceiptDataFrom(rec: Receipt): FullReceiptData | null {
	if (!rec.data) return null
	const parser = domainParsersMap[rec.domain as keyof typeof domainParsersMap]
	if (!parser) return null
	return parser(rec)
}

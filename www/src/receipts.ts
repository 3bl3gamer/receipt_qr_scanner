import { Receipt } from './api'
import { getKgGnsReceiptDataFrom } from './kg-gns/kg-gns'
import { getKzJusReceiptDataFrom } from './kz-jus/kz-jus'
import { getKzKtcReceiptDataFrom } from './kz-ktc/kz-ktc'
import { getKzTtcReceiptDataFrom } from './kz-ttc/kz-ttc'
import { getRuFnsReceiptDataFrom } from './ru-fns/ru-fns'
import { OptNum, OptStr } from './utils'

export type ReceiptData<T> = {
	common: CommonReceiptData
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	raw: any
} & T

export type CommonReceiptData = {
	title: OptStr
	totalSum: OptNum
	itemsCount: OptNum
	placeName: OptStr
	orgInn: OptStr
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
	parseErrors: string[]
}

export type FullReceiptData = Exclude<ReturnType<typeof getReceiptDataFrom>, null>

export function getReceiptDataFrom(rec: Receipt) {
	if (!rec.data) return null
	if (rec.domain === 'ru-fns') return getRuFnsReceiptDataFrom(rec)
	if (rec.domain === 'kg-gns') return getKgGnsReceiptDataFrom(rec)
	if (rec.domain === 'kz-ktc') return getKzKtcReceiptDataFrom(rec)
	if (rec.domain === 'kz-jus') return getKzJusReceiptDataFrom(rec)
	if (rec.domain === 'kz-ttc') return getKzTtcReceiptDataFrom(rec)
	return null
}

import { getKzKtcReceiptDataFrom } from 'kz-ktc/kz-ktc'
import { getKzJusReceiptDataFrom } from 'kz-jus/kz-jus'
import { getKgGnsReceiptDataFrom } from 'kg-gns/kg-gns'
import { getRuFnsReceiptDataFrom } from './ru-fns/ru-fns'

export type Receipt = {
	id: number
	domain: string
	savedAt: string
	updatedAt: string
	createdAt: string
	refText: string
	isCorrect: boolean
	data: string
	searchKey: string
	retriesLeft: number
	nextRetryAt: string
}

export type ReceiptData<T> = {
	common: CommonReceiptData
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	raw: any
} & T

export type CommonReceiptData = {
	title: string
	totalSum: number | undefined
	itemsCount: number | undefined
	placeName: string | undefined
	orgInn: string | undefined
	address: string | undefined
	cashierName: string | undefined
	shiftNumber: string | undefined
	taxOrgUrl: string | undefined
	items: {
		name: string | undefined
		quantity: number | undefined
		price: number | undefined
		sum: number | undefined
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
	return null
}

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

type CommonReceiptData = {
	/** Заголовок для интерфейса (название магазина/организации без лишних префиксов типа "Магазин", "ООО" и т.д.) */
	title: OptStr

	items: {
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}[]
	/** На случай, если items не получилось распарсить, но общее кол-во известно */
	itemsCount: OptNum
	totalSum: OptNum

	/** Название оргианизции (ООО МТС / ИП Иванов / ...) */
	orgName: OptStr
	/** Назвние места продажи (Магазин Такой-то / Аптека Такая-то / ...) */
	placeName: OptStr
	placeAddress: OptStr

	cashierName: OptStr
	cashierCode: OptStr
	shiftNumber: OptStr

	/** Адрес сайта налоговой (nalog.gov.ru) */
	taxOrgUrl: OptStr
	/** Адрес сайта для проверки подобных чеков (consumer.wofd.kz) */
	checkOrgUrl: OptStr
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

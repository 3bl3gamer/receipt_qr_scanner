import { Receipt } from '../api'
import { ReceiptData } from '../receipts'
import { OptNum, OptStr, optStr } from '../utils'

type KzTtcExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kkmSerialNumber: OptStr
	/** РНМ, регистрационный номер ККМ */
	kkmFnsId: OptStr
	/** ФП, фискальный признак */
	fiscalId: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	orgId: OptStr
	/** Порядковый номер чека */
	receiptNumber: OptStr
}

type ParsedReceipt = {
	orgName: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	orgId: OptStr
	/** Порядковый номер чека */
	receiptNumber: OptStr
	/** ФП, фискальный признак */
	fiscalId: OptStr
	/** ЗНМ, заводской номер ККМ */
	kkmSerialNumber: OptStr
	/** РНМ, регистрационный номер ККМ */
	kkmFnsId: OptStr
	totalSum: OptNum
	address: OptStr
	items: Array<{
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}>
	parseErrors: string[]
}

export function getKzTtcReceiptDataFrom(rec: Receipt): ReceiptData<{ kzTtc: KzTtcExtraData }> {
	const parsed = parseKzTtcReceipt(rec.data)
	const refData = parseKzTtcRefText(rec.refText)

	return {
		common: {
			title: makeKzTtcReceiptTitle(parsed.orgName),
			totalSum: parsed.totalSum,
			itemsCount: parsed.items.length,
			placeName: parsed.orgName,
			orgInn: parsed.orgId,
			orgInnLabel: { text: 'БИН', title: 'Бизнес-идентификационный номер организации' },
			address: parsed.address,
			cashierName: undefined,
			shiftNumber: undefined,
			taxOrgUrl: undefined,
			items: parsed.items,
			parseErrors: parsed.parseErrors,
		},
		kzTtc: {
			kkmSerialNumber: optStr(parsed.kkmSerialNumber),
			kkmFnsId: optStr(parsed.kkmFnsId ?? refData?.kkmFnsId),
			fiscalId: optStr(parsed.fiscalId ?? refData?.fiscalId),
			orgId: optStr(parsed.orgId),
			receiptNumber: optStr(parsed.receiptNumber),
		},
		raw: rec.data,
	}
}

export function parseKzTtcReceipt(html: string): ParsedReceipt {
	const result: ParsedReceipt = {
		orgName: undefined,
		orgId: undefined,
		receiptNumber: undefined,
		fiscalId: undefined,
		kkmSerialNumber: undefined,
		kkmFnsId: undefined,
		totalSum: undefined,
		address: undefined,
		items: [],
		parseErrors: [],
	}

	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')

	// скрытые элементы
	const fiscalMark = doc.querySelector('.ticket_fiscal_mark')?.textContent?.trim()
	if (fiscalMark) {
		result.fiscalId = fiscalMark
	}
	const stateNumber = doc.querySelector('.ticket_state_number')?.textContent?.trim()
	if (stateNumber) {
		result.kkmFnsId = stateNumber
	}

	// хедер
	const ticketHeader = doc.querySelector('.ticket_header')
	if (ticketHeader) {
		const headerHtml = ticketHeader.innerHTML

		const orgNameSpan = ticketHeader.querySelector('div:first-child > span')
		if (orgNameSpan) {
			result.orgName = orgNameSpan.textContent?.trim()
		}

		const orgIdMatch = headerHtml.match(/ЖСН\/БСН.*?ИИН\/БИН\s*:.*?<span[^>]*>\s*(\d+)/s)
		if (orgIdMatch) {
			result.orgId = orgIdMatch[1]
		}

		const kkmFnsIdMatch = headerHtml.match(/МТН\s*\/\s*РНМ:\s*<span[^>]*>([^<]+)/)
		if (kkmFnsIdMatch) {
			result.kkmFnsId = kkmFnsIdMatch[1].trim()
		}

		const kkmSerialMatch = headerHtml.match(/МЗН\s*\/\s*ЗНМ:\s*<span[^>]*>([^<]+)/)
		if (kkmSerialMatch) {
			result.kkmSerialNumber = kkmSerialMatch[1].trim()
		}

		const receiptNumMatch = headerHtml.match(/Чек нөмірі\s*\/\s*Номер чека:\s*<span[^>]*>([^<]+)/)
		if (receiptNumMatch) {
			result.receiptNumber = receiptNumMatch[1].trim()
		}

		const addressMatch = headerHtml.match(/Мекен-жайы\s*\/\s*Адрес:\s*<span[^>]*>([^<]+)</)
		if (addressMatch) {
			result.address = addressMatch[1].trim()
		}
	}

	// список товаров
	const itemElements = doc.querySelectorAll('.ready_ticket__items_list li')
	Array.from(itemElements).forEach((li, index) => {
		const nameSpan = li.querySelector('span.wb-all')
		const name = nameSpan?.textContent?.trim()

		const itemDiv = li.querySelector('.ready_ticket__item')
		if (!itemDiv) {
			if (name) {
				result.parseErrors.push(`Товар ${index + 1}: не найден блок с ценой`)
			}
			return
		}

		const itemText = itemDiv.textContent || ''

		// числа могу быть и спробелами/переносами: "3 960.00 x 0.5 кг = 1 980.00"
		const match = itemText.match(
			/([\d\s]+[.,]?\d*)\s*x\s*([\d\s]+[.,]?\d*)\s*\S+\s*=\s*([\d\s]+[.,]?\d*)/,
		)

		if (match) {
			result.items.push({
				name,
				price: parseKzAmount(match[1]),
				quantity: parseKzAmount(match[2]),
				sum: parseKzAmount(match[3]),
			})
		} else {
			result.parseErrors.push(`Товар ${index + 1}: не распознан формат "${itemText.slice(0, 50)}"`)
		}
	})

	// итого
	const totalSpan = doc.querySelector('.ticket_total')
	if (totalSpan) {
		result.totalSum = parseKzAmount(totalSpan.textContent || '')
	}

	return result
}

function parseKzTtcRefText(refText: string): Record<string, string | null> | null {
	try {
		const url = new URL(refText)
		return {
			fiscalId: url.searchParams.get('i'),
			kkmFnsId: url.searchParams.get('f'),
			sum: url.searchParams.get('s'),
			createdAt: url.searchParams.get('t'),
		}
	} catch {
		return null
	}
}

export function makeKzTtcReceiptTitle(orgName: OptStr): OptStr {
	if (!orgName) return orgName

	let cleaned = orgName.trim()
	cleaned = cleaned.replace(/^филиал\s+товарищества\s+с\s+ограниченной\s+ответственностью\s+/i, '')
	cleaned = cleaned.replace(/^товарищество с ограниченной ответственностью\s+/i, '')
	cleaned = cleaned.replace(/^ТОО\s+/i, '')
	cleaned = cleaned.replace(/^ФИЛИАЛ\s+/i, '')

	cleaned = cleaned.replace(/^"([^"]*)"$/, '$1')

	return cleaned.trim()
}

/** "4 920,50" or "3180.00" -> 4920.5 */
function parseKzAmount(str: string): number | undefined {
	if (!str) return undefined
	const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.')
	const num = parseFloat(cleaned)
	return isNaN(num) ? undefined : num
}

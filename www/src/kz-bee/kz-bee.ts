import { Receipt } from '../api'
import { makeKzReceiptTitle, parseKzRefText } from '../kz-common'
import { ReceiptData } from '../receipts'
import { OptNum, OptStr, optStr } from '../utils'

type KzBeeExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kz_kkmSerialNumber: OptStr
	/** РНМ, регистрационный номер ККМ */
	kz_kkmFnsId: OptStr
	/** ФП, фискальный признак */
	kz_fiscalId: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	kz_orgId: OptStr
}

type ParsedReceipt = {
	orgName: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	orgId: OptStr
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

export function getKzBeeReceiptDataFrom(rec: Receipt): ReceiptData<KzBeeExtraData> {
	const parsed = parseKzBeeReceipt(rec.data)
	const refData = parseKzRefText(rec.refText)

	return {
		common: {
			title: makeKzReceiptTitle(parsed.orgName),

			items: parsed.items,
			itemsCount: parsed.items.length,
			totalSum: parsed.totalSum,

			orgName: undefined,
			placeName: parsed.orgName,
			placeAddress: parsed.address,

			cashierName: undefined,
			cashierCode: undefined,
			shiftNumber: undefined,

			taxOrgUrl: undefined,
			checkOrgUrl: undefined,
		},
		extra: {
			kz_kkmSerialNumber: optStr(parsed.kkmSerialNumber),
			kz_kkmFnsId: optStr(parsed.kkmFnsId ?? refData?.kkmFnsId),
			kz_fiscalId: optStr(parsed.fiscalId ?? refData?.fiscalId),
			kz_orgId: optStr(parsed.orgId),
		},
		parseErrors: parsed.parseErrors,
		raw: rec.data,
	}
}

export function parseKzBeeReceipt(html: string): ParsedReceipt {
	const result: ParsedReceipt = {
		orgName: undefined,
		orgId: undefined,
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

	// скрытые элементы с фискальными данными
	const fiscalMark = doc.querySelector('.ticket_fiscal_mark')?.textContent?.trim()
	if (fiscalMark) {
		result.fiscalId = fiscalMark
	}
	const stateNumber = doc.querySelector('.ticket_state_number')?.textContent?.trim()
	if (stateNumber) {
		result.kkmFnsId = stateNumber
	}

	// хедер: в kz-bee поля лежат прямо в тексте div-ов (без span-ов)
	const ticketHeader = doc.querySelector('.ticket_header')
	if (ticketHeader) {
		const headerDivs = ticketHeader.querySelectorAll(':scope > div')
		for (const div of Array.from(headerDivs)) {
			const text = div.textContent?.trim() || ''

			// Название организации — первый div
			if (!result.orgName && div === headerDivs[0]) {
				result.orgName = text
				continue
			}

			const binMatch = text.match(/ИИН\/БИН\s*:\s*(\d+)/)
			if (binMatch) {
				result.orgId = binMatch[1]
				continue
			}

			const fnsIdMatch = text.match(/МТН\s*\/\s*РНМ\s*:\s*(\S+)/)
			if (fnsIdMatch) {
				result.kkmFnsId = fnsIdMatch[1]
				continue
			}

			const serialMatch = text.match(/МЗН\s*\/\s*ЗНМ\s*:\s*(\S+)/)
			if (serialMatch) {
				result.kkmSerialNumber = serialMatch[1]
				continue
			}

			const addressMatch = text.match(/Мекен-жайы\s*\/\s*Адрес\s*:\s*([\s\S]+)/)
			if (addressMatch) {
				result.address = addressMatch[1].trim()
				continue
			}
		}
	}

	// список товаров
	const itemElements = doc.querySelectorAll('.ready_ticket__items_list li')
	Array.from(itemElements).forEach((li, index) => {
		const itemDiv = li.querySelector('.ready_ticket__item')
		if (!itemDiv) return

		// убираем GTIN из <b>, чтобы он не попал в текст для парсинга цены
		const itemClone = itemDiv.cloneNode(true) as Element
		for (const b of Array.from(itemClone.querySelectorAll('b'))) b.remove()
		const itemText = itemClone.textContent || ''

		// пропускаем строки-скидки: "226 ₸ (скидка)  226.00"
		if (/скидка/i.test(itemText)) return

		// название товара — текст до первого дочернего элемента (<small>, <br>, <div>)
		const name = getItemName(li)

		// числа: "1675.00 x 1 шт = 1675.00"
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
		} else if (name) {
			result.parseErrors.push(
				`Товар ${index + 1}: не распознан формат "${itemText.trim().slice(0, 50)}"`,
			)
		}
	})

	// итого
	const totalSpan = doc.querySelector('.ticket_total')
	if (totalSpan) {
		result.totalSum = parseKzAmount(totalSpan.textContent || '')
	}

	return result
}

/** Извлекает название товара из текстовых узлов <li> (до первого дочернего элемента) */
function getItemName(li: Element): OptStr {
	let name = ''
	for (const node of Array.from(li.childNodes)) {
		if (node.nodeType === 3 /* TEXT_NODE */) {
			name += node.textContent
		} else {
			break
		}
	}
	const trimmed = name.trim()
	return trimmed || undefined
}

/** "4 920,50" or "3180.00" -> 4920.5 */
function parseKzAmount(str: string): number | undefined {
	if (!str) return undefined
	const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.')
	const num = parseFloat(cleaned)
	return isNaN(num) ? undefined : num
}

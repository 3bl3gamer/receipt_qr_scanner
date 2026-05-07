import { Receipt } from '../api'
import { makeKzReceiptTitle, parseKzRefText } from '../kz-common'
import { ReceiptData } from '../receipts'
import { isRecord, optArr, OptNum, OptStr, optStr } from '../utils'

type KzWfdExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kz_kkmSerialNumber: OptStr
	/** РНМ, регистрационный номер ККМ */
	kz_kkmFnsId: OptStr
	/** КСН/ИНК, идентификационный номер кассы */
	kz_kkmInkNumber: OptStr
	/** ФП, фискальный признак */
	kz_fiscalId: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	kz_orgId: OptStr
	/** Порядковый номер чека */
	kz_receiptNumber: OptStr
}

type ParsedReceipt = {
	orgName: OptStr
	orgId: OptStr
	receiptNumber: OptStr
	shiftNumber: OptStr
	fiscalId: OptStr
	cashierCode: OptStr
	kkmSerialNumber: OptStr
	kkmInkNumber: OptStr
	kkmFnsId: OptStr
	totalSum: OptNum
	address: OptStr
	checkOrgUrl: OptStr
	items: Array<{
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}>
	parseErrors: string[]
}

export function getKzWfdReceiptDataFrom(rec: Receipt): ReceiptData<KzWfdExtraData> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	// в kz-wfd поле ticket лежит на верхнем уровне (не под data)
	const lines = optArr(data.ticket, [])

	const parsed = parseKzWfdReceipt(lines)
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
			cashierCode: parsed.cashierCode,
			shiftNumber: parsed.shiftNumber,

			taxOrgUrl: undefined,
			checkOrgUrl: parsed.checkOrgUrl,
		},
		extra: {
			kz_kkmSerialNumber: optStr(parsed.kkmSerialNumber),
			kz_kkmFnsId: optStr(parsed.kkmFnsId ?? refData?.kkmFnsId),
			kz_kkmInkNumber: optStr(parsed.kkmInkNumber),
			kz_fiscalId: optStr(parsed.fiscalId ?? refData?.fiscalId),
			kz_orgId: optStr(parsed.orgId),
			kz_receiptNumber: optStr(parsed.receiptNumber),
		},
		parseErrors: parsed.parseErrors,
		raw: data,
	}
}

export function parseKzWfdReceipt(lines: unknown[]): ParsedReceipt {
	const result: ParsedReceipt = {
		orgName: undefined,
		orgId: undefined,
		receiptNumber: undefined,
		shiftNumber: undefined,
		fiscalId: undefined,
		cashierCode: undefined,
		kkmSerialNumber: undefined,
		kkmInkNumber: undefined,
		kkmFnsId: undefined,
		totalSum: undefined,
		address: undefined,
		checkOrgUrl: undefined,
		items: [],
		parseErrors: [],
	}

	// Собираем строки неиспользованного текста между распознанными полями.
	// При встрече строки с кол-вом товара все накопленные строки склеиваются в название.
	const unusedLines: { index: number; text: string }[] = []
	let lastSeparatorLineI = -1
	let lastItemQuantityLineI = -1
	let lastItemRelatedLineI = -1
	let nonEmptyLinesCount = 0
	// Метка: следующая непустая строка — номер чека
	let expectReceiptNumber = false
	// Футер: адрес, ОФД инфо
	// Фазы: 'kz_address' → 'ru_address' → 'after_address'
	let footerPhase: 'kz_address' | 'ru_address' | 'after_address' | null = null
	const skippedKzAddressLines: string[] = []
	let addressLines: string[] | null = null

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		let text: string
		if (isRecord(line) && typeof line.text === 'string') {
			text = line.text.trim()
		} else {
			result.parseErrors.push(`Некорректная строка ${i + 1}: ${JSON.stringify(line)}`)
			continue
		}

		if (text === '') continue
		nonEmptyLinesCount += 1

		// Название организации (первая непустая строка)
		if (!result.orgName && nonEmptyLinesCount === 1) {
			result.orgName = text
			continue
		}

		const binMatch = text.match(/^БСН\/БИН\s+(\d+)$/i)
		if (binMatch) {
			result.orgId = binMatch[1]
			continue
		}

		// "Сату/Продажа" или "Продажа"
		if (/^(Сату\/)?Продажа$/i.test(text)) {
			continue
		}

		// Номер чека: метка + значение на одной строке или на двух
		const receiptNumberInlineMatch = text.match(/^Чектің реттік нөмірі\/Порядковый номер чека\s+(\S+)$/i)
		if (receiptNumberInlineMatch) {
			result.receiptNumber = receiptNumberInlineMatch[1]
			continue
		}
		if (/^Чектің реттік нөмірі\/Порядковый номер чека$/i.test(text)) {
			expectReceiptNumber = true
			continue
		}
		if (expectReceiptNumber) {
			expectReceiptNumber = false
			result.receiptNumber = text
			continue
		}

		const shiftMatch = text.match(/^Ауысым\/Смена\s+№(\S+)$/i)
		if (shiftMatch) {
			result.shiftNumber = shiftMatch[1]
			continue
		}

		const fiscalMatch = text.match(/^Фискалдық белгі\/Фискальный признак:\s*(\S+)$/i)
		if (fiscalMatch) {
			result.fiscalId = fiscalMatch[1]
			continue
		}

		const cashierCodeMatch = text.match(/^КАССИР КОДЫ\/КОД КАССИРА\s+(\S+)$/)
		if (cashierCodeMatch) {
			result.cashierCode = cashierCodeMatch[1]
			continue
		}

		// Имя кассира — пропускаем
		if (/^КАССИР\/КАССИР\s/i.test(text)) {
			continue
		}

		if (/^УАҚЫТЫ\/ВРЕМЯ:\s/.test(text)) {
			continue
		}

		// заводской номер ККМ, идентификационный номер кассы
		const kkmMatch = text.match(/^КЗН\/ЗНМ\s+(\S+)\s+КСН\/ИНК\s+(\S+)$/)
		if (kkmMatch) {
			result.kkmSerialNumber = kkmMatch[1]
			result.kkmInkNumber = kkmMatch[2]
			continue
		}

		// регистрационный номер ККМ
		const regMatch = text.match(/^КТН\/РНМ\s+(\d+)$/)
		if (regMatch) {
			result.kkmFnsId = regMatch[1]
			continue
		}

		// строки-разделители (*** или ---)
		if (/^[-*=]+$/.test(text)) {
			lastSeparatorLineI = i
			continue
		}

		// кол-во и цена товара: "1 (Дана/Штука) x 15 000,00₸ = 15 000,00₸"
		const itemMatch = text.match(
			/^(\d+(?:[.,]\d+)?)\s*\(([^)]+)\)\s*x\s*([\d\s\u00A0]+[,.]?\d*)\s*₸\s*=\s*([\d\s\u00A0]+[,.]?\d*)\s*₸$/,
		)
		if (itemMatch) {
			lastItemQuantityLineI = i
			lastItemRelatedLineI = i
			// Все накопленные строки — это название товара (может быть на нескольких строках)
			if (unusedLines.length > 0) {
				const name = unusedLines.map(l => l.text).join(' ')
				unusedLines.length = 0
				result.items.push({
					name,
					quantity: parseFloat(itemMatch[1].replace(',', '.')),
					price: parseKzAmount(itemMatch[3]),
					sum: parseKzAmount(itemMatch[4]),
				})
				continue
			}
		}

		// GTIN / NTIN после строки с кол-вом товара
		if (/^[GN]TIN:\s*\d+$/i.test(text) && i === lastItemRelatedLineI + 1) {
			lastItemRelatedLineI = i
			continue
		}

		// ҚҚС/НДС товара
		if (/^ҚҚС\/НДС\s+([\d\s\u00A0]+[,.]?\d*)\s*₸$/i.test(text) && i === lastItemRelatedLineI + 1) {
			lastItemRelatedLineI = i
			continue
		}

		// "БАРЛЫҒЫ/ИТОГО:" — общая сумма; значение может быть на той же или на следующей строке
		if (/^БАРЛЫҒЫ\/ИТОГО:/i.test(text)) {
			const inlineMatch = text.match(/^БАРЛЫҒЫ\/ИТОГО:\s*([\d\s\u00A0]+[,.]?\d*)\s*₸$/i)
			if (inlineMatch) {
				result.totalSum = parseKzAmount(inlineMatch[1])
			} else {
				// Ищем следующую непустую строку с суммой
				for (let j = i + 1; j < lines.length; j++) {
					const nextLine = lines[j]
					if (isRecord(nextLine) && typeof nextLine.text === 'string') {
						const nextText = nextLine.text.trim()
						if (nextText === '') continue
						const amountMatch = nextText.match(/^([\d\s\u00A0]+[,.]?\d*)\s*₸$/)
						if (amountMatch) {
							result.totalSum = parseKzAmount(amountMatch[1])
							i = j // перемещаемся к обработанной строке
						}
						break
					}
				}
			}
			continue
		}

		// Строки с суммами оплаты, сдачи, скидки, наценки — пропускаем.
		// Могут быть на одной строке (с суммой) или на двух (метка, потом сумма).
		const paymentLabels = [
			'чек бойынша төленген сома',
			'оплаты по чеку',
			'банк картасы/банковская карта',
			'төлемнен кейінгі қайтарым сомасы',
			'после оплаты',
			'жалпы жеңілдік сомасы',
			'жалпы үстеме сомасы',
			'ққс сомасы/сумма ндс',
			'ққс жалпы сомасы',
		]
		const lower = text.toLocaleLowerCase()
		let isPayment = false
		for (const label of paymentLabels) {
			if (lower.startsWith(label)) {
				isPayment = true
				break
			}
		}
		if (isPayment) continue

		// Блок после разделителя (который после товаров): адрес, ОФД инфо, URL
		if (
			lastSeparatorLineI !== -1 &&
			i > lastSeparatorLineI &&
			lastSeparatorLineI > lastItemQuantityLineI &&
			result.items.length > 0
		) {
			if (!footerPhase) footerPhase = 'kz_address'

			// Ссылка на чек (style:2) — пропускаем в любой фазе
			if (isRecord(line) && line.style === 2) {
				continue
			}

			const hasKnownPrefix = /^(ФДО|ОФД|Сайт):/i.test(text)

			// Фаза 1: адрес на казахском — строки без известных префиксов и без "г."
			if (footerPhase === 'kz_address') {
				if (/^г\./i.test(text)) {
					// начало адреса на русском
					footerPhase = 'ru_address'
					addressLines = [text]
					continue
				}
				if (!hasKnownPrefix) {
					skippedKzAddressLines.push(text)
					continue
				}
				// Известный префикс без адреса на русском — переходим дальше
				footerPhase = 'after_address'
			}

			// Фаза 2: адрес на русском — до строки с известным префиксом
			if (footerPhase === 'ru_address') {
				if (!hasKnownPrefix) {
					addressLines!.push(text)
					continue
				}
				// Финализируем адрес, переходим к фазе 3
				result.address = addressLines!.join(' ')
				addressLines = null
				footerPhase = 'after_address'
			}

			// Фаза 3: ОФД инфо
			if (/^ФДО:/i.test(text) || /^ОФД:/i.test(text)) {
				continue
			}

			const siteMatch = text.match(/^Сайт:\s*(\S+)/i)
			if (siteMatch) {
				result.checkOrgUrl = siteMatch[1]
				continue
			}

			// неизвестная строка в футере
			unusedLines.push({ index: i, text })
			continue
		}

		// Ссылка на чек (style:2)
		if (isRecord(line) && line.style === 2) {
			continue
		}

		unusedLines.push({ index: i, text })
	}

	// Финализируем адрес, если он собирался до конца
	if (addressLines && !result.address) {
		result.address = addressLines.join(' ')
	}

	// Если адрес на русском не нашёлся, но были пропущены строки, — предупреждаем
	if (skippedKzAddressLines.length > 0 && !result.address) {
		result.parseErrors.push('Не получилось распарсить адрес: ' + skippedKzAddressLines.join(' '))
	}

	// Оставшиеся нераспознанные строки
	for (const unusedLine of unusedLines) {
		result.parseErrors.push(`Не распознана строка ${unusedLine.index + 1}: "${unusedLine.text}"`)
	}

	return result
}

/** "4 920,50" -> 4920.5 */
function parseKzAmount(str: string): number | undefined {
	if (!str) return undefined
	const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.')
	const num = parseFloat(cleaned)
	return isNaN(num) ? undefined : num
}

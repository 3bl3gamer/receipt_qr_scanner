import { Receipt } from '../api'
import { ReceiptData } from '../receipts'
import { isRecord, optArr, OptNum, OptStr, optStr, urlWithoutProtocol } from '../utils'

type KzJusExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kkmSerialNumber: OptStr
	/** Код ККМ, РНМ, регистрационный номер ККМ */
	kkmFnsId: OptStr
	/** КСН/ИНК, идентификационный номер кассы */
	kkmInkNumber: OptStr
	/** ФП, фискальный признак ККМ */
	fiscalId: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	orgId: OptStr
	/** Порядковый номер чека */
	receiptNumber: OptStr
	/** Код кассира */
	cashierCode: OptStr
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
	items: Array<{
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}>
	parseErrors: string[]
}

export function getKzJusReceiptDataFrom(rec: Receipt): ReceiptData<{ kzJus: KzJusExtraData }> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	const lines = optArr(isRecord(data.data) ? data.data.ticket : undefined, [])

	const parsed = parseKzJusReceipt(lines)
	const refData = parseKzJusRefText(rec.refText)

	return {
		common: {
			title: makeKzJusReceiptTitle(parsed.orgName),
			totalSum: parsed.totalSum,
			itemsCount: parsed.items.length,
			placeName: parsed.orgName,
			orgInn: parsed.orgId,
			address: undefined,
			cashierName: '№' + parsed.cashierCode,
			shiftNumber: parsed.shiftNumber,
			taxOrgUrl: urlWithoutProtocol(rec.refText),
			items: parsed.items,
			parseErrors: parsed.parseErrors,
		},
		kzJus: {
			kkmSerialNumber: optStr(parsed.kkmSerialNumber),
			kkmFnsId: optStr(parsed.kkmFnsId ?? refData?.registrationNumber),
			kkmInkNumber: optStr(parsed.kkmInkNumber),
			fiscalId: optStr(parsed.fiscalId ?? refData?.fiscalId),
			orgId: optStr(parsed.orgId),
			receiptNumber: optStr(parsed.receiptNumber),
			cashierCode: optStr(parsed.cashierCode),
		},
		raw: data,
	}
}

export function parseKzJusReceipt(lines: unknown[]): ParsedReceipt {
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
		items: [],
		parseErrors: [],
	}

	const unusedLines: { index: number; text: string }[] = []
	let lastSeparatorLineI = -1
	let lastItemQuantityLineI = -1
	let nonEmptyLinesCount = 0

	lineLoop: for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		let text: string
		if (isRecord(line) && typeof line.text === 'string') {
			text = line.text.trim()
		} else {
			result.parseErrors.push(`Неккоректная строка ${i + 1}: ${JSON.stringify(line)}`)
			continue
		}

		if (text === '') continue
		nonEmptyLinesCount += 1

		// Назвние организации (первая непустая строка)
		if (!result.orgName && nonEmptyLinesCount === 1) {
			result.orgName = text
			continue
		}

		const binMatch = text.match(/^БСН\/БИН\s+(\d+)$/i)
		if (binMatch) {
			result.orgId = binMatch[1]
			continue
		}

		if (text === 'Продажа') {
			continue
		}

		const receiptMatch = text.match(/^Чектің реттік нөмірі\/Порядковый номер чека\s+(\S+)$/i)
		if (receiptMatch) {
			result.receiptNumber = receiptMatch[1]
			continue
		}

		const shiftMatch = text.match(/^Ауысым\/Смена\s+№(\S+)$/i)
		if (shiftMatch) {
			result.shiftNumber = shiftMatch[1]
			continue
		}

		const fiscalMatch = text.match(/^ФИСКАЛДЫҚ БЕЛГІ\/ФИСКАЛЬНЫЙ ПРИЗНАК:\s*(\S+)$/)
		if (fiscalMatch) {
			result.fiscalId = fiscalMatch[1]
			continue
		}

		const cashierMatch = text.match(/^КАССИР КОДЫ\/КОД КАССИРА\s+(\S+)$/)
		if (cashierMatch) {
			result.cashierCode = cashierMatch[1]
			continue
		}

		const timeMatch = text.match(/^УАҚЫТЫ\/ВРЕМЯ: \d\d?.\d\d?.\d{4} \d\d?:\d\d?:\d\d?$/)
		if (timeMatch) {
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

		// строка "ИТОГО:" и составные части этой общей суммы перед ней
		const totalAmountLabel = 'барлығы/итого:'
		const totalAmountItemsLabels = [
			'төленген сома/сумма оплаты',
			'банковская карта:',
			'қайтарым сомасы/сумма сдачи',
			'жеңілдік сомасы/сумма скидки',
			'үстеме сомасы/сумма наценки',
			'ққс сомасы/сумма ндс',
			totalAmountLabel,
		]
		for (const label of totalAmountItemsLabels) {
			if (text.toLocaleLowerCase().startsWith(label)) {
				const amountMatch = text.match(/\D([\d\s]+[,.]?\d*)\s*₸$/) //"... 4 920,00₸"
				if (amountMatch) {
					// пока используем только общую сумму
					if (label === totalAmountLabel) {
						result.totalSum = parseKzAmount(amountMatch[1])
					}
					continue lineLoop
				}
			}
		}

		// кол-во и цена товара: '1 (Штука) x 1 800,00₸ = 1 800,00₸'
		const itemMatch = text.match(
			/^(\d+(?:[.,]\d+)?)\s*\(([^)]+)\)\s*x\s*([\d\s]+[,.]?\d*)\s*₸\s*=\s*([\d\s]+[,.]?\d*)\s*₸$/,
		)
		if (itemMatch) {
			lastItemQuantityLineI = i
			const lastUnused = unusedLines.at(-1)
			if (lastUnused?.index === i - 1) {
				unusedLines.pop()
				result.items.push({
					name: lastUnused.text,
					quantity: parseFloat(itemMatch[1].replace(',', '.')),
					price: parseKzAmount(itemMatch[3]),
					sum: parseKzAmount(itemMatch[4]),
				})
				continue
			}
		}

		// НДС товара
		if (/^НДС\s+([\d\s]+[,.]?\d*)\s*₸$/i.test(text) && i === lastItemQuantityLineI + 1) {
			continue
		}

		// строки-разделители
		if (text.match(/^[-*=]+$/)) {
			lastSeparatorLineI = i
			continue
		}

		unusedLines.push({ index: i, text })
	}

	// После последнего разделителя торчит всякая реклама.
	// Выкидываем такие строки из списка неиспользованных.
	if (lastSeparatorLineI !== -1) {
		for (let i = unusedLines.length - 1; i >= 0; i--) {
			const unusedLine = unusedLines[i]
			if (unusedLine.index > lastSeparatorLineI) {
				if (/жүлде|сыйлықтар|приз|призов|Amian/i.test(unusedLine.text)) {
					unusedLines.pop()
				}
			}
		}
	}

	// все остальные неиспользованные строки добавляем как ошибки
	for (const unusedLine of unusedLines) {
		result.parseErrors.push(`Не распознана строка ${unusedLine.index + 1}: "${unusedLine.text}"`)
	}

	return result
}

/** "4 920,50" -> "4920.50" -> 4920.5 */
function parseKzAmount(str: string): number {
	return parseFloat(str.replace(/[\s\u00A0]/g, '').replace(',', '.'))
}

function parseKzJusRefText(refText: string): Record<string, string | null> | null {
	try {
		const url = new URL(refText)
		const params = url.searchParams
		return {
			fiscalId: params.get('i'),
			registrationNumber: params.get('f'),
			sum: params.get('s'),
			createdAt: params.get('t'),
		}
	} catch {
		return null
	}
}

export function makeKzJusReceiptTitle(orgName: OptStr): OptStr {
	if (!orgName) return orgName
	return orgName
		.replace(/^ТОО\s+/i, '')
		.replace(/^Товарищество с ограниченной ответственностью\s+/i, '')
		.replace(/^"([^"]*)"$/, '$1')
		.trim()
}

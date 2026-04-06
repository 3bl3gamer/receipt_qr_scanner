import { Receipt } from '../api'
import { makeKzReceiptTitle, parseKzRefText } from '../kz-common'
import { ReceiptData } from '../receipts'
import { isRecord, optArr, OptNum, optNum, OptStr, optStr } from '../utils'

type KzWipExtraData = {
	/** ЗНМ, заводской номер ККМ */
	kz_kkmSerialNumber: OptStr
	/** РНМ, регистрационный номер ККМ */
	kz_kkmFnsId: OptStr
	/** ФП, фискальный признак (номер чека) */
	kz_fiscalId: OptStr
	/** БИН, бизнес-идентификационный номер организации */
	kz_orgId: OptStr
	/** Порядковый номер чека */
	kz_receiptNumber: OptStr
}

type ParsedReceipt = {
	orgName: OptStr
	orgId: OptStr
	placeName: OptStr
	receiptNumber: OptStr
	shiftNumber: OptStr
	fiscalId: OptStr
	cashierName: OptStr
	kkmSerialNumber: OptStr
	kkmFnsId: OptStr
	totalSum: OptNum
	placeAddress: OptStr
	shareLink: OptStr
	items: Array<{
		name: OptStr
		quantity: OptNum
		price: OptNum
		sum: OptNum
	}>
	parseErrors: string[]
}

export function getKzWipReceiptDataFrom(rec: Receipt): ReceiptData<KzWipExtraData> {
	const data: Record<string, unknown> = JSON.parse(rec.data)
	const parsed = parseKzWipReceipt(data)
	const refData = parseKzRefText(rec.refText)

	return {
		common: {
			title: makeKzReceiptTitle(parsed.orgName),

			items: parsed.items,
			itemsCount: parsed.items.length,
			totalSum: parsed.totalSum,

			orgName: parsed.orgName,
			placeName: parsed.placeName,
			placeAddress: parsed.placeAddress,

			cashierName: parsed.cashierName,
			cashierCode: undefined,
			shiftNumber: parsed.shiftNumber,

			taxOrgUrl: undefined,
			checkOrgUrl: parsed.shareLink,
		},
		extra: {
			kz_kkmSerialNumber: optStr(parsed.kkmSerialNumber),
			kz_kkmFnsId: optStr(parsed.kkmFnsId ?? refData?.kkmFnsId),
			kz_fiscalId: optStr(parsed.fiscalId ?? refData?.fiscalId),
			kz_orgId: optStr(parsed.orgId),
			kz_receiptNumber: optStr(parsed.receiptNumber),
		},
		parseErrors: parsed.parseErrors,
		raw: data,
	}
}

export function parseKzWipReceipt(data: Record<string, unknown>): ParsedReceipt {
	const result: ParsedReceipt = {
		orgName: undefined,
		orgId: undefined,
		placeName: undefined,
		receiptNumber: undefined,
		shiftNumber: undefined,
		fiscalId: undefined,
		cashierName: undefined,
		kkmSerialNumber: undefined,
		kkmFnsId: undefined,
		totalSum: undefined,
		placeAddress: undefined,
		shareLink: undefined,
		items: [],
		parseErrors: [],
	}

	// data.ticket — основной объект чека
	const outerData = isRecord(data.data) ? data.data : {}
	const ticket = isRecord(outerData.ticket) ? outerData.ticket : null
	if (!ticket) {
		result.parseErrors.push('Не найден объект data.ticket')
		return result
	}

	// Организация
	const company = isRecord(ticket.company) ? ticket.company : null
	if (company) {
		result.orgName = optStr(company.name)
		result.orgId = optStr(company.bin)
	}

	// Касса
	const cashbox = isRecord(ticket.cashbox) ? ticket.cashbox : null
	if (cashbox) {
		result.kkmSerialNumber = optStr(cashbox.factory_number)
		result.kkmFnsId = optStr(cashbox.registration_number)
		result.placeName = optStr(
			(isRecord(cashbox.sale_point) ? cashbox.sale_point.name : null) || cashbox.name,
		)
		result.placeAddress = optStr(cashbox.address)
	}

	// Кассир
	const employee = isRecord(ticket.employee) ? ticket.employee : null
	const user = employee && isRecord(employee.user) ? employee.user : null
	if (user) {
		result.cashierName = optStr(user.name)
	}

	// Номера чека и смены
	result.receiptNumber = optStr(ticket.id)
	result.fiscalId = optStr(ticket.receipt_number)
	result.totalSum = optNum(ticket.sum)

	const shift = isRecord(ticket.shift) ? ticket.shift : null
	if (shift) {
		result.shiftNumber = optStr(shift.number)
	}

	// Товарные позиции
	const ticketItems = optArr(ticket.ticket_items, [])
	for (let i = 0; i < ticketItems.length; i++) {
		const item = ticketItems[i]
		if (!isRecord(item)) {
			result.parseErrors.push(`Некорректный товар ${i + 1}: ${JSON.stringify(item)}`)
			continue
		}
		result.items.push({
			name: optStr(item.name),
			quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) : optNum(item.quantity),
			price: optNum(item.price),
			sum: optNum(item.sum),
		})
	}

	result.shareLink = optStr(ticket.share_link)

	return result
}

import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { makeKzWfdReceiptTitle, parseKzWfdReceipt } from './kz-wfd'

describe('makeKzWfdReceiptTitle', () => {
	function check(dest: unknown, data: string) {
		test.strictEqual(makeKzWfdReceiptTitle(data), dest)
	}

	it('should remove legal entity prefixes and quotes', () => {
		check('test', 'test')
		check('PetShop', 'ТОО "PetShop"')
		check('MEGA TRADE', 'Товарищество с ограниченной ответственностью "MEGA TRADE"')
	})
})

describe('parseKzWfdReceipt', () => {
	it('should parse receipt with multi-line item name', () => {
		const lines = [
			{ text: '                  ТОО "ЗООМАГ"                   ', style: 0 },
			{ text: '              БСН/БИН 220340056789              ', style: 0 },
			{ text: '                                                ', style: 0 },
			{ text: '                  Сату/Продажа                  ', style: 0 },
			{
				text: 'Чектің реттік нөмірі/Порядковый номер чека      ',
				style: 0,
			},
			{ text: '17542                                           ', style: 0 },
			{ text: 'Ауысым/Смена №105                               ', style: 0 },
			{
				text: 'Фискалдық белгі/Фискальный признак: 776543210987',
				style: 0,
			},
			{
				text: '                       КАССИР КОДЫ/КОД КАССИРА 3',
				style: 0,
			},
			{
				text: '               КАССИР/КАССИР КАССИР ИВАНОВА М.П.',
				style: 0,
			},
			{
				text: 'УАҚЫТЫ/ВРЕМЯ: 20.01.2026 15:45:30               ',
				style: 0,
			},
			{
				text: 'КЗН/ЗНМ SWK00123456                 КСН/ИНК 4021',
				style: 0,
			},
			{
				text: 'КТН/РНМ 010105432100                            ',
				style: 0,
			},
			{ text: '*********************************************** ', style: 0 },
			{
				text: '4820 PREMIUM КОРМ ДЛЯ КОШЕК ГОВЯДИНА&РИС\\СУХОЙ',
				style: 0,
			},
			{
				text: ' РАЦИОН ДЛЯ ВЗРОСЛЫХ КОШЕК 1,5 кг               ',
				style: 0,
			},
			{
				text: '1 (Дана/Штука) x 8\u00A0500,00₸         = 8\u00A0500,00₸',
				style: 0,
			},
			{ text: 'GTIN: 4820012345678                             ', style: 0 },
			{ text: 'NTIN: 0300987654321                             ', style: 0 },
			{
				text: '2150 ЛАКОМСТВО ДЛЯ СОБАК КОСТОЧКА ЖЕВАТЕЛЬНАЯ  ',
				style: 0,
			},
			{
				text: '2 (Дана/Штука) x 1\u00A0200,00₸         = 2\u00A0400,00₸',
				style: 0,
			},
			{ text: 'GTIN: 4820098765432                             ', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{
				text: 'Чек бойынша төленген сома/Полученная сумма      ',
				style: 0,
			},
			{
				text: 'оплаты по чеку                             0,00₸',
				style: 0,
			},
			{
				text: '    Банк картасы/Банковская карта:    10\u00A0900,00₸',
				style: 0,
			},
			{
				text: 'Төлемнен кейінгі қайтарым сомасы/Сумма сдачи    ',
				style: 0,
			},
			{
				text: 'после оплаты                               0,00₸',
				style: 0,
			},
			{
				text: 'Жалпы жеңілдік сомасы/Общая сумма скидки   0,00₸',
				style: 0,
			},
			{
				text: 'Жалпы үстеме сомасы/Общая сумма наценки    0,00₸',
				style: 0,
			},
			{ text: 'БАРЛЫҒЫ/ИТОГО:          ', style: 1 },
			{ text: '              10\u00A0900,00₸', style: 1 },
			{ text: '------------------------------------------------', style: 0 },
			{
				text: 'Астана қ., Сарыарқа ауданы, көш. АБАЯ, ү.      ',
				style: 0,
			},
			{
				text: '15                                              ',
				style: 0,
			},
			{
				text: 'г.Астана, Сарыаркинский район, ул. Абая, д.    ',
				style: 0,
			},
			{
				text: '15                                              ',
				style: 0,
			},
			{ text: 'ФДО: "Smartcontract" ЖШС                        ', style: 0 },
			{ text: 'ОФД: ТОО "Smartcontract"                        ', style: 0 },
			{ text: 'Сайт: consumer.wofd.kz                          ', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{
				text: 'https://consumer.wofd.kz/?i=776543210987&f=010105432100&s=10900.00&t=20260120T154530',
				style: 2,
			},
		]

		const result = parseKzWfdReceipt(lines)

		test.deepStrictEqual(result, {
			orgName: 'ТОО "ЗООМАГ"',
			orgId: '220340056789',
			receiptNumber: '17542',
			shiftNumber: '105',
			fiscalId: '776543210987',
			cashierCode: '3',
			kkmSerialNumber: 'SWK00123456',
			kkmInkNumber: '4021',
			kkmFnsId: '010105432100',
			totalSum: 10900,
			address: 'г.Астана, Сарыаркинский район, ул. Абая, д. 15',
			checkOrgUrl: 'consumer.wofd.kz',
			items: [
				{
					name: '4820 PREMIUM КОРМ ДЛЯ КОШЕК ГОВЯДИНА&РИС\\СУХОЙ РАЦИОН ДЛЯ ВЗРОСЛЫХ КОШЕК 1,5 кг',
					price: 8500,
					quantity: 1,
					sum: 8500,
				},
				{
					name: '2150 ЛАКОМСТВО ДЛЯ СОБАК КОСТОЧКА ЖЕВАТЕЛЬНАЯ',
					price: 1200,
					quantity: 2,
					sum: 2400,
				},
			],
			parseErrors: [],
		})
	})

	it('should handle missing fields gracefully', () => {
		const lines = [
			{ text: 'Простой Магазин', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:', style: 1 },
			{ text: '500,00₸', style: 1 },
		]

		const result = parseKzWfdReceipt(lines)

		test.deepStrictEqual(result, {
			orgName: 'Простой Магазин',
			orgId: undefined,
			receiptNumber: undefined,
			shiftNumber: undefined,
			fiscalId: undefined,
			cashierCode: undefined,
			kkmSerialNumber: undefined,
			kkmInkNumber: undefined,
			kkmFnsId: undefined,
			totalSum: 500,
			address: undefined,
			checkOrgUrl: undefined,
			items: [],
			parseErrors: [],
		})
	})
})

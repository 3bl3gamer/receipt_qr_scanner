import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { parseKzWfdReceipt } from './kz-wfd'

describe('parseKzWfdReceipt', () => {
	it('should parse receipt with multi-line item name', () => {
		const lines = [
			{ text: '                  ТОО "ЗООМАГ"                   ', style: 0 },
			{ text: '              БСН/БИН 220340056789              ', style: 0 },
			{ text: '                                                ', style: 0 },
			{ text: '                  Сату/Продажа                  ', style: 0 },
			{ text: 'Чектің реттік нөмірі/Порядковый номер чека      ', style: 0 },
			{ text: '17542                                           ', style: 0 },
			{ text: 'Ауысым/Смена №105                               ', style: 0 },
			{ text: 'Фискалдық белгі/Фискальный признак: 776543210987', style: 0 },
			{ text: '                       КАССИР КОДЫ/КОД КАССИРА 3', style: 0 },
			{ text: '               КАССИР/КАССИР КАССИР ИВАНОВА М.П.', style: 0 },
			{ text: 'УАҚЫТЫ/ВРЕМЯ: 20.01.2026 15:45:30               ', style: 0 },
			{ text: 'КЗН/ЗНМ SWK00123456                 КСН/ИНК 4021', style: 0 },
			{ text: 'КТН/РНМ 010105432100                            ', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: '4820 PREMIUM КОРМ ДЛЯ КОШЕК ГОВЯДИНА&РИС\\СУХОЙ', style: 0 },
			{ text: ' РАЦИОН ДЛЯ ВЗРОСЛЫХ КОШЕК 1,5 кг               ', style: 0 },
			{ text: '1 (Дана/Штука) x 8\u00A0500,00₸         = 8\u00A0500,00₸', style: 0 },
			{ text: 'GTIN: 4820012345678                             ', style: 0 },
			{ text: 'NTIN: 0300987654321                             ', style: 0 },
			{ text: '2150 ЛАКОМСТВО ДЛЯ СОБАК КОСТОЧКА ЖЕВАТЕЛЬНАЯ  ', style: 0 },
			{ text: '2 (Дана/Штука) x 1\u00A0200,00₸         = 2\u00A0400,00₸', style: 0 },
			{ text: 'GTIN: 4820098765432                             ', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Чек бойынша төленген сома/Полученная сумма      ', style: 0 },
			{ text: 'оплаты по чеку                             0,00₸', style: 0 },
			{ text: '    Банк картасы/Банковская карта:    10\u00A0900,00₸', style: 0 },
			{ text: 'Төлемнен кейінгі қайтарым сомасы/Сумма сдачи    ', style: 0 },
			{ text: 'после оплаты                               0,00₸', style: 0 },
			{ text: 'Жалпы жеңілдік сомасы/Общая сумма скидки   0,00₸', style: 0 },
			{ text: 'Жалпы үстеме сомасы/Общая сумма наценки    0,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:          ', style: 1 },
			{ text: '              10\u00A0900,00₸', style: 1 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Астана қ., Сарыарқа ауданы, көш. АБАЯ, ү.      ', style: 0 },
			{ text: '15                                              ', style: 0 },
			{ text: 'г.Астана, Сарыаркинский район, ул. Абая, д.    ', style: 0 },
			{ text: '15                                              ', style: 0 },
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

	it('should parse receipt with inline receipt number and inline total', () => {
		// Формат: номер чека на одной строке, БАРЛЫҒЫ/ИТОГО: с суммой на той же строке
		const lines = [
			{ text: '                ТОО "KG Partners                ', style: 0 },
			{ text: '              БСН/БИН 190540000001              ', style: 0 },
			{ text: '                                                ', style: 0 },
			{ text: '                  Сату/Продажа                  ', style: 0 },
			{ text: 'Чектің реттік нөмірі/Порядковый номер чека 4118 ', style: 0 },
			{ text: 'Ауысым/Смена №40                                ', style: 0 },
			{ text: 'Фискалдық белгі/Фискальный признак: 1234500000001', style: 0 },
			{ text: '                      КАССИР КОДЫ/КОД КАССИРА 33', style: 0 },
			{ text: '                   КАССИР/КАССИР RIVIERA КАССА 1', style: 0 },
			{ text: 'УАҚЫТЫ/ВРЕМЯ: 26.03.2026 19:56:42               ', style: 0 },
			{ text: 'КЗН/ЗНМ SWK00520084                КСН/ИНК 24064', style: 0 },
			{ text: 'КТН/РНМ 700300000001                            ', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: 'Маффин "Double Choc"                            ', style: 0 },
			{ text: '1 (Дана/Штука) x 750,00₸               = 750,00₸', style: 0 },
			{ text: '                                ҚҚС/НДС  103,45₸', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Чек бойынша төленген сома/Полученная сумма      ', style: 0 },
			{ text: 'оплаты по чеку                             0,00₸', style: 0 },
			{ text: '    Банк картасы/Банковская карта:       750,00₸', style: 0 },
			{ text: 'Төлемнен кейінгі қайтарым сомасы/Сумма сдачи    ', style: 0 },
			{ text: 'после оплаты                               0,00₸', style: 0 },
			{ text: 'Жалпы жеңілдік сомасы/Общая сумма скидки   0,00₸', style: 0 },
			{ text: 'Жалпы үстеме сомасы/Общая сумма наценки    0,00₸', style: 0 },
			{ text: 'ҚҚС жалпы сомасы/Общая сумма НДС 16%     103,45₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:   750,00₸', style: 1 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Алматы қ., Бостандық ауданы, көш. САТПАЕВ,  ү.  ', style: 0 },
			{ text: '90/21                                           ', style: 0 },
			{ text: 'г.Алматы, Бостандыкский район, ул. Сатпаева,    ', style: 0 },
			{ text: 'д. 90/21                                        ', style: 0 },
			{ text: 'ФДО: "Smartcontract" ЖШС                        ', style: 0 },
			{ text: 'ОФД: ТОО "Smartcontract"                        ', style: 0 },
			{ text: 'Сайт: consumer.wofd.kz                          ', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{
				text: 'https://consumer.wofd.kz/?i=1234500000001&f=700300000001&s=750.00&t=20260326T195642',
				style: 2,
			},
		]
		const result = parseKzWfdReceipt(lines)

		test.deepStrictEqual(result, {
			orgName: 'ТОО "KG Partners',
			orgId: '190540000001',
			receiptNumber: '4118',
			shiftNumber: '40',
			fiscalId: '1234500000001',
			cashierCode: '33',
			kkmSerialNumber: 'SWK00520084',
			kkmInkNumber: '24064',
			kkmFnsId: '700300000001',
			totalSum: 750,
			address: 'г.Алматы, Бостандыкский район, ул. Сатпаева, д. 90/21',
			checkOrgUrl: 'consumer.wofd.kz',
			items: [{ name: 'Маффин "Double Choc"', quantity: 1, price: 750, sum: 750 }],
			parseErrors: [],
		})
	})

	it('should skip ҚҚС/НДС lines after item quantity line', () => {
		const lines = [
			{ text: 'ТОО "РЕСТОРАН"', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: 'Рамадан Биф Сет', style: 0 },
			{ text: '2 (Дана/Штука) x 4\u00A0000,00₸           = 8\u00A0000,00₸', style: 0 },
			{ text: '                              ҚҚС/НДС  1\u00A0103,45₸', style: 0 },
			{ text: 'Рамадан Чикен Сет', style: 0 },
			{ text: '1 (Дана/Штука) x 4\u00A0000,00₸           = 4\u00A0000,00₸', style: 0 },
			{ text: '                                ҚҚС/НДС  551,72₸', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:', style: 1 },
			{ text: '12\u00A0000,00₸', style: 1 },
		]
		const result = parseKzWfdReceipt(lines)

		test.deepStrictEqual(result.items, [
			{ name: 'Рамадан Биф Сет', quantity: 2, price: 4000, sum: 8000 },
			{ name: 'Рамадан Чикен Сет', quantity: 1, price: 4000, sum: 4000 },
		])
		test.strictEqual(result.totalSum, 12000)
		test.deepStrictEqual(result.parseErrors, [])
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

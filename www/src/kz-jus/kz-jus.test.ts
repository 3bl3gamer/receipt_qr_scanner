import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { parseKzJusReceipt_shared } from './kz-jus'

describe('parseKzJusReceipt', () => {
	it('should parse receipt with all fields', () => {
		const lines = [
			{ text: '      ТОО "KG PARTNERS (КЕЙ ДЖИ ПАРТНЕРС)"      ', style: 0 },
			{ text: '              БСН/БИН 190540005749              ', style: 0 },
			{ text: 'Чектің реттік нөмірі/Порядковый номер чека 45192', style: 0 },
			{ text: 'Ауысым/Смена №480                               ', style: 0 },
			{ text: 'ФИСКАЛДЫҚ БЕЛГІ/ФИСКАЛЬНЫЙ ПРИЗНАК: 821234567890', style: 0 },
			{ text: '                      КАССИР КОДЫ/КОД КАССИРА 18', style: 0 },
			{ text: 'КЗН/ЗНМ SWK00484598                КСН/ИНК 63402', style: 0 },
			{ text: 'КТН/РНМ 010102345678                            ', style: 0 },
			{ text: 'Двойной чизбургер                               ', style: 0 },
			{ text: '1 (Штука) x 1\u00A0800,00₸                = 1\u00A0800,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:12\u00A0900,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result, {
			orgName: 'ТОО "KG PARTNERS (КЕЙ ДЖИ ПАРТНЕРС)"',
			orgId: '190540005749',
			receiptNumber: '45192',
			shiftNumber: '480',
			fiscalId: '821234567890',
			cashierCode: '18',
			kkmSerialNumber: 'SWK00484598',
			kkmInkNumber: '63402',
			kkmFnsId: '010102345678',
			totalSum: 12900.0,
			items: [{ name: 'Двойной чизбургер', quantity: 1, price: 1800.0, sum: 1800.0 }],
			parseErrors: [],
		})
	})

	it('should parse multiple items with and without "НДС"', () => {
		const lines = [
			{ text: 'ТОО "RESTAURANT"', style: 0 },
			{ text: 'Двойной чизбургер', style: 0 },
			{ text: '1 (Штука) x 1\u00A0800,00₸ = 1\u00A0800,00₸', style: 0 },
			{ text: 'Двойной Вэндис бургер', style: 0 },
			{ text: '1 (Штука) x 3\u00A0150,00₸ = 3\u00A0150,00₸', style: 0 },
			{ text: '                               НДС  192,86₸', style: 0 },
			{ text: 'Биффонатор L комбо круч фри', style: 0 },
			{ text: '1 (Штука) x 5\u00A0500,00₸ = 5\u00A0500,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:10\u00A0450,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.items, [
			{ name: 'Двойной чизбургер', quantity: 1, price: 1800.0, sum: 1800.0 },
			{ name: 'Двойной Вэндис бургер', quantity: 1, price: 3150.0, sum: 3150.0 },
			{ name: 'Биффонатор L комбо круч фри', quantity: 1, price: 5500.0, sum: 5500.0 },
		])
		test.strictEqual(result.totalSum, 10450.0)
		test.deepStrictEqual(result.parseErrors, [])
	})

	it('should parse items with decimal quantities (unverified yet)', () => {
		const lines = [
			{ text: 'ТОО "STORE"', style: 0 },
			{ text: 'Молоко 3.2%', style: 0 },
			{ text: '2,5 (Литр) x 450,00₸ = 1\u00A0125,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:1\u00A0125,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.items, [
			{ name: 'Молоко 3.2%', quantity: 2.5, price: 450.0, sum: 1125.0 },
		])
		test.deepStrictEqual(result.parseErrors, [])
	})

	it('should skip items without name (separator before quantity)', () => {
		const lines = [
			{ text: 'ТОО "STORE"', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: '1 (Штука) x 100,00₸ = 100,00₸', style: 0 },
			{ text: 'Valid item', style: 0 },
			{ text: '1 (Штука) x 200,00₸ = 200,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:300,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.items, [{ name: 'Valid item', quantity: 1, price: 200, sum: 200 }])
		test.deepStrictEqual(result.parseErrors, ['Не распознана строка 3: "1 (Штука) x 100,00₸ = 100,00₸"'])
	})

	it('should handle missing optional fields gracefully', () => {
		const lines = [
			{ text: 'ТОО "MINIMAL"', style: 0 },
			{ text: 'Item 1', style: 0 },
			{ text: '1 (Штука) x 100,00₸ = 100,00₸', style: 0 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result, {
			orgName: 'ТОО "MINIMAL"',
			orgId: undefined,
			receiptNumber: undefined,
			shiftNumber: undefined,
			fiscalId: undefined,
			cashierCode: undefined,
			kkmSerialNumber: undefined,
			kkmInkNumber: undefined,
			kkmFnsId: undefined,
			totalSum: undefined,
			items: [{ name: 'Item 1', quantity: 1, price: 100.0, sum: 100.0 }],
			parseErrors: [],
		})
	})

	it('should continue parsing after errors', () => {
		// Ошибки отделены от названий товаров распознанными строками,
		// чтобы не слиться с многострочными названиями
		const lines = [
			{ text: 'ТОО "STORE"', style: 0 }, // 0: orgName
			{ text: 'INVALID', style: 0 }, // 1: ошибка
			{ text: 'БСН/БИН 123456789012', style: 0 }, // 2: распознана (барьер)
			{ text: 'Valid item 1', style: 0 }, // 3: название
			{ text: '1 (Штука) x 100,00₸ = 100,00₸', style: 0 }, // 4: количество
			{ text: 'INVALID', style: 0 }, // 5: ошибка
			{ text: 'КТН/РНМ 010102345678', style: 0 }, // 6: распознана (барьер)
			{ text: 'Valid item 2', style: 0 }, // 7: название
			{ text: '1 (Штука) x 200,00₸ = 200,00₸', style: 0 }, // 8: количество
			{ text: 'INVALID', style: 0 }, // 9: ошибка
			{ text: 'БАРЛЫҒЫ/ИТОГО:300,00₸', style: 1 }, // 10
		]
		const result = parseKzJusReceipt_shared(lines)

		test.strictEqual(result.orgName, 'ТОО "STORE"')
		test.strictEqual(result.orgId, '123456789012')
		test.strictEqual(result.totalSum, 300.0)
		test.deepStrictEqual(result.items, [
			{ name: 'Valid item 1', quantity: 1, price: 100.0, sum: 100.0 },
			{ name: 'Valid item 2', quantity: 1, price: 200.0, sum: 200.0 },
		])
		test.deepStrictEqual(
			result.parseErrors,
			[2, 6, 10].map(line => `Не распознана строка ${line}: "INVALID"`),
		)
	})

	it('should handle invalid line structures and report errors', () => {
		const lines = [
			{ text: 'ТОО "STORE"' },
			null,
			undefined,
			'just a string',
			123,
			[1, 2, 3],
			{ style: 0 },
			{ text: 456 },
			{ text: null },
			{ text: undefined },
			{ text: 'БАРЛЫҒЫ/ИТОГО:100,00₸' },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.parseErrors, [
			'Неккоректная строка 2: null',
			'Неккоректная строка 3: undefined',
			'Неккоректная строка 4: "just a string"',
			'Неккоректная строка 5: 123',
			'Неккоректная строка 6: [1,2,3]',
			'Неккоректная строка 7: {"style":0}',
			'Неккоректная строка 8: {"text":456}',
			'Неккоректная строка 9: {"text":null}',
			'Неккоректная строка 10: {}',
		])
		test.strictEqual(result.orgName, 'ТОО "STORE"')
		test.deepStrictEqual(result.totalSum, 100)
	})

	it('should skip GTIN, NTIN and НДС lines after item quantity line', () => {
		const lines = [
			{ text: 'ТОО "damdala"', style: 0 },
			{ text: 'СЭНДВИЧ С КУРИЦЕЙ И СЫРОМ ЧЕДДЕР 170ГР ШТ', style: 0 },
			{ text: '2 (Штука) x 1\u00A0690,00₸                = 3\u00A0380,00₸', style: 0 },
			{ text: 'GTIN: 4870205035062', style: 0 },
			{ text: 'NTIN: 0040032612321', style: 0 },
			{ text: '                                    НДС  466,21₸', style: 0 },
			{ text: 'СЭНДВИЧ С ТУНЦОМ 160ГР 1ШТ', style: 0 },
			{ text: '1 (Штука) x 1\u00A0590,00₸                = 1\u00A0590,00₸', style: 0 },
			{ text: 'GTIN: 4870205050546', style: 0 },
			{ text: 'NTIN: 0040032599912', style: 0 },
			{ text: '                                    НДС  219,31₸', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Төленген сома/Сумма оплаты             5\u00A0000,00₸', style: 0 },
			{ text: '    Наличные:                          4\u00A0970,00₸', style: 0 },
			{ text: 'Қайтарым сомасы/Сумма сдачи               30,00₸', style: 0 },
			{ text: 'Жеңілдік сомасы/Сумма скидки               0,00₸', style: 0 },
			{ text: 'үстеме сомасы/Сумма наценки                0,00₸', style: 0 },
			{ text: 'ҚҚС сомасы/Сумма НДС                     685,52₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО: 4\u00A0970,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.items, [
			{ name: 'СЭНДВИЧ С КУРИЦЕЙ И СЫРОМ ЧЕДДЕР 170ГР ШТ', quantity: 2, price: 1690, sum: 3380 },
			{ name: 'СЭНДВИЧ С ТУНЦОМ 160ГР 1ШТ', quantity: 1, price: 1590, sum: 1590 },
		])
		test.strictEqual(result.totalSum, 4970)
		test.deepStrictEqual(result.parseErrors, [])
	})

	it('should parse multi-line item names', () => {
		const lines = [
			{ text: 'ТОО "STORE"', style: 0 },
			{ text: '***********************************************', style: 0 },
			{ text: 'Питьевая озонированная природная вода samal 6', style: 0 },
			{ text: 'л', style: 0 },
			{ text: '1 (Штука) x 910,00₸ = 910,00₸', style: 0 },
			{ text: 'Товар на одну строку', style: 0 },
			{ text: '2 (Штука) x 500,00₸ = 1 000,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО: 1 910,00₸', style: 1 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result.items, [
			{ name: 'Питьевая озонированная природная вода samal 6 л', quantity: 1, price: 910, sum: 910 },
			{ name: 'Товар на одну строку', quantity: 2, price: 500, sum: 1000 },
		])
		test.deepStrictEqual(result.parseErrors, [])
	})

	it('should parse real receipt #1', () => {
		const lines = [
			{ text: '                    АДК-КСФ                     ', style: 0 },
			{ text: '              БСН/БИН 811012000038              ', style: 0 },
			{ text: '                                                ', style: 0 },
			{ text: '                    Продажа                     ', style: 0 },
			{ text: 'Чектің реттік нөмірі/Порядковый номер чека 199440', style: 0 },
			{ text: 'Ауысым/Смена №1163                              ', style: 0 },
			{ text: 'ФИСКАЛДЫҚ БЕЛГІ/ФИСКАЛЬНЫЙ ПРИЗНАК: 821234567890', style: 0 },
			{ text: '                       КАССИР КОДЫ/КОД КАССИРА 1', style: 0 },
			{ text: 'УАҚЫТЫ/ВРЕМЯ: 20.12.2025 18:42:06               ', style: 0 },
			{ text: 'КЗН/ЗНМ TK00011158                 КСН/ИНК 32335', style: 0 },
			{ text: 'КТН/РНМ 010102345678                            ', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: 'Рамён ассорти с курицей средне-острый (шт)  шт  ', style: 0 },
			{ text: '2 (Штука) x 1\u00A0900,00₸                = 3\u00A0800,00₸', style: 0 },
			{ text: 'Панчан сет (шт)  шт                             ', style: 0 },
			{ text: '1 (Штука) x 1\u00A0120,00₸                = 1\u00A0120,00₸', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Төленген сома/Сумма оплаты                 0,00₸', style: 0 },
			{ text: '    Банковская карта:                  4\u00A0920,00₸', style: 0 },
			{ text: 'Қайтарым сомасы/Сумма сдачи                0,00₸', style: 0 },
			{ text: 'Жеңілдік сомасы/Сумма скидки               0,00₸', style: 0 },
			{ text: 'үстеме сомасы/Сумма наценки                0,00₸', style: 0 },
			{ text: 'ҚҚС сомасы/Сумма НДС                       0,00₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО: 4\u00A0920,00₸', style: 1 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: '        Чекті талап етіп жүлде ұтып ал!         ', style: 0 },
			{ text: '   Amian қосымшасы арқылы осы чекті сканерлеп   ', style: 0 },
			{ text: '      бағалы сыйлықтар ұтысына қатысыңыз!       ', style: 0 },
			{ text: '           Требуй чек - выиграй приз!           ', style: 0 },
			{ text: '  Сканируй этот чек с помощью приложения Amian  ', style: 0 },
			{ text: '     и участвуй в розыгрыше ценных призов!      ', style: 0 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result, {
			orgName: 'АДК-КСФ',
			orgId: '811012000038',
			receiptNumber: '199440',
			shiftNumber: '1163',
			fiscalId: '821234567890',
			cashierCode: '1',
			kkmSerialNumber: 'TK00011158',
			kkmInkNumber: '32335',
			kkmFnsId: '010102345678',
			totalSum: 4920,
			items: [
				{
					name: 'Рамён ассорти с курицей средне-острый (шт)  шт',
					quantity: 2,
					price: 1900,
					sum: 3800,
				},
				{ name: 'Панчан сет (шт)  шт', quantity: 1, price: 1120, sum: 1120 },
			],
			parseErrors: [],
		})
	})

	it('should parse real receipt #2 (multi-line item name)', () => {
		const lines = [
			{ text: '                  Set market 2                  ', style: 0 },
			{ text: '              БСН/БИН 920123123123              ', style: 0 },
			{ text: '                                                ', style: 0 },
			{ text: '                    Продажа                     ', style: 0 },
			{ text: 'Чектің реттік нөмірі/Порядковый номер чека 123123', style: 0 },
			{ text: 'Ауысым/Смена №2145                              ', style: 0 },
			{ text: 'ФИСКАЛДЫҚ БЕЛГІ/ФИСКАЛЬНЫЙ ПРИЗНАК: 840123123123', style: 0 },
			{ text: '                       КАССИР КОДЫ/КОД КАССИРА 2', style: 0 },
			{ text: 'УАҚЫТЫ/ВРЕМЯ: 26.04.2026 12:01:02               ', style: 0 },
			{ text: 'КЗН/ЗНМ SWK00440123                КСН/ИНК 43084', style: 0 },
			{ text: 'КТН/РНМ 010102342342                            ', style: 0 },
			{ text: '*********************************************** ', style: 0 },
			{ text: 'Питьевая озонированная природная вода samal 6   ', style: 0 },
			{ text: 'л                                               ', style: 0 },
			{ text: '1 (Штука) x 910,00₸                    = 910,00₸', style: 0 },
			{ text: 'GTIN: 4870207510017                             ', style: 0 },
			{ text: 'NTIN: 0200212227947                             ', style: 0 },
			{ text: '                                    НДС  125,52₸', style: 0 },
			{ text: 'Печ. сд. Американское 200г\\12                   ', style: 0 },
			{ text: '1 (Штука) x 630,00₸                    = 630,00₸', style: 0 },
			{ text: 'GTIN: 4680021880490                             ', style: 0 },
			{ text: 'NTIN: 0200210030693                             ', style: 0 },
			{ text: '                                     НДС  86,90₸', style: 0 },
			{ text: 'Бельвита 253г сэндвич печенье с какао           ', style: 0 },
			{ text: '1 (Штука) x 1 320,00₸                = 1 320,00₸', style: 0 },
			{ text: 'GTIN: 7622210742018                             ', style: 0 },
			{ text: 'NTIN: 0200210027945                             ', style: 0 },
			{ text: '                                    НДС  182,07₸', style: 0 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: 'Төленген сома/Сумма оплаты                 0,00₸', style: 0 },
			{ text: '    Банковская карта:                  2 860,00₸', style: 0 },
			{ text: 'Қайтарым сомасы/Сумма сдачи                0,00₸', style: 0 },
			{ text: 'Жеңілдік сомасы/Сумма скидки               0,00₸', style: 0 },
			{ text: 'үстеме сомасы/Сумма наценки                0,00₸', style: 0 },
			{ text: 'ҚҚС сомасы/Сумма НДС                     394,49₸', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО: 2 860,00₸', style: 1 },
			{ text: '------------------------------------------------', style: 0 },
			{ text: '        Чекті талап етіп жүлде ұтып ал!         ', style: 0 },
			{ text: '   Amian қосымшасы арқылы осы чекті сканерлеп   ', style: 0 },
			{ text: '      бағалы сыйлықтар ұтысына қатысыңыз!       ', style: 0 },
			{ text: '           Требуй чек - выиграй приз!           ', style: 0 },
			{ text: '  Сканируй этот чек с помощью приложения Amian  ', style: 0 },
			{ text: '     и участвуй в розыгрыше ценных призов!      ', style: 0 },
		]
		const result = parseKzJusReceipt_shared(lines)

		test.deepStrictEqual(result, {
			orgName: 'Set market 2',
			orgId: '920123123123',
			receiptNumber: '123123',
			shiftNumber: '2145',
			fiscalId: '840123123123',
			cashierCode: '2',
			kkmSerialNumber: 'SWK00440123',
			kkmInkNumber: '43084',
			kkmFnsId: '010102342342',
			totalSum: 2860,
			items: [
				{
					name: 'Питьевая озонированная природная вода samal 6 л',
					quantity: 1,
					price: 910,
					sum: 910,
				},
				{ name: 'Печ. сд. Американское 200г\\12', quantity: 1, price: 630, sum: 630 },
				{ name: 'Бельвита 253г сэндвич печенье с какао', quantity: 1, price: 1320, sum: 1320 },
			],
			parseErrors: [],
		})
	})
})

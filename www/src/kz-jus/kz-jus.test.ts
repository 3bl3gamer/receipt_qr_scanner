import test from 'node:assert/strict'
import { suite as describe, it } from 'node:test'
import { makeKzJusReceiptTitle, parseKzJusReceipt } from './kz-jus'

describe('makeKzJusReceiptTitle', () => {
	function check(dest: unknown, data: string) {
		test.strictEqual(makeKzJusReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('KG PARTNERS (КЕЙ ДЖИ ПАРТНЕРС)', 'ТОО "KG PARTNERS (КЕЙ ДЖИ ПАРТНЕРС)"')
		check('ВЕСТА КАЗАХСТАН', 'Товарищество с ограниченной ответственностью "ВЕСТА КАЗАХСТАН"')
		check('АДК-КСФ', '"АДК-КСФ"')
		check('Магазин', 'ТОО Магазин')
	})
})

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
		const result = parseKzJusReceipt(lines)

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
		const result = parseKzJusReceipt(lines)

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
		const result = parseKzJusReceipt(lines)

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
		const result = parseKzJusReceipt(lines)

		test.deepStrictEqual(result.items, [{ name: 'Valid item', quantity: 1, price: 200, sum: 200 }])
		test.deepStrictEqual(result.parseErrors, ['Не распознана строка 3: "1 (Штука) x 100,00₸ = 100,00₸"'])
	})

	it('should handle missing optional fields gracefully', () => {
		const lines = [
			{ text: 'ТОО "MINIMAL"', style: 0 },
			{ text: 'Item 1', style: 0 },
			{ text: '1 (Штука) x 100,00₸ = 100,00₸', style: 0 },
		]
		const result = parseKzJusReceipt(lines)

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
		const lines = [
			{ text: 'ТОО "STORE"', style: 0 },
			{ text: 'INVALID', style: 0 },
			{ text: 'БСН/БИН 123456789012', style: 0 },
			{ text: 'INVALID', style: 0 },
			{ text: 'Valid item 1', style: 0 },
			{ text: '1 (Штука) x 100,00₸ = 100,00₸', style: 0 },
			{ text: 'INVALID', style: 0 },
			{ text: 'Valid item 2', style: 0 },
			{ text: '1 (Штука) x 200,00₸ = 200,00₸', style: 0 },
			{ text: 'INVALID', style: 0 },
			{ text: 'БАРЛЫҒЫ/ИТОГО:300,00₸', style: 1 },
		]
		const result = parseKzJusReceipt(lines)

		test.strictEqual(result.orgName, 'ТОО "STORE"')
		test.strictEqual(result.orgId, '123456789012')
		test.strictEqual(result.totalSum, 300.0)
		test.deepStrictEqual(result.items, [
			{ name: 'Valid item 1', quantity: 1, price: 100.0, sum: 100.0 },
			{ name: 'Valid item 2', quantity: 1, price: 200.0, sum: 200.0 },
		])
		test.deepStrictEqual(
			result.parseErrors,
			[2, 4, 7, 10].map(line => `Не распознана строка ${line}: "INVALID"`),
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
		const result = parseKzJusReceipt(lines)

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
		const result = parseKzJusReceipt(lines)

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
})

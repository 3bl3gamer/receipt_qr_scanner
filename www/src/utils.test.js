import { describe, it } from 'mocha'
import { assert as test } from 'chai'
import { makeKgGnsReceiptTitle, makeRuFnsReceiptTitle, searchBinary } from './utils.js'

describe('searchBinary', () => {
	it('should return element index and status', () => {
		const t = /**@type {const}*/ ([
			[[], 0, 0, false],
			[[1], 0, 0, false],
			[[1], 1, 0, true],
			[[1], 2, 1, false],
			[[1, 2], 0, 0, false],
			[[1, 2], 1, 0, true],
			[[1, 2], 2, 1, true],
			[[1, 2], 3, 2, false],
		])
		for (const [arr, elem, index, exists] of t) {
			test.strictEqual(searchBinary(arr, elem, (a, b) => a - b)[0], index, `index: ${arr} ${elem}`)
			test.strictEqual(searchBinary(arr, elem, (a, b) => a - b)[1], exists, `exists: ${arr} ${elem}`)
		}
	})
})

describe('makeReceiptTitle', () => {
	/** @param {*} dest @param {*} data */
	function check(dest, data) {
		test.strictEqual(makeRuFnsReceiptTitle(data), dest)
	}

	it('should return null for empty data', () => {
		check(null, null)
	})
	it('should use cleaned place name', () => {
		check('test', { retailPlace: 'test' })
		check('test', { retailPlace: ' test ' })
		check('Скидкино', { retailPlace: 'магазин "Скидкино"' })
		check('Караван 24', { retailPlace: 'Магазин самообслуживания "Караван 24"' })
		check('aliexpress.ru', { retailPlace: 'https://aliexpress.ru/' })
		check('rzd.ru', { retailPlace: 'http://www.rzd.ru' })
		check('b.a.ru', { retailPlace: 'http://a.ru;http://b.a.ru' })
		check('Пятерочка', { retailPlace: 'Пятерочка;' })
	})
	it('should use cleaned user name', () => {
		check('test', { user: 'test' })
		check('test', { user: ' test ' })
		check('ИНТЕРНЕТ РЕШЕНИЯ', { user: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ИНТЕРНЕТ РЕШЕНИЯ"' })
		check('ГОРОДСКИЕ АПТЕКИ', { user: 'АКЦИОНЕРНОЕ ОБЩЕСТВО "ГОРОДСКИЕ АПТЕКИ"' })
		check('ФАРМАЦИЯ', { user: 'ОТКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "ФАРМАЦИЯ"' })
		check('МЕГАФОН', { user: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "МЕГАФОН"' })
		check('УРАЛЬСКИЕ АВИАЛИНИИ', { user: 'АКЦИОНЕРНОЕ ОБЩЕСТВО АВИАКОМПАНИЯ "УРАЛЬСКИЕ АВИАЛИНИИ"' })
		check('Агроторг', { user: 'ООО "Агроторг"' })
		check('МЕТРОМАРКЕТ', { user: 'ООО"МЕТРОМАРКЕТ"' })
		check('ПОЧТА РОССИИ', { user: 'АО "ПОЧТА РОССИИ"' })
	})

	describe('combination', () => {
		it('should skip actial names if possible', () => {
			check('ням', { user: 'Иванов Иван Иванович', retailPlace: 'ням' })
			check('ням', { user: 'ИП Иванов Иван Иванович', retailPlace: 'ням' })
			check('ням', { user: 'индивидуальный предприниматель Иванов Иван Иванович', retailPlace: 'ням' })
			check('магазин', { user: 'Иванов Иван Иванович', retailPlace: 'магазин' })
		})
		it('should chose the longest value (after cleanup)', () => {
			check('ПОЧТА РОССИИ', { user: 'АО "ПОЧТА РОССИИ"', retailPlace: 'ОПС' })
		})
		it('should use name exceptions', () => {
			check('Читай-Город', { user: 'ООО "Новый Книжный М"', retailPlace: 'Магазин "Читай-Город"' })
			check('Магазин упаковки', { user: 'ИВАНОВ ИВАН ИВАНОВИЧ', retailPlace: 'Магазин упаковки' })
			check('МТС', {
				user: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "МОБИЛЬНЫЕ ТЕЛЕСИСТЕМЫ"',
				retailPlace: 'http://www.mts.ru;https://payment.mts.ru',
			})
		})
	})
})

describe('makeKgGnsReceiptTitle', () => {
	/** @param {*} dest @param {*} data */
	function check(dest, data) {
		test.strictEqual(makeKgGnsReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('Колобок', 'Магазин Колобок')
		check('Бимед Фарм', 'ОсОО Бимед Фарм')
		check('Mega City', 'Магазин "Mega City"')
	})
})

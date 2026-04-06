import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { makeKzReceiptTitle } from './kz-common'

describe('makeKzReceiptTitle', () => {
	function check(data: string, dest: unknown) {
		test.strictEqual(makeKzReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('"АДК-КСФ"', 'АДК-КСФ')

		check('ТОО "SuperMarket"', 'SuperMarket')
		check('Товарищество с ограниченной ответственностью "ASIA FOODS"', 'ASIA FOODS')
		check(
			'ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "PJ KAZAKHSTAN (ПИДЖЕЙ КАЗАХСТАН)"',
			'PJ KAZAKHSTAN (ПИДЖЕЙ КАЗАХСТАН)',
		)

		check('АКЦИОНЕРНОЕ ОБЩЕСТВО "The Company"', 'The Company')

		check('"The Company "Name"', 'The Company "Name"')
		check('ТОО "The Company "Name"', 'The Company "Name"')
		// сохраняет кавычки как есть
		check('префикс "название"', 'префикс "название"')
		check('"странные"кавычки"', '"странные"кавычки"')
		check('"странные" кавычки"', '"странные" кавычки"')
		check('"странные" "кавычки"', '"странные" "кавычки"')

		// TODO
		// check(`"ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \\"The Name\\""`, 'The Name')
	})
})

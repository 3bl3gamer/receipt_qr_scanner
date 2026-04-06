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
	})
})

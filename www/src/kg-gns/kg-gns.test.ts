import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { makeKgGnsReceiptTitle } from './kg-gns'

describe('makeKgGnsReceiptTitle', () => {
	function check(data: string, dest: unknown) {
		test.strictEqual(makeKgGnsReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('Магазин Колобок', 'Колобок')
		check('ОсОО Бимед Фарм', 'Бимед Фарм')
		check('ОсОО "Капито Классик"', 'Капито Классик')
		check('Магазин "Mega City"', 'Mega City')
	})
})

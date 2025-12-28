import test from 'node:assert/strict'
import { suite as describe, it } from 'node:test'
import { makeKgGnsReceiptTitle } from './kg-gns'

describe('makeKgGnsReceiptTitle', () => {
	/** @param {*} dest @param {*} data */
	function check(dest: unknown, data: string) {
		test.strictEqual(makeKgGnsReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('Колобок', 'Магазин Колобок')
		check('Бимед Фарм', 'ОсОО Бимед Фарм')
		check('Mega City', 'Магазин "Mega City"')
	})
})

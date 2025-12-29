import test from 'node:assert/strict'
import { suite as describe, it } from 'node:test'
import { makeKzKtcReceiptTitle } from './kz-ktc'

describe('makeKzKtcReceiptTitle', () => {
	function check(dest: unknown, data: string) {
		test.strictEqual(makeKzKtcReceiptTitle(data), dest)
	}

	it('should use cleaned location name', () => {
		check('test', 'test')
		check('TOIMART', `Товарищество с ограниченной ответственностью "TOIMART"`)
		check(
			'PJ KAZAKHSTAN (ПИДЖЕЙ КАЗАХСТАН)',
			'ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "PJ KAZAKHSTAN (ПИДЖЕЙ КАЗАХСТАН)"',
		)
	})
})

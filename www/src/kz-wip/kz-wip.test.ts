import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { parseKzWipReceipt } from './kz-wip'

describe('parseKzWipReceipt', () => {
	it('should parse receipt with all fields', () => {
		const data = {
			data: {
				ticket: {
					id: 140123456,
					receipt_number: '5612340017',
					sum: 4280,
					company: {
						name: 'ТОО "Алма-Маркет"',
						bin: '241180007755',
					},
					cashbox: {
						factory_number: 'WPKS0000018765',
						registration_number: '600407890704',
						address: 'г.Алматы, р-н Медеуский, ул. Толе Би, д. 55',
						sale_point: {
							name: 'Магазин',
						},
					},
					employee: {
						user: { name: 'Марат' },
					},
					shift: { number: 42 },
					ticket_items: [
						{
							name: 'КИМБАП С КУРИЦЕЙ 210ГР',
							price: 1650,
							quantity: '2.000',
							discount: 0,
							sum: 3300,
						},
						{
							name: 'ЛАПША ОСТРАЯ ГОВЯДИНА 120Г',
							price: 690,
							quantity: '1.000',
							discount: 0,
							sum: 690,
						},
						{
							name: 'НАПИТОК ЧАЙ МАНГО 500МЛ',
							price: 590,
							quantity: '1.000',
							discount: 300,
							sum: 290,
						},
					],
					ofd_data: {
						qr: 'https://app.kassa.wipon.kz/consumer?i=5612340017&f=600407890704&s=4280.00&t=20260310T093045',
					},
					share_link: 'http://example.com',
				},
			},
		}

		const result = parseKzWipReceipt(data)

		test.deepStrictEqual(result, {
			orgName: 'ТОО "Алма-Маркет"',
			orgId: '241180007755',
			receiptNumber: '140123456',
			shiftNumber: '42',
			fiscalId: '5612340017',
			cashierName: 'Марат',
			kkmSerialNumber: 'WPKS0000018765',
			kkmFnsId: '600407890704',
			totalSum: 4280,
			placeAddress: 'г.Алматы, р-н Медеуский, ул. Толе Би, д. 55',
			placeName: 'Магазин',
			shareLink: 'http://example.com',
			items: [
				{ name: 'КИМБАП С КУРИЦЕЙ 210ГР', quantity: 2, price: 1650, sum: 3300 },
				{ name: 'ЛАПША ОСТРАЯ ГОВЯДИНА 120Г', quantity: 1, price: 690, sum: 690 },
				{ name: 'НАПИТОК ЧАЙ МАНГО 500МЛ', quantity: 1, price: 590, sum: 290 },
			],
			parseErrors: [],
		})
	})

	it('should handle missing ticket gracefully', () => {
		const result = parseKzWipReceipt({ data: {} })

		test.strictEqual(result.orgName, undefined)
		test.strictEqual(result.totalSum, undefined)
		test.deepStrictEqual(result.items, [])
		test.deepStrictEqual(result.parseErrors, ['Не найден объект data.ticket'])
	})

	it('should handle missing optional fields', () => {
		const data = {
			data: {
				ticket: {
					sum: 500,
					ticket_items: [{ name: 'Товар А', price: 500, quantity: '1.000', discount: 0, sum: 500 }],
				},
			},
		}

		const result = parseKzWipReceipt(data)

		test.strictEqual(result.orgName, undefined)
		test.strictEqual(result.orgId, undefined)
		test.strictEqual(result.kkmSerialNumber, undefined)
		test.strictEqual(result.cashierName, undefined)
		test.strictEqual(result.shiftNumber, undefined)
		test.strictEqual(result.totalSum, 500)
		test.deepStrictEqual(result.items, [{ name: 'Товар А', quantity: 1, price: 500, sum: 500 }])
		test.deepStrictEqual(result.parseErrors, [])
	})

	it('should parse items with fractional quantities', () => {
		const data = {
			data: {
				ticket: {
					sum: 2750,
					ticket_items: [
						{
							name: 'Сыр Голландский 1кг',
							price: 5500,
							quantity: '0.500',
							discount: 0,
							sum: 2750,
						},
					],
				},
			},
		}

		const result = parseKzWipReceipt(data)

		test.deepStrictEqual(result.items, [
			{ name: 'Сыр Голландский 1кг', quantity: 0.5, price: 5500, sum: 2750 },
		])
	})
})

import test from 'node:assert/strict'
import { describe, it } from 'node:test'

import { searchBinary } from './utils'

describe('searchBinary', () => {
	it('should return element index and status', () => {
		const t = [
			[[], 0, 0, false],
			[[1], 0, 0, false],
			[[1], 1, 0, true],
			[[1], 2, 1, false],
			[[1, 2], 0, 0, false],
			[[1, 2], 1, 0, true],
			[[1, 2], 2, 1, true],
			[[1, 2], 3, 2, false],
		] as const
		for (const [arr, elem, index, exists] of t) {
			test.strictEqual(searchBinary(arr, elem, (a, b) => a - b)[0], index, `index: ${arr} ${elem}`)
			test.strictEqual(searchBinary(arr, elem, (a, b) => a - b)[1], exists, `exists: ${arr} ${elem}`)
		}
	})
})

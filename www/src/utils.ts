export function onError(err: unknown): void {
	// eslint-disable-next-line no-console
	console.error(err)
}

export function isAbortError(err: unknown): boolean {
	return err instanceof Error && err.name === 'AbortError'
}

export function isNil(x: unknown): x is null | undefined {
	return x == void 0
}

export function mustBeNotNull<T>(val: T | null): T {
	if (val === null) throw new Error('must not be null')
	return val
}

export function mustBeDefined<T>(val: T | undefined): T {
	if (val === undefined) throw new Error('must not be undefined')
	return val
}

export function searchBinary<T>(
	arr: readonly T[],
	elem: T,
	sortFunc: (a: T, b: T) => number,
): [number, boolean] {
	let startI = 0
	let endI = arr.length
	while (startI < endI) {
		const midI = Math.floor((startI + endI) / 2)
		const cmp = sortFunc(elem, arr[midI])
		if (cmp < 0) {
			endI = midI
		} else if (cmp > 0) {
			startI = midI + 1
		} else {
			return [midI, true]
		}
	}
	return [startI, false]
}

function pad00(num: number): string {
	return num < 10 ? '0' + num : '' + num
}

export function dateStrAsYMDHM(str: string): string {
	const date = new Date(str)
	const y = date.getFullYear()
	const m = pad00(date.getMonth() + 1)
	const d = pad00(date.getDate())
	const hr = pad00(date.getHours())
	const mn = pad00(date.getMinutes())
	return `${y}-${m}-${d} ${hr}:${mn}`
}

export function optStr(val: unknown): string | null | undefined {
	if (typeof val === 'string') return val
	if (isNil(val)) return val
	return val + ''
}

export function urlWithoutProtocol(url: string): string {
	// https://en.wikipedia.org/wiki/URL#Syntax
	return url.replace(/^[a-z][a-z0-9.+-]+:\/\//i, '')
}

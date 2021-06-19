export function onError(err) {
	// eslint-disable-next-line no-console
	console.error(err)
}

/**
 * @template T
 * @param {T|null} val
 * @returns {T}
 */
export function mustBeNotNull(val) {
	if (val === null) throw new Error('must not be null')
	return val
}

/**
 * @template {{new (...args: any): any}[]} T
 * @param {any} obj
 * @param {T} classes
 * @returns {InstanceType<T[number]>}
 */
export function mustBeInstanceOf(obj, ...classes) {
	for (const class_ of classes) {
		if (obj instanceof class_) return obj
	}
	throw new Error(`object is ${obj}, expected ${classes.map(x => x.name).join('|')}`)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>|null}
 */
export function $inOpt(parent, selector, class_) {
	const elem = parent.querySelector(selector)
	return mustBeInstanceOf(elem, class_)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $in(parent, selector, class_) {
	const elem = $inOpt(parent, selector, class_)
	if (elem === null) throw new Error(`elem not found in ${parent} by '${selector}'`)
	return elem
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>|null}
 */
export function $opt(selector, class_) {
	return $inOpt(document, selector, class_)
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $(selector, class_) {
	const elem = $opt(selector, class_)
	if (elem === null) throw new Error(`elem not found by '${selector}'`)
	return elem
}

/**
 * @template {Node} T
 * @param {T} node
 * @returns {T}
 */
export function cloneNodeDeep(node) {
	return /** @type {T} */ (node.cloneNode(true))
}

/**
 * @template T
 * @param {T[]} arr
 * @param {T} elem
 * @param {(a: T, b: T) => number} sortFunc
 * @returns {[number,boolean]}
 */
export function searchBinary(arr, elem, sortFunc) {
	/*
	f = (a,b) => a-b
	;[
		[[],    0, 0, false],
		[[1],   0, 0, false],
		[[1],   1, 0, true],
		[[1],   2, 1, false],
		[[1,2], 0, 0, false],
		[[1,2], 1, 0, true],
		[[1,2], 2, 1, true],
		[[1,2], 3, 2, false],
	].forEach(([arr, elem, index, exists]) => {
		console.assert(searchBinary(arr, elem, f)[0] === index, `index: ${arr} ${elem}`)
		console.assert(searchBinary(arr, elem, f)[1] === exists, `exists: ${arr} ${elem}`)
	})
	*/
	let startI = 0
	let endI = arr.length
	while (startI < endI) {
		let midI = Math.floor((startI + endI) / 2)
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

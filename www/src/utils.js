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
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>|null}
 */
export function $opt(selector, class_) {
	const elem = document.querySelector(selector)
	return mustBeInstanceOf(elem, class_)
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

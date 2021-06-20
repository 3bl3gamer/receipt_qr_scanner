/**
 * @typedef {{
 *   fiscalNum: string,
 *   fiscalDoc: string,
 *   fiscalSign: string,
 *   kind: string,
 *   summ: string,
 *   createdAt: string,
 * }} ReceiptRef
 */

/**
 * @typedef {{
 *   id: number,
 *   savedAt: string,
 *   updatedAt: string,
 *   ref: ReceiptRef,
 *   isCorrect: boolean,
 *   refText: string,
 *   data: string,
 *   searchKey: string,
 *   retriesLeft: number,
 *   nextRetryAt: string,
 * }} Receipt
 */

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
 * @param {ParentNode} parent
 * @param {string} selector
 */
export function $removeIn(parent, selector) {
	const elems = parent.querySelectorAll(selector)
	for (let i = 0; i < elems.length; i++) elems[i].remove()
}

/**
 * @template {{new (...args: any): any}} T
 * @param {string} selector
 * @param {T} class_
 * @returns {InstanceType<T>}
 */
export function $template(selector, class_) {
	const elem = cloneNodeDeep($(selector, class_))
	elem.classList.remove('template')
	return elem
}

/**
 * @param {ParentNode} parent
 * @param {string} selector
 * @param {Node} child
 */
export function $child(parent, selector, child) {
	const elem = $in(parent, selector, Element)
	elem.innerHTML = ''
	elem.appendChild(child)
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
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {string|null|undefined} [className]
 * @param {string|Node|null|undefined} [child]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createElem(tagName, className, child) {
	const el = document.createElement(tagName)
	if (className) el.className = className
	if (typeof child === 'string') {
		el.appendChild(document.createTextNode(child))
	} else if (child) {
		el.appendChild(child)
	}
	return el
}

/**
 * @param {string|Node|null|undefined} [child]
 * @returns {DocumentFragment}
 */
export function createFragment(child) {
	const frag = document.createDocumentFragment()
	if (typeof child === 'string') {
		frag.appendChild(document.createTextNode(child))
	} else if (child) {
		frag.appendChild(child)
	}
	return frag
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

function pad00(num) {
	return num < 10 ? '0' + num : '' + num
}

export function dateStrAsYMDHM(str) {
	const date = new Date(str)
	const y = date.getFullYear()
	const m = pad00(date.getMonth() + 1)
	const d = pad00(date.getDate())
	const hr = pad00(date.getHours())
	const mn = pad00(date.getMinutes())
	return `${y}-${m}-${d} ${hr}:${mn}`
}

/**
 * @param {Receipt} rec
 * @returns {Record<string, any>|null}
 */
export function getReceiptDataFrom(rec) {
	if (!rec.data) return null
	const data = JSON.parse(rec.data)
	if ('ticket' in data) return data.ticket.document.receipt //FNS API version 2
	return data.document.receipt //FNS API version 1
}

/**
 * @param {Record<string, any>|null} recData
 * @param {string} blank
 * @returns {string}
 */
export function makeReceiptTitle(recData, blank) {
	if (recData !== null) {
		if (recData.retailPlace) return recData.retailPlace.replace(/^магазин\s/i, '').trim()
		if (recData.user) return recData.user.replace(/общество с ограниченной ответственностью/i, '').trim()
	}
	return blank
}

/**
 * @param {string} text
 * @param {string} substr
 * @param {number} [maxFirstOffset]
 * @param {number} [maxTotalLen]
 * @returns {DocumentFragment|null}
 */
export function highlightedIfFound(text, substr, maxFirstOffset, maxTotalLen) {
	if (substr.length == 0) return null
	let textLC = text.toLowerCase()
	substr = substr.toLowerCase()

	const res = createFragment()
	let prevEnd = 0
	while (true) {
		const isFirstIter = prevEnd === 0
		let index = textLC.indexOf(substr, prevEnd) //не совсем правильно, но для русских и английских символов должно работать
		if (isFirstIter && index === -1) return null
		if (index === -1) index = text.length

		if (prevEnd === 0 && maxFirstOffset !== undefined && index > maxFirstOffset) {
			const offset = index - Math.ceil(maxFirstOffset * 0.8)
			text = '…' + text.slice(offset)
			textLC = '…' + textLC.slice(offset)
			index = index - offset + '…'.length
		}

		if (maxTotalLen !== undefined && index > maxTotalLen) {
			res.appendChild(document.createTextNode(text.slice(prevEnd, maxTotalLen) + '…'))
			break
		}
		res.appendChild(document.createTextNode(text.slice(prevEnd, index)))
		if (index === text.length) break

		res.appendChild(createElem('span', 'highlight', text.slice(index, index + substr.length)))
		prevEnd = index + substr.length
	}
	return res
}

/** @param {number} summ */
export function dimKops(summ) {
	const [int, fract] = summ.toFixed(2).split('.')
	const frag = createFragment()
	frag.appendChild(document.createTextNode(int))
	frag.appendChild(createElem('span', 'kopeks', '.' + fract))
	return frag
}

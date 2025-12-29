import { JSX } from 'preact/jsx-runtime'

import { highlightedIfFound } from './HighlightedText'

/**
 * Выводит целую часть суммы и немного приглушённую дробную (два знака).
 *
 *    `123.456 -> 123<span className="kopeks">.46</span>`
 */
export function DimmedKopeks({
	value,
	searchQuery = '',
}: {
	value?: number
	/** опциональная подстрока для поика и подсветки */
	searchQuery?: string
}): JSX.Element {
	if (value === undefined) return <>—</>

	const text = value.toFixed(2)

	const highlighted = highlightedIfFound(text, searchQuery)
	if (highlighted) return highlighted

	const [int, fract] = text.split('.')
	return (
		<>
			{int}
			<span className="kopeks">.{fract}</span>
		</>
	)
}

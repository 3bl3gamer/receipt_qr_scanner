import { JSX } from 'preact/jsx-runtime'

/**
 * Подсвечивает искомую подстроку в тексте.
 *
 * Если подстрока не задана, возвращает текст как есть.
 */
export function HighlightedText({
	text,
	searchQuery,
	maxFirstOffset,
	maxTotalLen,
	suffix = '',
}: {
	text: string | number | null | undefined
	searchQuery?: string
	/**
	 * макс.длина текста перед первым вхождением подстроки, заменяет начало текста на "…":
	 * "longprefix[text]" -> "…fix[text]"
	 */
	maxFirstOffset?: number
	/**
	 * макс.длина возвращаемой строки, заменяет конец текста на "…":
	 * "[text]longsuffix" -> "[text]long…"
	 */
	maxTotalLen?: number
	/** опциональный суффикс для текста (может быть подсвечен) */
	suffix?: string
}) {
	const res = highlightedIfFound(text, searchQuery, maxFirstOffset, maxTotalLen, suffix)
	return res ?? <>{text ?? '—'}</>
}

/**
 * Подсвечивает искомую подстроку в тексте.
 *
 * Если подстрока не задана или не найдена, возвращает null.
 */
export function highlightedIfFound(
	text: string | number | null | undefined,
	searchQuery?: string,
	/**
	 * макс.длина текста перед первым вхождением подстроки, заменяет начало текста на "…":
	 * "longprefix[text]" -> "…fix[text]"
	 */
	maxFirstOffset?: number,
	/**
	 * макс.длина возвращаемой строки, заменяет конец текста на "…":
	 * "[text]longsuffix" -> "[text]long…"
	 */
	maxTotalLen?: number,
	/** опциональный суффикс для текста (может быть подсвечен) */
	suffix: string = '',
): JSX.Element | null {
	if (text === '') return null

	const textStr = String(text) + suffix

	if (!searchQuery) return null

	// регистро-незавимиый поиск
	let workingText = textStr
	let workingTextLC = textStr.toLowerCase()
	const substrLC = searchQuery.toLowerCase()

	const parts = []
	let prevEnd = 0
	let key = 0

	while (true) {
		const isFirstIter = prevEnd === 0
		let index = workingTextLC.indexOf(substrLC, prevEnd) //не совсем правильно, но для латинцы и кириллицы обычно должно работать

		if (isFirstIter && index === -1) return null
		if (index === -1) index = workingText.length

		// обрезка по maxFirstOffset
		if (prevEnd === 0 && maxFirstOffset !== undefined && index > maxFirstOffset) {
			const offset = index - Math.ceil(maxFirstOffset * 0.8)
			workingText = '…' + workingText.slice(offset)
			workingTextLC = '…' + workingTextLC.slice(offset)
			index = index - offset + '…'.length
		}

		// обрезка по maxTotalLen
		if (maxTotalLen !== undefined && index > maxTotalLen) {
			parts.push(workingText.slice(prevEnd, maxTotalLen) + '…')
			break
		}

		// обычный текст перед подстрокой
		parts.push(workingText.slice(prevEnd, index))

		if (index === workingText.length) break

		// подсвеченный текст
		parts.push(
			<span key={key++} className="highlight">
				{workingText.slice(index, index + substrLC.length)}
			</span>,
		)

		prevEnd = index + substrLC.length
	}

	if (parts.length === 1 && typeof parts[0] === 'string') return null

	return <>{parts}</>
}

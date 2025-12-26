import { describe, it } from 'node:test'
import test from 'node:assert/strict'
import { render } from '@testing-library/preact'
// @ts-expect-error нужно бы добавить allowImportingTsExtensions, но он ломает билд
import { highlightedIfFound, HighlightedText } from './HighlightedText.tsx'

describe('HighlightedText', () => {
	describe('no text', () => {
		it('should render "—" for null text', () => {
			const { container } = render(<HighlightedText text={null} searchQuery="nu" suffix="bla" />)
			test.strictEqual(container.innerHTML, '—')
		})

		it('should render "—" for undefined text', () => {
			const { container } = render(<HighlightedText text={undefined} searchQuery="und" suffix="bla" />)
			test.strictEqual(container.innerHTML, '—')
		})
	})

	it('should render plain text without search query', () => {
		const { container } = render(<HighlightedText text="hello world" />)
		test.strictEqual(container.innerHTML, 'hello world')
	})

	it('should render highlighted text with search query', () => {
		const { container } = render(<HighlightedText text="hello world" searchQuery="world" />)
		test.strictEqual(container.innerHTML, 'hello <span class="highlight">world</span>')
	})

	it('should render plain text when search query not found', () => {
		const { container } = render(<HighlightedText text="hello world" searchQuery="notfound" />)
		test.strictEqual(container.innerHTML, 'hello world')
	})

	it('should highlight suffix', () => {
		const { container } = render(<HighlightedText text="hello" suffix=" world!" searchQuery="world" />)
		test.strictEqual(container.innerHTML, 'hello <span class="highlight">world</span>!')
	})

	it('should pass maxFirstOffset to highlightedIfFound', () => {
		const { container } = render(
			<HighlightedText text="hello world" searchQuery="world" maxFirstOffset={3} />,
		)
		test.strictEqual(container.innerHTML, '…lo <span class="highlight">world</span>')
	})

	it('should pass maxTotalLen to highlightedIfFound', () => {
		const { container } = render(
			<HighlightedText text="world hello world" searchQuery="world" maxTotalLen={5 + 3} />,
		)
		test.strictEqual(container.innerHTML, '<span class="highlight">world</span> he…')
	})
})

describe('highlightedIfFound', () => {
	it('should return null when test is blank', () => {
		test.strictEqual(highlightedIfFound(null), null)
		test.strictEqual(highlightedIfFound(undefined), null)
		test.strictEqual(highlightedIfFound(''), null)
	})

	it('should return null when no search query is blank', () => {
		test.strictEqual(highlightedIfFound('hello world', undefined), null)
		test.strictEqual(highlightedIfFound('hello world', ''), null)
	})

	it('should return null when search query is not found', () => {
		test.strictEqual(highlightedIfFound('hello world', 'notfound'), null)
	})

	it('should highlight single occurrence', () => {
		const { container } = render(highlightedIfFound('hello world', 'world'))
		test.strictEqual(container.innerHTML, 'hello <span class="highlight">world</span>')
	})

	it('should highlight multiple occurrences', () => {
		const { container } = render(highlightedIfFound('test test test', 'test'))
		test.strictEqual(
			container.innerHTML,
			'<span class="highlight">test</span> <span class="highlight">test</span> <span class="highlight">test</span>',
		)
	})

	it('should perform case-insensitive search', () => {
		const { container } = render(highlightedIfFound('Hello World', 'WORLD'))
		// оригинальный регистр должен сохраниться
		test.strictEqual(container.innerHTML, 'Hello <span class="highlight">World</span>')
	})

	it('should perform case-insensitive search with cyrillic', () => {
		const { container } = render(highlightedIfFound('Привет Мир', 'мир'))
		test.strictEqual(container.innerHTML, 'Привет <span class="highlight">Мир</span>')
	})

	it('should handle number input', () => {
		const { container } = render(highlightedIfFound(12345, '234'))
		test.strictEqual(container.innerHTML, '1<span class="highlight">234</span>5')
	})

	it('should handle suffix parameter', () => {
		const { container } = render(highlightedIfFound('hello', 'world', null, null, ' world'))
		test.strictEqual(container.innerHTML, 'hello <span class="highlight">world</span>')
	})

	it('should truncate text before first match with maxFirstOffset', () => {
		let { container } = render(highlightedIfFound('654321match', 'match', 4 / 0.8))
		test.strictEqual(container.innerHTML, '…4321<span class="highlight">match</span>')
		;({ container } = render(highlightedIfFound('54321match', 'match', 4 / 0.8)))
		test.strictEqual(container.innerHTML, '54321<span class="highlight">match</span>')
	})

	it('should truncate total length with maxTotalLen', () => {
		let { container } = render(highlightedIfFound('match12345', 'match', null, 5 + 4))
		test.strictEqual(container.innerHTML, '<span class="highlight">match</span>1234…')
		;({ container } = render(highlightedIfFound('match1234', 'match', null, 5 + 4)))
		test.strictEqual(container.innerHTML, '<span class="highlight">match</span>1234')
	})

	it('should combine maxFirstOffset and maxTotalLen', () => {
		const { container } = render(
			highlightedIfFound('long before match long after', 'match', 4 / 0.8, 1 + 4 + 5 + 5),
		)
		test.strictEqual(container.innerHTML, '…ore <span class="highlight">match</span> long…')
	})
})

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'preact/hooks'
import { useReceiptsLoader } from '../hooks/useReceiptsLoader'
import { dateStrAsYMDHM } from '../utils'
import { getReceiptDataFrom } from 'receipts'
import { Receipt } from 'receipts'
import { highlightedIfFound, HighlightedText } from './HighlightedText'
import { ReceiptView } from './ReceiptView'
import { JSX } from 'preact/jsx-runtime'
import { ReceiptsSortMode } from 'api'
import { useDomainsMetadata } from '../contexts/DomainsMetadataContext'

/**
 * Панель со списокм чеков.
 *
 * Занимается подгрузкой, поиском, сортировкой чеков,
 * а также показывает попап с полными данными чека.
 */
export function ReceiptListPanel() {
	const [sortMode, setSortMode] = useState<ReceiptsSortMode>('id')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
	const [isPanelHidden, setIsPanelHidden] = useState(true)

	const onFilterChange = useCallback((newSortMode: ReceiptsSortMode, newSearchQuery: string) => {
		setSortMode(newSortMode)
		setSearchQuery(newSearchQuery)
	}, [])

	const onReceiptClick = useCallback((receipt: Receipt) => {
		setSelectedReceipt(receipt)
	}, [])
	const onReceiptViewClose = useCallback(() => {
		setSelectedReceipt(null)
	}, [])

	const onPanelClick = useCallback(
		(e: MouseEvent) => {
			if (isPanelHidden) {
				setIsPanelHidden(false)
				e.stopPropagation()
				return
			}

			const isCollapseBtn =
				e.target instanceof Element && e.target.classList.contains('receipt-side-panel-collapse-btn')
			if (isCollapseBtn) {
				setIsPanelHidden(true)
			}
		},
		[isPanelHidden],
	)

	return (
		<>
			<div class={`receipt-side-panel${isPanelHidden ? ' hidden' : ''}`} onClickCapture={onPanelClick}>
				<div class="receipt-filter-wrap">
					<button class="receipt-side-panel-collapse-btn">&gt;&gt;</button>
					<ReceiptFilterForm
						sortMode={sortMode}
						searchQuery={searchQuery}
						onChange={onFilterChange}
					/>
				</div>
				<ReceiptList sortMode={sortMode} searchQuery={searchQuery} onItemClick={onReceiptClick} />
			</div>
			{selectedReceipt && (
				<ReceiptView
					receipt={selectedReceipt}
					searchQuery={searchQuery}
					onClose={onReceiptViewClose}
				/>
			)}
		</>
	)
}

/**
 * Панель с фильтром и сортировкой списка чеков.
 */
function ReceiptFilterForm({
	sortMode,
	searchQuery,
	onChange,
}: {
	sortMode: ReceiptsSortMode
	searchQuery: string
	onChange: (sortMode: ReceiptsSortMode, searchQuery: string) => void
}) {
	const onFormChange = useCallback(
		(e: preact.TargetedEvent<HTMLFormElement, Event>) => {
			const form = e.currentTarget
			const newSortMode = (form.elements.namedItem('sort_mode') as HTMLInputElement)
				.value as ReceiptsSortMode
			const newSearchQuery = (form.elements.namedItem('search') as HTMLInputElement).value
			onChange(newSortMode, newSearchQuery)
		},
		[onChange],
	)

	const onSubmit = useCallback((e: Event) => {
		e.preventDefault()
	}, [])

	return (
		<form class="receipt-filter-form" onChange={onFormChange} onSubmit={onSubmit}>
			<div>
				⇅{' '}
				<label>
					<input type="radio" name="sort_mode" value="id" checked={sortMode === 'id'} />
					id
				</label>{' '}
				<label>
					<input
						type="radio"
						name="sort_mode"
						value="created_at"
						checked={sortMode === 'created_at'}
					/>
					время
				</label>
			</div>
			<div>
				<input type="text" name="search" placeholder="поиск" value={searchQuery} />
			</div>
		</form>
	)
}

/**
 * Собственно список чеков. С подгрузкой.
 */
function ReceiptList({
	sortMode,
	searchQuery,
	onItemClick,
}: {
	sortMode: ReceiptsSortMode
	searchQuery: string
	onItemClick: (receipt: Receipt) => void
}) {
	const listWrapRef = useRef<HTMLDivElement | null>(null)

	const {
		receipts,
		isLoadingChunk: isLoading,
		loadChunk: loadNextChunk,
	} = useReceiptsLoader(sortMode, searchQuery)

	// откручиваем список наверх при изменении сортировки и/или фильтра
	useEffect(() => {
		if (listWrapRef.current) {
			listWrapRef.current.scrollTop = 0
		}
	}, [sortMode, searchQuery])

	// подгрузка при скролле
	useEffect(() => {
		const list = listWrapRef.current
		if (!list) return

		const handleScroll = () => {
			if (listWrapRef.current) {
				const { scrollTop, clientHeight, scrollHeight } = listWrapRef.current
				const isNearBottom = scrollTop + clientHeight > scrollHeight - 512
				if (isNearBottom) {
					loadNextChunk()
				}
			}
		}

		list.addEventListener('scroll', handleScroll, { passive: true })
		return () => list.removeEventListener('scroll', handleScroll)
	}, [loadNextChunk])

	const prevTopReceiptId = useRef<number | undefined>()
	const shouldTriggerTopReceiptAnimation =
		receipts.length > 0 && receipts.at(1)?.id === prevTopReceiptId.current
	prevTopReceiptId.current = receipts.at(0)?.id

	return (
		<div ref={listWrapRef} class={`receipt-list-wrap${isLoading ? ' stale' : ''}`}>
			{receipts.map((receipt, index) => (
				<ReceiptListItem
					key={receipt.id}
					receipt={receipt}
					searchQuery={searchQuery}
					onClick={onItemClick}
					isNew={index === 0 && shouldTriggerTopReceiptAnimation}
				/>
			))}
		</div>
	)
}

/**
 * Элемент списка чеков.
 */
function ReceiptListItem({
	receipt,
	searchQuery,
	onClick,
	isNew,
}: {
	receipt: Receipt
	searchQuery: string
	onClick: (receipt: Receipt) => void
	isNew: boolean
}) {
	const itemRef = useRef<HTMLDivElement | null>(null)
	const { domainsMetadata } = useDomainsMetadata()
	const data = getReceiptDataFrom(receipt)

	// принудительно запускаем анимацию (сработает только для новых элементов; а для других и не надо)
	useLayoutEffect(() => {
		if (isNew && itemRef.current) {
			itemRef.current.classList.add('collapsed')
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			itemRef.current.offsetWidth
			itemRef.current?.classList.remove('collapsed')
		}
	}, [isNew])

	const classes = ['receipt-list-item']
	if (receipt.isCorrect) classes.push('correct')
	if (data) classes.push('filled')
	if (!receipt.isCorrect && receipt.retriesLeft === 0) classes.push('failed')

	const onClickInner = useCallback(() => {
		onClick(receipt)
	}, [onClick, receipt])

	const flagSymbol = domainsMetadata.get(receipt.domain)?.flagSymbol
	const currencySuffix = data ? ' ' + (domainsMetadata.get(receipt.domain)?.currencySymbol ?? '?') : ''

	return (
		<div ref={itemRef} class={classes.join(' ')} onClick={onClickInner}>
			<div class="title">
				<div class="value">
					<HighlightedText text={data?.common.title} searchQuery={searchQuery} />
				</div>
				<div class="flag">
					<HighlightedText text={flagSymbol} searchQuery={searchQuery} />
				</div>
			</div>
			<div class="main-info">
				<time class="created_at">
					<HighlightedText text={dateStrAsYMDHM(receipt.createdAt)} searchQuery={searchQuery} />
				</time>
				<div class="total_sum">
					<HighlightedText
						text={data?.common.totalSum?.toFixed(2)}
						suffix={currencySuffix}
						searchQuery={searchQuery}
					/>
				</div>
			</div>
			<div class="sub-info">
				<div class="retail_place_address">
					<HighlightedText text={data?.common.address} searchQuery={searchQuery} />
				</div>
			</div>
			<div class="sub-info">
				<div class="id">#{receipt.id}</div>
				<div class="items_count">{data?.common.itemsCount || '??'} шт</div>
				<div class="retries_left">x{receipt.retriesLeft}</div>
			</div>
			<ItemSearchDetails
				receipt={receipt}
				data={data}
				searchQuery={searchQuery}
				currencySuffix={currencySuffix}
			/>
		</div>
	)
}

/**
 * Данные чека, которые подошли под поиск (searchQuery).
 */
function ItemSearchDetails({
	receipt,
	data,
	searchQuery,
	currencySuffix,
}: {
	receipt: Receipt
	data: ReturnType<typeof getReceiptDataFrom>
	searchQuery: string
	currencySuffix: string
}) {
	if (searchQuery === '') return null

	let content: JSX.Element | null = null

	// ищем среди товаров
	if (data !== null) {
		for (const item of data.common.items) {
			const hightlight = highlightedIfFound(item.name, searchQuery)
			if (hightlight !== null) {
				content = (
					<>
						<span class="price">{item.price?.toFixed(2) + currencySuffix}</span>{' '}
						{item.quantity !== 1 && <span class="quantity">x{item.quantity}</span>} {hightlight}
					</>
				)
				break
			}
		}
	}

	// ищем в searchKey'е
	if (content === null) {
		content = highlightedIfFound(receipt.searchKey, searchQuery, 20, 60)
	}

	if (!content) return null

	return <div class="searched_details">{content}</div>
}

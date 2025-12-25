import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { onError, searchBinary, Receipt, isAbortError } from '../utils'
import { fetchReceipts, makeReceiptsEventSource, ReceiptsSortMode } from 'api'

/**
 * Загружает/подгружает чеки частями, слушает серверные события обновления чеков.
 */
export function useReceiptsLoader(
	sortMode: ReceiptsSortMode,
	searchQuery: string,
): {
	receipts: Receipt[]
	isLoadingChunk: boolean
	hasFullyLoaded: boolean
	loadChunk: () => void
} {
	const [receipts, setReceipts] = useState<Receipt[]>([])
	const [baseReceiptForNextChunk, setBaseReceiptForNextChunk] = useState<Receipt | null>(null)
	const [isLoadingChunk, setIsLoadingChunk] = useState(false)
	const [hasFullyLoaded, setHasFullyLoaded] = useState(false)

	const abortControllerRef = useRef(new AbortController())

	// загрузка первого чанка через SSE, слушанье обновлений отдельных чеков
	useEffect(() => {
		setIsLoadingChunk(true)
		setHasFullyLoaded(false)
		setBaseReceiptForNextChunk(null)

		let eventSource: EventSource | null = null
		let hasReceivedInitialChunk = false
		start()

		function start() {
			stop()
			eventSource = makeReceiptsEventSource(sortMode, searchQuery, {
				onInitialReceipts,
				onReceipt,
				onError,
			})
		}
		function stop() {
			eventSource?.close()
		}

		function onInitialReceipts(receipts: Receipt[]) {
			setIsLoadingChunk(false)
			// если это первая загрузка чанка (а не загрузка после переподключения)
			if (!hasReceivedInitialChunk) {
				setReceipts(receipts)
				setBaseReceiptForNextChunk(receipts.at(-1) ?? null)
			}
			hasReceivedInitialChunk = true
		}
		function onReceipt(newReceipt: Receipt) {
			setReceipts(prev => {
				const [index, exists] = searchBinary(prev, newReceipt, getSortFunc(sortMode))
				if (exists) {
					// Update existing receipt
					return prev.map((r, i) => (i === index ? newReceipt : r))
				} else {
					// Insert new receipt at sorted position
					return [...prev.slice(0, index), newReceipt, ...prev.slice(index)]
				}
			})
		}
		function onError() {
			stop()
			setTimeout(() => {
				start()
			}, 2000)
		}

		// // для тестов
		// setInterval(() => {
		// 	setReceipts(prev => [
		// 		// ...prev,
		// 		{
		// 			id: (Math.random() * 1000) | 0,
		// 			domain: 'domain',
		// 			savedAt: 'savedAt',
		// 			updatedAt: 'updatedAt',
		// 			createdAt: 'createdAt',
		// 			refText: 'refText',
		// 			isCorrect: true,
		// 			data: 'data',
		// 			searchKey: 'searchKey',
		// 			retriesLeft: 10,
		// 			nextRetryAt: 'nextRetryAt',
		// 		},
		// 		...prev,
		// 	])
		// }, 1000)

		return () => {
			stop()
		}
	}, [sortMode, searchQuery])

	// загрузка следующего чанка
	const loadChunk = useCallback(() => {
		if (isLoadingChunk || hasFullyLoaded) return
		if (baseReceiptForNextChunk === null) return

		setIsLoadingChunk(true)

		abortControllerRef.current.abort()
		abortControllerRef.current = new AbortController()

		fetchReceipts(sortMode, searchQuery, baseReceiptForNextChunk, abortControllerRef.current.signal)
			.then(res => {
				if (!res.ok) throw new Error(`${res.error}: ${res.description}`)
				if (res.result.length === 0) {
					setHasFullyLoaded(true)
				} else {
					setReceipts(prev => [...prev, ...res.result])
				}
				setBaseReceiptForNextChunk(res.result.at(-1) ?? null)
			})
			.catch((err: Error) => {
				if (!isAbortError(err)) {
					onError(err)
				}
			})
			.finally(() => {
				setIsLoadingChunk(false)
			})
	}, [isLoadingChunk, hasFullyLoaded, baseReceiptForNextChunk, sortMode, searchQuery])

	return {
		receipts,
		isLoadingChunk,
		hasFullyLoaded,
		loadChunk,
	}
}

function getSortFunc(sortMode: ReceiptsSortMode): (a: Receipt, b: Receipt) => number {
	if (sortMode === 'created_at') return (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id
	return (a, b) => b.id - a.id
}

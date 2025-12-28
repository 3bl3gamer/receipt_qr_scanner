import { Receipt } from 'receipts'

export type ApiResponse<T> = ApiResponseOk<T> | ApiResponseErr
export type ApiResponseOk<T> = { ok: true; result: T }
export type ApiResponseErr = { ok: false; code: number; error: string; description: string }

export type ReceiptsSortMode = 'id' | 'created_at'

export type ReceiptCreationResult = {
	exists: boolean
	domainCode: string
	createdAt: string
	sum: number
}

export type DomainMetadata = {
	domainCode: string
	currencySymbol: string
	flagSymbol: string
}

export class ApiError extends Error {
	constructor(res: ApiResponseErr) {
		super(`${res.error}: ${res.description}`)
	}
}

export function saveReceipt(refText: string): Promise<ApiResponse<ReceiptCreationResult>> {
	return fetch('./api/receipt', { method: 'POST', body: refText }) //
		.then(r => r.json())
}

export function fetchDomainsMetadata(): Promise<ApiResponse<DomainMetadata[]>> {
	return fetch('./api/domains_metadata') //
		.then(r => r.json())
}

export function fetchReceipts(
	sortMode: ReceiptsSortMode,
	searchQuery: string,
	baseReceiptForNextChunk: Receipt,
	signal: AbortSignal,
): Promise<ApiResponse<Receipt[]>> {
	const path = makeReceiptsListPath(false, sortMode, searchQuery, baseReceiptForNextChunk)
	return fetch(path, { signal }) //
		.then(r => r.json())
}

export function makeReceiptsEventSource(
	sortMode: ReceiptsSortMode,
	searchQuery: string,
	handlers: {
		onInitialReceipts: (receipts: Receipt[]) => unknown
		onReceipt: (receipt: Receipt) => unknown
		onError: () => unknown
	},
): EventSource {
	const path = makeReceiptsListPath(true, sortMode, searchQuery)
	const eventSource = new EventSource(path)

	eventSource.addEventListener('initial_receipts', (event: MessageEvent) => {
		handlers.onInitialReceipts(JSON.parse(event.data) as Receipt[])
	})
	eventSource.addEventListener('receipt', (event: MessageEvent) => {
		handlers.onReceipt(JSON.parse(event.data) as Receipt)
	})
	eventSource.addEventListener('error', () => {
		handlers.onError()
	})
	return eventSource
}

function makeReceiptsListPath(
	sse: boolean,
	sortMode: ReceiptsSortMode,
	searchQuery: string,
	lastReceipt?: Receipt,
) {
	let path = `./api/receipts_list?sse=${sse ? '1' : '0'}&sort_mode=${sortMode}&search=${encodeURIComponent(searchQuery)}`
	if (lastReceipt) {
		if (sortMode === 'created_at') {
			path += '&before_time=' + encodeURIComponent(new Date(lastReceipt.createdAt).toISOString())
		} else {
			path += '&before_id=' + lastReceipt.id
		}
	}
	return path
}

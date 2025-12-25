import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { QRCamScanner } from '../QRCamScanner'
import { DOMAIN_CURRENCY_SYMBOLS, guessDomain, parseRefText, onError } from '../utils'

type ScannedQRStatus = 'saving' | 'saved' | 'exists' | 'error'

type ScannedQRData = {
	text: string
	status: ScannedQRStatus
	errorMessage: string | null
	time: string
	summ: string
}

/**
 * Сканирует QR-коды с камеры или из файла, сохраняет отсканированное на сервер.
 */
export function Scanner() {
	const [shownScannedQRs, setShownScannedQRs] = useState<ScannedQRData[]>([])
	const shownScannedQRsRef = useRef(shownScannedQRs)
	shownScannedQRsRef.current = shownScannedQRs

	const videoWrapRef = useRef<HTMLDivElement>(null)
	const qrScannerRef = useRef<QRCamScanner | null>(null)

	const addOrReplaceScannedQR = useCallback((scannedQR: ScannedQRData) => {
		setShownScannedQRs(items => {
			const existingI = items.findIndex(x => x.text === scannedQR.text)
			if (existingI === -1) {
				items = [scannedQR, ...items]
				if (items.length > 3) items.pop()
			} else {
				items = [...items]
				items[existingI] = scannedQR
			}
			return items
		})
	}, [])

	const onScannedText = useCallback(
		(text: string) => {
			if (text === '') return

			if (!shownScannedQRsRef.current.find(x => x.text === text)) {
				const scannedQR = saveReceiptRefText(text, qrData => {
					addOrReplaceScannedQR({ ...qrData })
				})
				addOrReplaceScannedQR(scannedQR)
			}
		},
		[addOrReplaceScannedQR],
	)

	const onDebugToggle = useCallback(() => {
		qrScannerRef.current?.toggleDebug()
	}, [])

	const onFileUpload = useCallback(() => {
		const fileInput = document.createElement('input')
		fileInput.type = 'file'
		fileInput.accept = 'image/*'
		fileInput.onchange = () => {
			const file = fileInput.files?.[0]
			if (!file) return

			const img = new Image()
			img.src = window.URL.createObjectURL(file)
			img.onload = () => {
				window.URL.revokeObjectURL(img.src)
				const canvas = document.createElement('canvas')
				canvas.width = img.naturalWidth
				canvas.height = img.naturalHeight
				const rc = canvas.getContext('2d')
				if (!rc) return
				rc.drawImage(img, 0, 0)
				const data = rc.getImageData(0, 0, canvas.width, canvas.height)
				qrScannerRef.current?.scanFrameCanvasData(data)
			}
			img.onerror = () => {
				window.URL.revokeObjectURL(img.src)
			}
		}
		fileInput.click()
	}, [])

	// инициализация сканера
	useEffect(() => {
		if (!videoWrapRef.current) return

		if (qrScannerRef.current) throw new Error('QRCamScanner must NOT be re-created')
		qrScannerRef.current = new QRCamScanner(videoWrapRef.current, onScannedText)

		return () => {
			// TODO: cleanup
		}
	}, [onScannedText])

	return (
		<>
			<div className="receipt-info-box-wrap">
				{shownScannedQRs.map(qr => (
					<ScannedQRInfoBox key={qr.text} data={qr} />
				))}
			</div>
			<div ref={videoWrapRef} className="video-wrap" />
			<button className="debug-mode-image" onClick={onDebugToggle}>
				<img src="developer_mode_icon.svg" />
			</button>
			<button className="open-image" onClick={onFileUpload}>
				<img src="image_icon.svg" />
			</button>
		</>
	)
}

/**
 * Мелкая всплывающая плашка с краткими данными об отсканированном QR-коде.
 */
function ScannedQRInfoBox({ data }: { data: ScannedQRData }) {
	const boxRef = useRef<HTMLDivElement>(null)
	const [isNew, setIsNew] = useState(true)

	// анимация появления
	useLayoutEffect(() => {
		if (isNew && boxRef.current) {
			boxRef.current.classList.add('collapsed')
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			boxRef.current.offsetWidth
			boxRef.current?.classList.remove('collapsed')
			setIsNew(false)
		}
	}, [isNew])

	const domain = guessDomain(data.text)
	const curSym = DOMAIN_CURRENCY_SYMBOLS.get(domain) ?? '?'
	const label =
		`${data.time}, ${data.summ}\u00A0${curSym}, ${data.status}` +
		(data.errorMessage ? ': ' + data.errorMessage : '')

	return (
		<div ref={boxRef} className="receipt-info-box" data-status={data.status}>
			{label}
		</div>
	)
}

function saveReceiptRefText(text: string, onStatusChange: (qr: ScannedQRData) => void): ScannedQRData {
	const qr: ScannedQRData = {
		text,
		status: 'saving',
		errorMessage: null,
		time: '----.--.-- --:--',
		summ: '?.??',
	}

	const refData = parseRefText(null, text)
	if (refData) {
		const match = refData.createdAt?.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/)
		if (match) {
			const [, y, m, d, H, M] = match
			qr.time = `${y}.${m}.${d} ${H}:${M}`
		} else {
			qr.time = refData.createdAt?.replace('T', ' ') ?? qr.time
		}

		const summ = refData.sum === null ? NaN : parseFloat(refData.sum) / 100
		qr.summ = isNaN(summ) ? qr.summ : summ.toFixed(2)
	}

	fetch('./api/receipt', { method: 'POST', body: text })
		.then(r => r.json())
		.then(res => {
			if (res.ok) {
				qr.status = 'saved'
			} else if (res.error === 'ALREADY_EXISTS') {
				qr.status = 'exists'
			} else {
				qr.status = 'error'
				qr.errorMessage = res.error + (res.description ? ` (${res.description})` : '')
			}
			onStatusChange({ ...qr })
		})
		.catch(onError)

	return qr
}

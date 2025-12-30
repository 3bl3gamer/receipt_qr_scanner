import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'

import { saveReceipt } from '../api'
import { useDomainsMetadata } from '../contexts/DomainsMetadataContext'
import { QRCamScanner } from '../QRCamScanner'
import { dateStrAsYMDHM, onError } from '../utils'
import { DeveloperModeIcon, ImageIcon, PasteIcon } from './icons'

type ScannedQRStatus = 'saving' | 'saved' | 'exists' | 'error'

type ScannedQRData = {
	status: ScannedQRStatus
	refText: string
	domain?: string
	time?: string
	summ?: number
	errorMessage?: string
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
			const existingI = items.findIndex(x => x.refText === scannedQR.refText)
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
		(refText: string) => {
			if (refText === '') return

			if (!shownScannedQRsRef.current.find(x => x.refText === refText)) {
				const qr: ScannedQRData = { status: 'saving', refText }

				addOrReplaceScannedQR(qr)

				saveReceipt(refText)
					.then(res => {
						const updQr = { ...qr }
						if (res.ok) {
							updQr.status = res.result.exists ? 'exists' : 'saved'
							updQr.domain = res.result.domainCode
							updQr.time = dateStrAsYMDHM(res.result.createdAt)
							updQr.summ = res.result.sum
						} else {
							updQr.status = 'error'
							updQr.errorMessage = res.error + (res.description ? ` (${res.description})` : '')
						}
						addOrReplaceScannedQR(updQr)
					})
					.catch(onError)
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

	const onTextPaste = useCallback(async () => {
		const text = prompt('Текст из QR-кода:')
		if (text && text.trim()) {
			onScannedText(text.trim())
		}
	}, [onScannedText])

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
					<ScannedQRInfoBox key={qr.refText} data={qr} />
				))}
			</div>
			<div ref={videoWrapRef} className="video-wrap" />
			<button className="debug-mode-image" onClick={onDebugToggle}>
				<DeveloperModeIcon />
			</button>
			<button className="open-image" onClick={onFileUpload}>
				<ImageIcon />
			</button>
			<button className="paste-text" onClick={onTextPaste}>
				<PasteIcon />
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
	const { domainsMetadata } = useDomainsMetadata()

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

	const time = data.time ?? '----.--.-- --:--'
	const summ = data.summ?.toFixed(data.summ % 1 < 0.005 ? 0 : 2) ?? '?.??'
	const curSym = (data.domain && domainsMetadata.get(data.domain)?.currencySymbol) ?? '?'
	const label =
		`${time}, ${summ}\u00A0${curSym}, ${data.status}` +
		(data.errorMessage ? ': ' + data.errorMessage : '')

	return (
		<div ref={boxRef} className="receipt-info-box" data-status={data.status}>
			{label}
		</div>
	)
}

import { QRCamScanner } from './qr_cam_scanner'
import {
	$,
	DOMAIN_CURRENCY_SYMBOLS,
	guessDomain,
	mustBeInstanceOf,
	mustBeNotNull,
	onError,
	parseRefText,
} from './utils'

/** @typedef {'saving'|'saved'|'exists'|'error'} ScannedQRStatus */

/**
 * @param {string} text
 * @param {(qr:ScannedQR) => unknown} onStatusChange
 */
function ScannedQR(text, onStatusChange) {
	this.text = text
	this.status = /**@type {ScannedQRStatus}*/ ('saving')
	this.errorMessage = /**@type {string|null}*/ (null)
	this.time = '----.--.-- --:--'
	this.summ = '?.??'
	this.onStatusChange = onStatusChange
	this._extractInfoFields()
	this._save()
}

ScannedQR.prototype._save = function () {
	fetch('./api/receipt', { method: 'POST', body: this.text })
		.then(r => r.json())
		.then(res => {
			if (res.ok) {
				this.status = 'saved'
			} else if (res.error == 'ALREADY_EXISTS') {
				this.status = 'exists'
			} else {
				this.status = 'error'
				this.errorMessage = res.error + (res.description ? ` (${res.description})` : '')
			}
			this.onStatusChange(this)
		})
		.catch(onError)
}

ScannedQR.prototype._extractInfoFields = function () {
	const refData = parseRefText(null, this.text)
	if (refData) {
		const match = refData.createdAt?.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/)
		if (match) {
			const [, y, m, d, H, M] = match
			this.time = `${y}.${m}.${d} ${H}:${M}`
		} else {
			this.time = refData.createdAt?.replace('T', ' ') ?? this.time
		}

		const summ = refData.sum === null ? NaN : parseFloat(refData.sum) / 100
		this.summ = isNaN(summ) ? this.summ : summ.toFixed(2)
	}
}

ScannedQR.prototype.label = function () {
	const domain = guessDomain(this.text)
	const curSym = DOMAIN_CURRENCY_SYMBOLS.get(domain) ?? '?'
	return (
		`${this.time}, ${this.summ}\u00A0${curSym}, ${this.status}` +
		(this.errorMessage ? ': ' + this.errorMessage : '')
	)
}

export function setupScannerComponent() {
	const scannedQRs = /**@type {Map<string, ScannedQR>}*/ (new Map())
	let shownScannedQRs = /**@type {ScannedQR[]}*/ ([])

	/** @param {ScannedQR} scannedQR */
	function addQRInfo(scannedQR) {
		shownScannedQRs.unshift(scannedQR)
		const infoBox = document.createElement('div')
		infoBox.className = 'receipt-info-box'
		$('.receipt-info-box-wrap', HTMLDivElement).prepend(infoBox)
		const elem = updateQRInfo(scannedQR)
		elem.classList.add('collapsed')
		elem.offsetWidth
		elem.classList.remove('collapsed')
		if (shownScannedQRs.length > 3) {
			removeQRInfo(shownScannedQRs[shownScannedQRs.length - 1])
		}
	}
	/** @param {ScannedQR} scannedQR */
	function updateQRInfo(scannedQR) {
		const index = shownScannedQRs.indexOf(scannedQR)
		if (index == -1) throw new Error('wrong scannedQR')
		const wrap = $('.receipt-info-box-wrap', HTMLDivElement)
		let infoBox = mustBeInstanceOf(wrap.children[index], HTMLDivElement)
		infoBox.dataset.status = scannedQR.status
		infoBox.textContent = scannedQR.label()
		return infoBox
	}
	/** @param {ScannedQR} scannedQR */
	function removeQRInfo(scannedQR) {
		const index = shownScannedQRs.indexOf(scannedQR)
		if (index == -1) throw new Error('wrong scannedQR')
		shownScannedQRs.splice(index, 1)
		const wrap = $('.receipt-info-box-wrap', HTMLDivElement)
		wrap.removeChild(wrap.children[index])
	}

	/** @param {ScannedQR} scannedQR */
	function onScannedQRStatusChange(scannedQR) {
		if (shownScannedQRs.includes(scannedQR)) updateQRInfo(scannedQR)
	}

	const qrCamScanner = new QRCamScanner($('.video-wrap', HTMLDivElement), text => {
		if (text == '') return

		let scannedQR = scannedQRs.get(text)
		if (scannedQR === undefined) {
			scannedQR = new ScannedQR(text, onScannedQRStatusChange)
			scannedQRs.set(text, scannedQR)
		}

		if (shownScannedQRs[0] != scannedQR) addQRInfo(scannedQR)
	})

	$('.debug-mode-image', HTMLButtonElement).onclick = () => {
		qrCamScanner.toggleDebug()
	}

	$('.open-image', HTMLButtonElement).onclick = () => {
		const fileInput = document.createElement('input')
		fileInput.type = 'file'
		fileInput.accept = 'image/*'
		fileInput.onchange = e => {
			const img = new Image()
			img.src = window.URL.createObjectURL(mustBeNotNull(fileInput.files)[0])
			img.onload = () => {
				window.URL.revokeObjectURL(img.src)
				const canvas = document.createElement('canvas')
				canvas.width = img.naturalWidth
				canvas.height = img.naturalHeight
				const rc = mustBeNotNull(canvas.getContext('2d'))
				rc.drawImage(img, 0, 0)
				const data = rc.getImageData(0, 0, canvas.width, canvas.height)
				qrCamScanner.scanFrameCanvasData(data)
			}
			img.onerror = () => {
				window.URL.revokeObjectURL(img.src)
			}
		}
		fileInput.click()
	}
}

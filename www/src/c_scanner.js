import { QRCamScanner } from './qr_cam_scanner'
import { onError } from './utils'

window.onerror = err => onError(err)

function ScannedQR(text) {
	this.text = text
	this.status = 'saving'
	this.errorMessage = null
	this.time = '----.--.-- --:--'
	this.summ = '?.??'
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
			ScannedQR.onStatusChange(this)
		})
		.catch(onError)
}

ScannedQR.prototype._extractInfoFields = function () {
	for (const item of this.text.split('&')) {
		let match
		if ((match = item.match(/^t=(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/))) {
			const [, y, m, d, H, M] = match
			this.time = `${y}.${m}.${d} ${H}:${M}`
		} else if ((match = item.match(/^s=(\d+(:?\.\d+)?)/))) {
			this.summ = match[1]
		}
	}
}

ScannedQR.prototype.label = function () {
	return (
		this.time +
		', ' +
		this.summ +
		'\u00A0₽, ' +
		this.status +
		(this.errorMessage ? ': ' + this.errorMessage : '')
	)
}

ScannedQR.onStatusChange = function (scannedQR) {
	if (shownScannedQRs.includes(scannedQR)) updateQRInfo(scannedQR)
}

function addQRInfo(scannedQR) {
	shownScannedQRs.unshift(scannedQR)
	const infoBox = document.createElement('div')
	infoBox.className = 'receipt-info-box'
	document.querySelector('.receipt-info-box-wrap').prepend(infoBox)
	const elem = updateQRInfo(scannedQR)
	elem.classList.add('collapsed')
	elem.offsetWidth
	elem.classList.remove('collapsed')
	if (shownScannedQRs.length > 3) {
		removeQRInfo(shownScannedQRs[shownScannedQRs.length - 1])
	}
}
function updateQRInfo(scannedQR) {
	const index = shownScannedQRs.indexOf(scannedQR)
	if (index == -1) throw new Error('wrong scannedQR')
	const wrap = document.querySelector('.receipt-info-box-wrap')
	let infoBox = wrap.children[index]
	infoBox.dataset.status = scannedQR.status
	infoBox.textContent = scannedQR.label()
	return infoBox
}
function removeQRInfo(scannedQR) {
	const index = shownScannedQRs.indexOf(scannedQR)
	if (index == -1) throw new Error('wrong scannedQR')
	shownScannedQRs.splice(index, 1)
	const wrap = document.querySelector('.receipt-info-box-wrap')
	wrap.removeChild(wrap.children[index])
}

const scannedQRs = new Map()
let shownScannedQRs = []

const qrCamScanner = new QRCamScanner(document.querySelector('.video-wrap'), function (text) {
	if (text == '') return
	if (!scannedQRs.has(text)) scannedQRs.set(text, new ScannedQR(text))
	const scannedQR = scannedQRs.get(text)
	if (shownScannedQRs[0] != scannedQR) {
		addQRInfo(scannedQR)
	}
})

document.querySelector('.debug-mode-image').onclick = () => {
	qrCamScanner.toggleDebug()
}

document.querySelector('.open-image').onclick = () => {
	const fileInput = document.createElement('input')
	fileInput.type = 'file'
	fileInput.accept = 'image/*'
	fileInput.onchange = e => {
		const img = new Image()
		img.src = window.URL.createObjectURL(e.target.files[0])
		img.onload = () => {
			window.URL.revokeObjectURL(img.src)
			const canvas = document.createElement('canvas')
			canvas.width = img.naturalWidth
			canvas.height = img.naturalHeight
			const rc = canvas.getContext('2d')
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

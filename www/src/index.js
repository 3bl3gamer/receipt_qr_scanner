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

ScannedQR.prototype._save = function() {
	fetch('api/receipt', { method: 'POST', body: this.text })
		.then(r => r.json())
		.then(res => {
			if (res.ok) {
				this.status = 'saved'
			} else {
				this.status = 'error'
				this.errorMessage = `${res.error} (${res.description})`
			}
			ScannedQR.onStatusChange(this)
		})
		.catch(onError)
}

ScannedQR.prototype._extractInfoFields = function() {
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

ScannedQR.prototype.label = function() {
	return (
		this.time +
		', ' +
		this.summ +
		'₽, ' +
		this.status +
		(this.errorMessage ? ': ' + this.errorMessage : '')
	)
}

ScannedQR.onStatusChange = function(scannedQR) {
	if (scannedQR == curScannedQR) showQRInfo(scannedQR)
}

const scannedQRs = new Map()
let curScannedQR = null

new QRCamScanner(document.querySelector('.video-wrap'), function(text) {
	if (text == '') return
	text = text
		.split('&')
		.sort()
		.join('&')
	if (!scannedQRs.has(text)) scannedQRs.set(text, new ScannedQR(text))
	curScannedQR = scannedQRs.get(text)
	showQRInfo(curScannedQR)
})

function showQRInfo(scannedQR) {
	document.querySelector('.info-box').textContent = scannedQR.label()
}

// fn=9285000100158957&fp=2073035091&i=63075&n=1&s=107.70&t=20191224T165900

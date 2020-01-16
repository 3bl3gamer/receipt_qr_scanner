import { QRCamScanner } from './qr_cam_scanner'

window.onerror = err => alert(err)

function ScannedQR(text) {
	this.text = text
}

const scannedQRs = new Map()

new QRCamScanner(document.querySelector('.video-wrap'), function(text) {
	if (!scannedQRs.has(text)) scannedQRs.set(text, new ScannedQR(text))
	showQRInfo(scannedQRs.get(text))
})

function showQRInfo(scannedQR) {
	document.querySelector('.info-box').textContent = scannedQR.text
}

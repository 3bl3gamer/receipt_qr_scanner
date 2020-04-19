import { locate } from './vendor/jsQR/src/locator'
import { binarize } from './vendor/jsQR/src/binarizer'
import { extract } from './vendor/jsQR/src/extractor'
import { decode } from './vendor/jsQR/src/decoder/decoder'

export function QRCamScanner(wrap, handleDecodedQR) {
	const scanSize = 512

	const video = document.createElement('video')
	const uiCanvas = document.createElement('canvas')
	const scanCanvas = document.createElement('canvas')

	for (const elem of [video, uiCanvas]) {
		elem.style.position = 'absolute'
		elem.style.left = elem.style.top = 0
		elem.style.width = elem.style.height = '100%'
	}
	video.style.objectFit = 'cover'

	scanCanvas.width = scanCanvas.height = scanSize

	let videoSettings = null
	let videoUIXOffset = 0
	let videoUIYOffset = 0
	let videoUIScale = 1

	let uiScale = 1

	// ---

	function resize() {
		resizeUICanvas()
		resizeVideo()
	}
	function resizeUICanvas() {
		const canvas = uiCanvas
		const rect = canvas.getBoundingClientRect()
		const dpr = window.devicePixelRatio
		const width = Math.round(rect.right * dpr) - Math.round(rect.left * dpr)
		const height = Math.round(rect.bottom * dpr) - Math.round(rect.top * dpr)
		if (width != canvas.width || height != canvas.height) {
			canvas.width = width
			canvas.height = height
		}
		uiScale = Math.min(canvas.width, canvas.height) / 512
	}
	function resizeVideo() {
		if (video.srcObject === null) return

		const canvas = uiCanvas
		videoSettings = video.srcObject.getVideoTracks()[0].getSettings()

		videoUIXOffset = 0
		videoUIYOffset = 0
		if (videoSettings.width / videoSettings.height < canvas.width / canvas.height) {
			videoUIScale = canvas.width / videoSettings.width
			videoUIYOffset = -(videoSettings.height - canvas.height / videoUIScale) / 2
		} else {
			videoUIScale = canvas.height / videoSettings.height
			videoUIXOffset = -(videoSettings.width - canvas.width / videoUIScale) / 2
		}
	}

	function startScan() {
		navigator.mediaDevices
			.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: { ideal: 'environment' },
				},
				audio: false,
			})
			.then(stream => {
				video.srcObject = stream
				video.play()
				scanLoopFrame()
			})
			.catch(err => alert(err))
	}

	function scanLoopFrame() {
		requestAnimationFrame(scanLoopFrame)
		resizeVideo()
		drawCanvasUI()
		scanCurVideoFrame()
	}

	function drawCanvasUI() {
		const rc = uiCanvas.getContext('2d')
		rc.globalCompositeOperation = 'destination-out'
		rc.fillStyle = 'rgba(0,0,0,0.3)'
		rc.fillRect(0, 0, uiCanvas.width, uiCanvas.height)
		rc.globalCompositeOperation = 'source-over'

		rc.fillStyle = 'rgba(255,255,255,0.1)'
		const [x0, y0] = xyFromScanToUI(0, 0)
		const [x1, y1] = xyFromScanToUI(scanSize, scanSize)
		rc.fillRect(0, 0, x0, uiCanvas.height)
		rc.fillRect(0, 0, uiCanvas.width, y0)
		rc.fillRect(x1, 0, uiCanvas.width - x1, uiCanvas.height)
		rc.fillRect(0, y1, uiCanvas.width, uiCanvas.height - y1)
	}

	/** @param {ImageData} imageData */
	function scanFrameCanvasData(imageData) {
		const { data, width, height } = imageData

		const shouldInvert = false
		const { binarized, inverted } = binarize(data, width, height, shouldInvert)

		const matrix = binarized
		const location = locate(matrix)
		if (location === null) return

		showLocation(location)

		const extracted = extract(matrix, location)
		const decoded = decode(extracted.matrix)
		if (decoded === null) return

		highlightQR(extracted.mappingFunction, location.dimension)
		handleDecodedQR(decoded.text)
	}

	function scanCurVideoFrame() {
		const vidMinSize = Math.min(videoSettings.width, videoSettings.height)

		const rc = scanCanvas.getContext('2d')
		rc.drawImage(
			video,
			(videoSettings.width - vidMinSize) / 2,
			(videoSettings.height - vidMinSize) / 2,
			vidMinSize,
			vidMinSize,
			0,
			0,
			scanSize,
			scanSize,
		)

		scanFrameCanvasData(rc.getImageData(0, 0, scanSize, scanSize))
	}

	function xyFromScanToUI(x, y) {
		const vidMinSize = Math.min(videoSettings.width, videoSettings.height)
		x =
			videoUIXOffset * videoUIScale +
			((videoSettings.width - vidMinSize) / 2) * videoUIScale +
			x * (vidMinSize / scanSize) * videoUIScale
		y =
			videoUIYOffset * videoUIScale +
			((videoSettings.height - vidMinSize) / 2) * videoUIScale +
			y * (vidMinSize / scanSize) * videoUIScale
		return [x, y]
	}
	function xyFromScanObjToUI(obj) {
		return xyFromScanToUI(obj.x, obj.y)
	}

	function showLocation(location) {
		const rc = uiCanvas.getContext('2d')
		dot(rc, ...xyFromScanObjToUI(location.bottomLeft), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.topLeft), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.topRight), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.alignmentPattern), 'hotpink')
		// rc.beginPath()
		// rc.moveTo(...xyFromScanObjToUI(location.bottomLeft))
		// rc.lineTo(...xyFromScanObjToUI(location.topLeft))
		// rc.lineTo(...xyFromScanObjToUI(location.topRight))
		// rc.lineTo(...xyFromScanObjToUI(location.alignmentPattern))
		// rc.closePath()
		// rc.strokeStyle = 'rgba(127,0,0,0.5)'
		// rc.stroke()
	}

	function highlightQR(mappingFunction, dimension) {
		const rc = uiCanvas.getContext('2d')
		rc.beginPath()
		rc.moveTo(...xyFromScanObjToUI(mappingFunction(0, 0)))
		rc.lineTo(...xyFromScanObjToUI(mappingFunction(0, dimension)))
		rc.lineTo(...xyFromScanObjToUI(mappingFunction(dimension, dimension)))
		rc.lineTo(...xyFromScanObjToUI(mappingFunction(dimension, 0)))
		rc.closePath()
		rc.fillStyle = 'rgba(255,255,255,0.2)'
		rc.fill()
		rc.strokeStyle = 'rgba(0,0,0,0.2)'
		rc.lineWidth = uiScale * 1.5
		rc.stroke()
	}

	function dot(rc, x, y, color) {
		rc.beginPath()
		rc.arc(x, y, uiScale * 4, 0, 2 * Math.PI, false)
		rc.fillStyle = color
		rc.fill()
	}

	// ---

	this.scanFrameCanvasData = scanFrameCanvasData

	// ---

	wrap.appendChild(video)
	wrap.appendChild(uiCanvas)
	addEventListener('resize', resize)
	resize()
	startScan()
}

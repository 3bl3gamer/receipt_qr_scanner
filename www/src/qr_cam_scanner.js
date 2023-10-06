import { locate } from './vendor/jsQR/src/locator'
import { binarize } from './vendor/jsQR/src/binarizer'
import { extract } from './vendor/jsQR/src/extractor'
import { decode } from './vendor/jsQR/src/decoder/decoder'
import { BitMatrix } from './vendor/jsQR/src/BitMatrix'
import { mustBeNotNull } from './utils'

/**
 * @param {HTMLElement} wrap
 * @param {(text:string) => unknown} handleDecodedQR
 */
export function QRCamScanner(wrap, handleDecodedQR) {
	const scanSize = 512
	let debug = false

	const video = document.createElement('video')
	const uiCanvas = document.createElement('canvas')
	const scanCanvas = document.createElement('canvas')

	for (const elem of [video, uiCanvas]) {
		elem.style.position = 'absolute'
		elem.style.left = elem.style.top = '0'
		elem.style.width = elem.style.height = '100%'
	}
	video.style.objectFit = 'cover'
	video.playsInline = true
	video.addEventListener('loadeddata', setVideoSettingsByElem)

	scanCanvas.width = scanCanvas.height = scanSize

	let videoSettings = /**@type {{width:number, height:number} | null}>*/ (null)
	let videoUIXOffset = 0
	let videoUIYOffset = 0
	let videoUIScale = 1

	let uiScale = 1

	// ---

	function resize() {
		resizeUICanvas()
		setVideoSettingsByElem()
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
		if (!videoSettings) return

		const canvas = uiCanvas

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
	function setVideoSettingsByElem() {
		// кривая Сафари (как минимум 16.1.2) иногда путает высоту и ширну стрима в `stream.getVideoTracks()[0].getSettings()`
		if (video.videoWidth !== 0 && video.videoHeight !== 0)
			videoSettings = { width: video.videoWidth, height: video.videoHeight }
	}

	function startScan() {
		if (!('mediaDevices' in navigator)) return alert('can not access camera')

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
				// const { width, height } = stream.getVideoTracks()[0].getSettings()
				// videoSettings = { width: mustBeDefined(width), height: mustBeDefined(height) }
				video.srcObject = stream
				video.play()
				scanLoopFrame()
			})
			.catch(err => {
				alert(err?.stack || err)
			})
	}

	function scanLoopFrame() {
		setTimeout(scanLoopFrame, 200)
		resizeVideo()
		drawCanvasUI()
		scanCurVideoFrame()
	}

	function drawCanvasUI() {
		const rc = mustBeNotNull(uiCanvas.getContext('2d'))
		rc.globalCompositeOperation = 'destination-out'
		rc.fillStyle = 'rgba(0,0,0,0.3)'
		rc.fillRect(0, 0, uiCanvas.width, uiCanvas.height)
		rc.globalCompositeOperation = 'source-over'

		rc.fillStyle = 'rgba(0,0,0,0.1)'
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
		const { binarized /*,inverted*/ } = binarize(data, width, height, shouldInvert)

		const binImage = binarized
		if (debug) showBinImage(binImage)
		const location = locate(binImage)
		if (location === null) return

		showLocation(location)

		let { matrix, mappingFunction } = extract(binImage, location)
		let decoded = decode(matrix)

		if (!decoded) {
			;({ matrix, mappingFunction } = extractWithArea(binImage, location))
			decoded = decode(matrix)
		}

		if (matrix !== null && debug) showMatrix(matrix, mappingFunction)

		if (decoded === null) return

		highlightQR(mappingFunction, location.dimension)
		handleDecodedQR(decoded.text)
	}

	function scanCurVideoFrame() {
		if (!videoSettings) return
		const vidMinSize = Math.min(videoSettings.width, videoSettings.height)

		const rc = mustBeNotNull(scanCanvas.getContext('2d'))
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

	/**
	 * @param {number} x
	 * @param {number} y
	 * @returns {[number, number]}
	 */
	function xyFromScanToUI(x, y) {
		if (!videoSettings) return [0, 0]
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
	/**
	 * @param {{x:number, y:number}} obj
	 * @returns {[number, number]}
	 */
	function xyFromScanObjToUI(obj) {
		return xyFromScanToUI(obj.x, obj.y)
	}

	/**
	 * @param {import('./vendor/jsQR/src/BitMatrix').BitMatrix} image
	 */
	function showBinImage(image) {
		const rc = mustBeNotNull(uiCanvas.getContext('2d'))
		const imageData = bitMatrixData(image)
		rc.fillStyle = 'black'
		for (let i = 0; i < image.width; i++)
			for (let j = 0; j < image.height; j++) {
				const v = imageData[i + j * image.width]
				if (v) rc.fillRect(i, j, 1, 1)
			}
	}

	/**
	 * @param {import('./vendor/jsQR/src/locator').QRLocation} location
	 */
	function showLocation(location) {
		const rc = mustBeNotNull(uiCanvas.getContext('2d'))
		dot(rc, ...xyFromScanObjToUI(location.bottomLeft), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.topLeft), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.topRight), 'orange')
		dot(rc, ...xyFromScanObjToUI(location.alignmentPattern), 'hotpink')
	}

	/**
	 * @param {import('./vendor/jsQR/src/BitMatrix').BitMatrix} matrix
	 * @param {(x: number, y: number) => {x: number, y: number}} mappingFunction
	 */
	function showMatrix(matrix, mappingFunction) {
		const rc = mustBeNotNull(uiCanvas.getContext('2d'))
		const matrixData = bitMatrixData(matrix)
		for (let i = 0; i < matrix.width; i++) {
			for (let j = 0; j < matrix.height; j++) {
				const pos = mappingFunction(i + 0.5, j + 0.5)
				// dot(rc, ...xyFromScanObjToUI(pos), 'red')
				const [x, y] = xyFromScanObjToUI(pos)
				rc.beginPath()
				rc.arc(x, y, uiScale * 1, 0, 2 * Math.PI, false)
				rc.fillStyle = matrixData[i + j * matrix.width] ? 'black' : 'white'
				rc.fill()
			}
		}
	}

	function highlightQR(mappingFunction, dimension) {
		const rc = mustBeNotNull(uiCanvas.getContext('2d'))
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

	/**
	 * @param {CanvasRenderingContext2D} rc
	 * @param {number} x
	 * @param {number} y
	 * @param {string} color
	 */
	function dot(rc, x, y, color) {
		rc.beginPath()
		rc.arc(x, y, uiScale * 4, 0, 2 * Math.PI, false)
		rc.fillStyle = color
		rc.fill()
	}

	/** @param {import('./vendor/jsQR/src/BitMatrix').BitMatrix} bitMatrix */
	function bitMatrixData(bitMatrix) {
		// @ts-ignore
		return bitMatrix.data
	}

	// ---

	this.scanFrameCanvasData = scanFrameCanvasData
	this.toggleDebug = debug_ => {
		debug = debug_ === undefined ? !debug : debug_
	}

	// ---

	wrap.appendChild(video)
	wrap.appendChild(uiCanvas)
	addEventListener('resize', resize)
	resize()
	startScan()
}

//  =========================
// === modified jsQR funcs ===
//  =========================

/** @typedef {Record<'a11' | 'a21' | 'a31' | 'a12' | 'a22' | 'a32' | 'a13' | 'a23' | 'a33', number>} PerspectiveTransform */

/**
 * Works like jsQR/extractor/extract() but sets each point on QR matrix
 * not by just one pixel from src image but by max of four pixels with little offset.
 * Useful for QRs on badly printed white paper where some pixels of QR are partially gray/white.
 * @param {import('./vendor/jsQR/src/BitMatrix').BitMatrix} image
 * @param {import('./vendor/jsQR/src/locator').QRLocation} location
 */
export function extractWithArea(image, location) {
	const qToS = quadrilateralToSquare(
		{ x: 3.5, y: 3.5 },
		{ x: location.dimension - 3.5, y: 3.5 },
		{ x: location.dimension - 6.5, y: location.dimension - 6.5 },
		{ x: 3.5, y: location.dimension - 3.5 },
	)
	const sToQ = squareToQuadrilateral(
		location.topLeft,
		location.topRight,
		location.alignmentPattern,
		location.bottomLeft,
	)
	const transform = times(sToQ, qToS)

	const matrix = BitMatrix.createEmpty(location.dimension, location.dimension)
	const mappingFunction = (x, y) => {
		const denominator = transform.a13 * x + transform.a23 * y + transform.a33
		return {
			x: (transform.a11 * x + transform.a21 * y + transform.a31) / denominator,
			y: (transform.a12 * x + transform.a22 * y + transform.a32) / denominator,
		}
	}

	for (let y = 0; y < location.dimension; y++) {
		for (let x = 0; x < location.dimension; x++) {
			const cx = x + 0.5
			const cy = y + 0.5
			const d = 0.2
			const src0 = mappingFunction(cx - d, cy - d)
			const src1 = mappingFunction(cx - d, cy + d)
			const src2 = mappingFunction(cx + d, cy + d)
			const src3 = mappingFunction(cx + d, cy - d)
			const val0 = image.get(Math.floor(src0.x), Math.floor(src0.y))
			const val1 = image.get(Math.floor(src1.x), Math.floor(src1.y))
			const val2 = image.get(Math.floor(src2.x), Math.floor(src2.y))
			const val3 = image.get(Math.floor(src3.x), Math.floor(src3.y))
			matrix.set(x, y, val0 || val1 || val2 || val3)
		}
	}

	return {
		matrix,
		mappingFunction,
	}
}

//  ========================
// === private jsQR funcs ===
//  ========================

/**
 * @param {import('./vendor/jsQR/src/locator').Point} p1
 * @param {import('./vendor/jsQR/src/locator').Point} p2
 * @param {import('./vendor/jsQR/src/locator').Point} p3
 * @param {import('./vendor/jsQR/src/locator').Point} p4
 * @returns {PerspectiveTransform}
 */
function squareToQuadrilateral(p1, p2, p3, p4) {
	const dx3 = p1.x - p2.x + p3.x - p4.x
	const dy3 = p1.y - p2.y + p3.y - p4.y
	if (dx3 === 0 && dy3 === 0) {
		// Affine
		return {
			a11: p2.x - p1.x,
			a12: p2.y - p1.y,
			a13: 0,
			a21: p3.x - p2.x,
			a22: p3.y - p2.y,
			a23: 0,
			a31: p1.x,
			a32: p1.y,
			a33: 1,
		}
	} else {
		const dx1 = p2.x - p3.x
		const dx2 = p4.x - p3.x
		const dy1 = p2.y - p3.y
		const dy2 = p4.y - p3.y
		const denominator = dx1 * dy2 - dx2 * dy1
		const a13 = (dx3 * dy2 - dx2 * dy3) / denominator
		const a23 = (dx1 * dy3 - dx3 * dy1) / denominator
		return {
			a11: p2.x - p1.x + a13 * p2.x,
			a12: p2.y - p1.y + a13 * p2.y,
			a13,
			a21: p4.x - p1.x + a23 * p4.x,
			a22: p4.y - p1.y + a23 * p4.y,
			a23,
			a31: p1.x,
			a32: p1.y,
			a33: 1,
		}
	}
}

/**
 * @param {import('./vendor/jsQR/src/locator').Point} p1
 * @param {import('./vendor/jsQR/src/locator').Point} p2
 * @param {import('./vendor/jsQR/src/locator').Point} p3
 * @param {import('./vendor/jsQR/src/locator').Point} p4
 * @returns {PerspectiveTransform}
 */
function quadrilateralToSquare(p1, p2, p3, p4) {
	// Here, the adjoint serves as the inverse:
	const sToQ = squareToQuadrilateral(p1, p2, p3, p4)
	return {
		a11: sToQ.a22 * sToQ.a33 - sToQ.a23 * sToQ.a32,
		a12: sToQ.a13 * sToQ.a32 - sToQ.a12 * sToQ.a33,
		a13: sToQ.a12 * sToQ.a23 - sToQ.a13 * sToQ.a22,
		a21: sToQ.a23 * sToQ.a31 - sToQ.a21 * sToQ.a33,
		a22: sToQ.a11 * sToQ.a33 - sToQ.a13 * sToQ.a31,
		a23: sToQ.a13 * sToQ.a21 - sToQ.a11 * sToQ.a23,
		a31: sToQ.a21 * sToQ.a32 - sToQ.a22 * sToQ.a31,
		a32: sToQ.a12 * sToQ.a31 - sToQ.a11 * sToQ.a32,
		a33: sToQ.a11 * sToQ.a22 - sToQ.a12 * sToQ.a21,
	}
}

/**
 * @param {PerspectiveTransform} a
 * @param {PerspectiveTransform} b
 * @returns {PerspectiveTransform}
 */
function times(a, b) {
	return {
		a11: a.a11 * b.a11 + a.a21 * b.a12 + a.a31 * b.a13,
		a12: a.a12 * b.a11 + a.a22 * b.a12 + a.a32 * b.a13,
		a13: a.a13 * b.a11 + a.a23 * b.a12 + a.a33 * b.a13,
		a21: a.a11 * b.a21 + a.a21 * b.a22 + a.a31 * b.a23,
		a22: a.a12 * b.a21 + a.a22 * b.a22 + a.a32 * b.a23,
		a23: a.a13 * b.a21 + a.a23 * b.a22 + a.a33 * b.a23,
		a31: a.a11 * b.a31 + a.a21 * b.a32 + a.a31 * b.a33,
		a32: a.a12 * b.a31 + a.a22 * b.a32 + a.a32 * b.a33,
		a33: a.a13 * b.a31 + a.a23 * b.a32 + a.a33 * b.a33,
	}
}

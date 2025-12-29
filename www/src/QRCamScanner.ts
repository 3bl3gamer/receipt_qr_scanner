import { mustBeNotNull } from './utils'
import { binarize } from './vendor/jsQR/src/binarizer'
import { BitMatrix } from './vendor/jsQR/src/BitMatrix'
import { decode } from './vendor/jsQR/src/decoder/decoder'
import { extract } from './vendor/jsQR/src/extractor'
import { locate, Point, QRLocation } from './vendor/jsQR/src/locator'

type VideoSettings = {
	width: number
	height: number
}

/**
 * Подключается к камере, пытается сканировать изображение с неё с небольшими интервалами.
 */
export class QRCamScanner {
	private readonly scanSize = 512
	private debug = false

	private readonly video: HTMLVideoElement
	private readonly uiCanvas: HTMLCanvasElement
	private readonly scanCanvas: HTMLCanvasElement

	private videoSettings: VideoSettings | null = null
	private videoUIXOffset = 0
	private videoUIYOffset = 0
	private videoUIScale = 1
	private uiScale = 1

	constructor(
		private readonly wrap: HTMLElement,
		private readonly handleDecodedQR: (text: string) => unknown,
	) {
		this.video = document.createElement('video')
		this.uiCanvas = document.createElement('canvas')
		this.scanCanvas = document.createElement('canvas')

		for (const elem of [this.video, this.uiCanvas]) {
			elem.style.position = 'absolute'
			elem.style.left = elem.style.top = '0'
			elem.style.width = elem.style.height = '100%'
		}
		this.video.style.objectFit = 'cover'
		this.video.playsInline = true
		this.video.addEventListener('loadeddata', () => this.setVideoSettingsByElem())

		this.scanCanvas.width = this.scanCanvas.height = this.scanSize

		this.wrap.appendChild(this.video)
		this.wrap.appendChild(this.uiCanvas)
		addEventListener('resize', () => this.resize())
		this.resize()
		this.startScan()
	}

	private resize(): void {
		this.resizeUICanvas()
		this.setVideoSettingsByElem()
		this.resizeVideo()
	}

	private resizeUICanvas(): void {
		const canvas = this.uiCanvas
		const rect = canvas.getBoundingClientRect()
		const dpr = window.devicePixelRatio
		const width = Math.round(rect.right * dpr) - Math.round(rect.left * dpr)
		const height = Math.round(rect.bottom * dpr) - Math.round(rect.top * dpr)
		if (width != canvas.width || height != canvas.height) {
			canvas.width = width
			canvas.height = height
		}
		this.uiScale = Math.min(canvas.width, canvas.height) / 512
	}

	private resizeVideo(): void {
		if (!this.videoSettings) return

		const canvas = this.uiCanvas

		this.videoUIXOffset = 0
		this.videoUIYOffset = 0
		if (this.videoSettings.width / this.videoSettings.height < canvas.width / canvas.height) {
			this.videoUIScale = canvas.width / this.videoSettings.width
			this.videoUIYOffset = -(this.videoSettings.height - canvas.height / this.videoUIScale) / 2
		} else {
			this.videoUIScale = canvas.height / this.videoSettings.height
			this.videoUIXOffset = -(this.videoSettings.width - canvas.width / this.videoUIScale) / 2
		}
	}

	private setVideoSettingsByElem(): void {
		// кривая Сафари (как минимум 16.1.2) иногда путает высоту и ширину стрима в `stream.getVideoTracks()[0].getSettings()`
		if (this.video.videoWidth !== 0 && this.video.videoHeight !== 0)
			this.videoSettings = { width: this.video.videoWidth, height: this.video.videoHeight }
	}

	private startScan(): void {
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
				this.video.srcObject = stream
				this.video.play()
				this.scanLoopFrame()
			})
			.catch(err => {
				alert('media access failed: ' + (err?.stack || err))
			})
	}

	private scanLoopFrame(): void {
		setTimeout(() => this.scanLoopFrame(), 200)
		this.resizeVideo()
		this.drawCanvasUI()
		this.scanCurVideoFrame()
	}

	private drawCanvasUI(): void {
		const rc = mustBeNotNull(this.uiCanvas.getContext('2d'))
		rc.globalCompositeOperation = 'destination-out'
		rc.fillStyle = 'rgba(0,0,0,0.3)'
		rc.fillRect(0, 0, this.uiCanvas.width, this.uiCanvas.height)
		rc.globalCompositeOperation = 'source-over'

		rc.fillStyle = 'rgba(0,0,0,0.1)'
		const [x0, y0] = this.xyFromScanToUI(0, 0)
		const [x1, y1] = this.xyFromScanToUI(this.scanSize, this.scanSize)
		rc.fillRect(0, 0, x0, this.uiCanvas.height)
		rc.fillRect(0, 0, this.uiCanvas.width, y0)
		rc.fillRect(x1, 0, this.uiCanvas.width - x1, this.uiCanvas.height)
		rc.fillRect(0, y1, this.uiCanvas.width, this.uiCanvas.height - y1)
	}

	scanFrameCanvasData(imageData: ImageData): void {
		const { data, width, height } = imageData

		const shouldInvert = false
		const { binarized } = binarize(data, width, height, shouldInvert)

		const binImage = binarized
		if (this.debug) this.showBinImage(binImage)
		const location = locate(binImage)
		if (location === null) return

		this.showLocation(location)

		let { matrix, mappingFunction } = extract(binImage, location)
		let decoded = decode(matrix)

		if (!decoded) {
			;({ matrix, mappingFunction } = extractWithArea(binImage, location))
			decoded = decode(matrix)
		}

		if (matrix !== null && this.debug) this.showMatrix(matrix, mappingFunction)

		if (decoded === null) return

		this.highlightQR(mappingFunction, location.dimension)
		this.handleDecodedQR(decoded.text)
	}

	private scanCurVideoFrame(): void {
		if (!this.videoSettings) return
		const vidMinSize = Math.min(this.videoSettings.width, this.videoSettings.height)

		const rc = mustBeNotNull(this.scanCanvas.getContext('2d'))
		rc.drawImage(
			this.video,
			(this.videoSettings.width - vidMinSize) / 2,
			(this.videoSettings.height - vidMinSize) / 2,
			vidMinSize,
			vidMinSize,
			0,
			0,
			this.scanSize,
			this.scanSize,
		)

		this.scanFrameCanvasData(rc.getImageData(0, 0, this.scanSize, this.scanSize))
	}

	private xyFromScanToUI(x: number, y: number): [number, number] {
		if (!this.videoSettings) return [0, 0]
		const vidMinSize = Math.min(this.videoSettings.width, this.videoSettings.height)
		x =
			this.videoUIXOffset * this.videoUIScale +
			((this.videoSettings.width - vidMinSize) / 2) * this.videoUIScale +
			x * (vidMinSize / this.scanSize) * this.videoUIScale
		y =
			this.videoUIYOffset * this.videoUIScale +
			((this.videoSettings.height - vidMinSize) / 2) * this.videoUIScale +
			y * (vidMinSize / this.scanSize) * this.videoUIScale
		return [x, y]
	}

	private xyFromScanObjToUI(obj: Point): [number, number] {
		return this.xyFromScanToUI(obj.x, obj.y)
	}

	private showBinImage(image: BitMatrix): void {
		const rc = mustBeNotNull(this.uiCanvas.getContext('2d'))
		const imageData = bitMatrixData(image)
		rc.fillStyle = 'black'
		for (let i = 0; i < image.width; i++)
			for (let j = 0; j < image.height; j++) {
				const v = imageData[i + j * image.width]
				if (v) rc.fillRect(i, j, 1, 1)
			}
	}

	private showLocation(location: QRLocation): void {
		const rc = mustBeNotNull(this.uiCanvas.getContext('2d'))
		this.dot(rc, ...this.xyFromScanObjToUI(location.bottomLeft), 'orange')
		this.dot(rc, ...this.xyFromScanObjToUI(location.topLeft), 'orange')
		this.dot(rc, ...this.xyFromScanObjToUI(location.topRight), 'orange')
		this.dot(rc, ...this.xyFromScanObjToUI(location.alignmentPattern), 'hotpink')
	}

	private showMatrix(matrix: BitMatrix, mappingFunction: (x: number, y: number) => Point): void {
		const rc = mustBeNotNull(this.uiCanvas.getContext('2d'))
		const matrixData = bitMatrixData(matrix)
		for (let i = 0; i < matrix.width; i++) {
			for (let j = 0; j < matrix.height; j++) {
				const pos = mappingFunction(i + 0.5, j + 0.5)
				const [x, y] = this.xyFromScanObjToUI(pos)
				rc.beginPath()
				rc.arc(x, y, this.uiScale * 1, 0, 2 * Math.PI, false)
				rc.fillStyle = matrixData[i + j * matrix.width] ? 'black' : 'white'
				rc.fill()
			}
		}
	}

	private highlightQR(mappingFunction: (x: number, y: number) => Point, dimension: number): void {
		const rc = mustBeNotNull(this.uiCanvas.getContext('2d'))
		rc.beginPath()
		rc.moveTo(...this.xyFromScanObjToUI(mappingFunction(0, 0)))
		rc.lineTo(...this.xyFromScanObjToUI(mappingFunction(0, dimension)))
		rc.lineTo(...this.xyFromScanObjToUI(mappingFunction(dimension, dimension)))
		rc.lineTo(...this.xyFromScanObjToUI(mappingFunction(dimension, 0)))
		rc.closePath()
		rc.fillStyle = 'rgba(255,255,255,0.2)'
		rc.fill()
		rc.strokeStyle = 'rgba(0,0,0,0.2)'
		rc.lineWidth = this.uiScale * 1.5
		rc.stroke()
	}

	private dot(rc: CanvasRenderingContext2D, x: number, y: number, color: string): void {
		rc.beginPath()
		rc.arc(x, y, this.uiScale * 4, 0, 2 * Math.PI, false)
		rc.fillStyle = color
		rc.fill()
	}

	toggleDebug(debug_?: boolean): void {
		this.debug = debug_ === undefined ? !this.debug : debug_
	}
}

function bitMatrixData(bitMatrix: BitMatrix): Uint8ClampedArray {
	// @ts-expect-error читаем приватное поле
	return bitMatrix.data
}

//  =========================
// === modified jsQR funcs ===
//  =========================

type PerspectiveTransform = Record<
	'a11' | 'a21' | 'a31' | 'a12' | 'a22' | 'a32' | 'a13' | 'a23' | 'a33',
	number
>

/**
 * Works like jsQR/extractor/extract() but sets each point on QR matrix
 * not by just one pixel from src image but by max of four pixels with little offset.
 * Useful for QRs on badly printed white paper where some pixels of QR are partially gray/white.
 */
function extractWithArea(
	image: BitMatrix,
	location: QRLocation,
): { matrix: BitMatrix; mappingFunction: (x: number, y: number) => Point } {
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
	const mappingFunction = (x: number, y: number): Point => {
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

function squareToQuadrilateral(p1: Point, p2: Point, p3: Point, p4: Point): PerspectiveTransform {
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

function quadrilateralToSquare(p1: Point, p2: Point, p3: Point, p4: Point): PerspectiveTransform {
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

function times(a: PerspectiveTransform, b: PerspectiveTransform): PerspectiveTransform {
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

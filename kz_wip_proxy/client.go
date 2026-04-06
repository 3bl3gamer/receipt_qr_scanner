package kz_wip_proxy

import (
	"bytes"
	"encoding/base64"
	"image"
	_ "image/png"
	"net/http"
	"receipt_qr_scanner/receipts"
	"receipt_qr_scanner/utils"
	"regexp"

	"github.com/ansel1/merry"
	"github.com/makiuchi-d/gozxing"
	"github.com/makiuchi-d/gozxing/qrcode"
	"github.com/rs/zerolog/log"
)

type Client struct{}

func (c *Client) Init() error {
	return nil
}

// регулярка для поиска base64 QR-кода в HTML
var qrImageRegex = regexp.MustCompile(`<img\s+src="data:image/png;base64,\s*([A-Za-z0-9+/=\s]+)"`)

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false}

	ref, err := receipts.CastReceiptRefTo[ReceiptRef](iRef, Domain.Code)
	if err != nil {
		return res, err
	}

	fetchURL := ref.text

	req, err := http.NewRequest("GET", fetchURL, nil)
	if err != nil {
		return res, merry.Wrap(err)
	}

	resp, buf, err := utils.GetHTTPBody(http.DefaultClient, req)
	if err != nil {
		return res, err
	}

	log.Debug().
		Int("code", resp.StatusCode).Str("status", resp.Status).
		Int("html_length", len(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status)
	}

	innerRefText, err := DecodeInnerQR(buf)
	if err != nil {
		res.ShouldDecreaseRetries = true
		return res, err
	}

	log.Info().Str("inner_ref", innerRefText).Msgf("%s: decoded inner QR", Domain.Code)

	res.RedirectRefText = innerRefText
	return res, nil
}

// DecodeInnerQR извлекает и декодирует QR-код из base64-картинки в HTML.
func DecodeInnerQR(html []byte) (string, error) {
	matches := qrImageRegex.FindSubmatch(html)
	if matches == nil {
		return "", merry.Errorf("%s: QR image not found in HTML", Domain.Code)
	}
	b64Data := matches[1]

	pngData, err := base64.StdEncoding.DecodeString(string(b64Data))
	if err != nil {
		return "", merry.Wrap(err).Append("base64 decode failed")
	}

	// декодируем PNG в image.Image
	img, _, err := image.Decode(bytes.NewReader(pngData))
	if err != nil {
		return "", merry.Wrap(err).Append("PNG decode failed")
	}

	// декодируем QR из изображения
	bmp, err := gozxing.NewBinaryBitmapFromImage(img)
	if err != nil {
		return "", merry.Wrap(err).Append("bitmap creation failed")
	}

	qrReader := qrcode.NewQRCodeReader()
	qrResult, err := qrReader.Decode(bmp, nil)
	if err != nil {
		return "", merry.Wrap(err).Append("QR decode failed")
	}

	return qrResult.GetText(), nil
}

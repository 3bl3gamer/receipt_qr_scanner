package kz_ttc

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"receipt_qr_scanner/receipts"
	"receipt_qr_scanner/utils"
	"strconv"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

type Client struct{}

func (c *Client) Init() error {
	return nil
}

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	ref, err := receipts.CastReceiptRefTo[ReceiptRef](iRef, Domain.Code)
	if err != nil {
		return res, err
	}

	// https://ofd1.kz/t/?i=123456789012&f=010101234567&s=1230.00&t=20240309T123456
	fetchURL := buildFetchURL(ref.data)

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
		Str("url", fetchURL).Int("html_length", len(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	if !bytes.Contains(buf, []byte("ИТОГО")) {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrResponseDataMalformed.Here().Append("receipt appears to be missing from the page")
	}

	res.Data = buf
	return res, nil
}

func buildFetchURL(data ReceiptRefData) string {
	dateStr := data.CreatedAt.Format("20060102T150405")
	sumStr := strconv.FormatFloat(data.Sum, 'f', 2, 64)

	params := url.Values{}
	params.Set("i", data.FiscalID)
	params.Set("f", data.KkmFnsId)
	params.Set("s", sumStr)
	params.Set("t", dateStr)

	return fmt.Sprintf("https://ofd1.kz/t/?%s", params.Encode())
}

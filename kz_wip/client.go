package kz_wip

import (
	"encoding/json"
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

	// https://api.kassa.wipon.kz/api/v1/consumer?f={012345}&i={98765}&s={1234.00}&t={20260216T123456}
	apiURL := makeAPIURL(ref.data)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return res, merry.Wrap(err)
	}

	resp, buf, err := utils.GetHTTPBody(http.DefaultClient, req)
	if err != nil {
		return res, err
	}

	log.Debug().
		Int("code", resp.StatusCode).Str("status", resp.Status).
		Str("url", apiURL).Str("data", string(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	// формат ответа: {"data":{"ticket":{...},...}}
	var response struct {
		Data struct {
			Ticket json.RawMessage `json:"ticket"`
		} `json:"data"`
	}
	if err := json.Unmarshal(buf, &response); err != nil {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrResponseDataMalformed.Here().Append(string(buf))
	}

	if len(response.Data.Ticket) == 0 || string(response.Data.Ticket) == "null" {
		res.ShouldDecreaseRetries = true
		return res, merry.Errorf("%s: receipt not found (data.ticket is empty)", Domain.Code)
	}

	res.Data = buf
	return res, nil
}

func makeAPIURL(data ReceiptRefData) string {
	dateStr := data.CreatedAt.Format("20060102T150405")
	sumStr := strconv.FormatFloat(data.Sum, 'f', 2, 64)

	params := url.Values{}
	params.Set("f", data.KkmFnsId)
	params.Set("i", data.FiscalID)
	params.Set("s", sumStr)
	params.Set("t", dateStr)

	return fmt.Sprintf("https://api.kassa.wipon.kz/api/v1/consumer?%s", params.Encode())
}

package kz_jus

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"receipt_qr_scanner/receipts"
	"receipt_qr_scanner/utils"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

type Client struct{}

func (c *Client) Init() error {
	return nil
}

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	ref, err := receipts.CasetReceiptRefTo[ReceiptRef](iRef, Domain.Code)
	if err != nil {
		return res, err
	}

	// https://cabinet.kofd.kz/api/tickets?registrationNumber={f}&ticketNumber={i}&ticketDate={date}
	apiURL := makeAPIURL(ref.data)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return res, merry.Wrap(err)
	}

	resp, buf, err := utils.GetHTTPBody(http.DefaultClient, req)
	if err != nil {
		return res, err
	}

	// если номер ККМ неправильный:
	// {"error":{"code":5,"text":"Касса не найдена"}}
	// если ККМ такая есть, но нет чека с таким фискальным признаком:
	// {"data":{"found":0,"ticket":null,"ticketUrl":null},"error":null}

	log.Debug().
		Int("code", resp.StatusCode).Str("status", resp.Status).
		Str("url", apiURL).Str("data", string(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	var response struct {
		Data struct {
			Found int `json:"found"`
		} `json:"data"`
	}
	if err := json.Unmarshal(buf, &response); err != nil {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrResponseDataMalformed.Here().Append(string(buf))
	}

	if response.Data.Found != 1 {
		res.ShouldDecreaseRetries = true
		return res, merry.Errorf("%s: receipt not found (data.found=%d)", Domain.Code, response.Data.Found)
	}

	res.Data = buf
	return res, nil
}

func makeAPIURL(data ReceiptRefData) string {
	dateStr := data.CreatedAt.Format("2006-01-02")

	params := url.Values{}
	params.Set("registrationNumber", data.KkmFnsId)
	params.Set("ticketNumber", data.FiscalID)
	params.Set("ticketDate", dateStr)

	return fmt.Sprintf("https://cabinet.kofd.kz/api/tickets?%s", params.Encode())
}

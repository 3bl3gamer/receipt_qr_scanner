package kg_gns

import (
	"encoding/json"
	"io"
	"net/http"
	"receipt_qr_scanner/receipts"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

var ErrReceiptItemsNotReady = merry.New("receipt items not ready")

type Client struct{}

func (c *Client) Init() error {
	return nil
}

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	var ref ReceiptRef
	switch r := iRef.(type) {
	case ReceiptRef:
		ref = r
	case *ReceiptRef:
		ref = *r
	default:
		return res, merry.Errorf("%s: unexpected receipt ref %#T %s", Domain.Code, iRef, iRef.String())
	}

	req, err := http.NewRequest("GET", ref.RefText(), nil)
	if err != nil {
		return res, merry.Wrap(err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return res, merry.Wrap(err)
	}
	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return res, merry.Wrap(err)
	}
	defer resp.Body.Close()

	log.Debug().
		Int("code", resp.StatusCode).Str("status", resp.Status).
		Str("path", req.URL.Path).Str("data", string(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		if resp.StatusCode == 404 {
			res.ShouldDecreaseRetries = true //либо чек некорректен, либо касса была в оффлайне
		}
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	var items struct{ Items []json.RawMessage }
	if err := json.Unmarshal(buf, &items); err != nil {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrResponseDataMalformed.Here().Append(string(buf))
	}
	if len(items.Items) == 0 {
		res.ShouldDecreaseRetries = true //
		return res, ErrReceiptItemsNotReady.Here().Append(string(buf))
	}

	res.Data = buf
	return res, nil
}

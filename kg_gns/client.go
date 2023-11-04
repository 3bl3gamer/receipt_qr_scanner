package kg_gns

import (
	"io"
	"net/http"
	"receipt_qr_scanner/utils"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

type Client struct{}

func (c *Client) LoadSession() error {
	return nil
}

func (c *Client) FetchReceipt(iRef utils.ReceiptRef, onIsCorrect func() error) (utils.FetchReceiptResult, error) {
	res := utils.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	var ref ReceiptRef
	switch r := iRef.(type) {
	case ReceiptRef:
		ref = r
	case *ReceiptRef:
		ref = *r
	default:
		return res, merry.Errorf("ru-fns: unexpected receipt ref %#T %s", iRef, iRef.String())
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

	log.Debug().Int("code", resp.StatusCode).Str("status", resp.Status).Str("path", req.URL.Path).Str("data", string(buf)).Msg("kg-gns: response")

	if resp.Status != "200 OK" {
		if resp.StatusCode == 404 {
			res.ShouldDecreaseRetries = true //либо чек некорректен, либо касса была в оффлайне
		}
		return res, utils.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	res.Data = buf
	return res, nil
}

package kz_wip_proxy

import (
	"fmt"
	"net/url"
	"receipt_qr_scanner/receipts"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

var Domain = receipts.Domain{
	Code:           "kz-wip-proxy",
	CurrencySymbol: "₸",
	FlagSymbol:     "🇰🇿",
	Provider: receipts.Provider{
		Name:       "Касса Wipon (прокси)",
		ShortLabel: "W?",
		Color:      "#000000",
	},
	ParseReceiptRef: func(refText string) (receipts.ReceiptRef, error) {
		return NewReceiptRef(refText)
	},
	NewClient: func() receipts.Client {
		return &Client{}
	},
}

func NewReceiptRef(refText string) (ReceiptRef, error) {
	uuid, err := parseRefText(refText)
	if err != nil {
		return ReceiptRef{}, merry.Wrap(err)
	}
	return ReceiptRef{text: refText, uuid: uuid}, nil
}

type ReceiptRef struct {
	text string
	uuid string
}

func (r ReceiptRef) String() string {
	return fmt.Sprintf("Ref{%s:%s}", r.Domain().Code, r.uuid)
}

func (r ReceiptRef) Domain() receipts.Domain {
	return Domain
}

func (r ReceiptRef) RefText() string {
	return r.text
}

func (r ReceiptRef) UniqueKey() string {
	return r.Domain().Code + ":" + r.uuid
}

func (r ReceiptRef) CreatedAt() time.Time {
	return time.Now()
}

func (r ReceiptRef) Sum() float64 {
	return 0
}

func (r ReceiptRef) SearchKeyItems() []string {
	return []string{"_uuid:" + r.uuid}
}

func parseRefText(refText string) (string, error) {
	// https://app.kassa.wipon.kz/links/check/8ab7d2bb-1234-4a8c-4321-02185db12a23
	u, err := url.Parse(refText)
	if err != nil {
		return "", merry.Wrap(err)
	}

	if u.Host != "app.kassa.wipon.kz" {
		return "", merry.Errorf("unexpected host: %s", u.Host)
	}

	prefix := "/links/check/"
	if !strings.HasPrefix(u.Path, prefix) {
		return "", merry.Errorf("unexpected path: %s", u.Path)
	}

	uuid := strings.TrimPrefix(u.Path, prefix)
	if uuid == "" {
		return "", merry.Errorf("empty UUID in path: %s", u.Path)
	}

	return uuid, nil
}

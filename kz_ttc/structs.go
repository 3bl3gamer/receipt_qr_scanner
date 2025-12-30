package kz_ttc

import (
	"fmt"
	"net/url"
	"receipt_qr_scanner/kz_ktc"
	"receipt_qr_scanner/receipts"
	"sort"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

var Domain = receipts.Domain{
	Code:           "kz-ttc",
	CurrencySymbol: "₸",
	FlagSymbol:     "🇰🇿",
	Provider: receipts.Provider{
		Name:       "ОФД Транстелеком",
		ShortLabel: "Т",
		Color:      "#7caf6d",
	},
	ParseReceiptRef: func(refText string) (receipts.ReceiptRef, error) {
		return NewReceiptRef(refText)
	},
	NewClient: func() receipts.Client {
		return &Client{}
	},
}

func NewReceiptRef(refText string) (ReceiptRef, error) {
	data, err := parseRefText(refText)
	if err != nil {
		return ReceiptRef{}, merry.Wrap(err)
	}
	ref := ReceiptRef{text: refText, data: *data}
	return ref, nil
}

type ReceiptRef struct {
	text string
	data ReceiptRefData
}

// формат тот же, что и в kz_ktc
type ReceiptRefData = kz_ktc.ReceiptRefData

func (r ReceiptRef) String() string {
	return fmt.Sprintf("Ref{%s:%s}", r.Domain().Code, r.text)
}

func (r ReceiptRef) Domain() receipts.Domain {
	return Domain
}

func (r ReceiptRef) RefText() string {
	return r.text
}

func (r ReceiptRef) UniqueKey() string {
	query := r.text
	i := strings.LastIndex(r.text, "?")
	if i != -1 {
		query = query[i+1:]
	}
	items := strings.Split(query, "&")
	sort.Strings(items)
	return r.Domain().Code + ":" + strings.Join(items, "&")
}

func (r ReceiptRef) CreatedAt() time.Time {
	return r.data.CreatedAt
}

func (r ReceiptRef) Sum() float64 {
	return r.data.Sum
}

func (r ReceiptRef) SearchKeyItems() []string {
	return r.data.SearchKeyItems()
}

func parseRefText(refText string) (*ReceiptRefData, error) {
	// http://ofd1.kz/t/?i=123456789012&f=010101234567&s=1230.00&t=20240309T123456
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if u.Host != "ofd1.kz" {
		return nil, merry.Errorf("unexpected host: %s", u.Host)
	}

	var data ReceiptRefData
	data.FillFromQuery(u.Query())
	return &data, nil
}

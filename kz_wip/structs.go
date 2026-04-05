package kz_wip

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
	Code:           "kz-wip",
	CurrencySymbol: "₸",
	FlagSymbol:     "🇰🇿",
	Provider: receipts.Provider{
		Name:       "Касса Wipon",
		ShortLabel: "W",
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
	// https://app.kassa.wipon.kz/consumer?i=1234560017&f=600401234704&s=3490.00&t=20260216T123456
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if u.Host != "app.kassa.wipon.kz" {
		return nil, merry.Errorf("unexpected host: %s", u.Host)
	}

	var data ReceiptRefData
	if err := data.FillFromQuery(u.Query()); err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, nil
}

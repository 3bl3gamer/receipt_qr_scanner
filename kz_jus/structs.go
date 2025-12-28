package kz_jus

import (
	"fmt"
	"net/url"
	"receipt_qr_scanner/kz_ktc"
	"receipt_qr_scanner/receipts"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

var Domain = receipts.Domain{
	Code:           "kz-jus",
	CurrencySymbol: "₸",
	FlagSymbol:     "🇰🇿",
	ParseReceiptRef: func(refText string) (receipts.ReceiptRef, error) {
		return NewReceiptRef(refText)
	},
	MakeClient: func() receipts.Client {
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

// формат тот же, то и в kz_ktc
type ReceiptRefData kz_ktc.ReceiptRefData

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
	return r.data.TransactionDate
}

func (r ReceiptRef) Sum() float64 {
	return r.data.TotalSum
}

func (r ReceiptRef) SearchKeyItems() []string {
	return []string{
		"_created_at:" + r.data.TransactionDate.Format("2006-01-02 15:04"),
		"_fiscal_id:" + r.data.FiscalId,
		"_kkm_fns_id:" + r.data.KkmFnsId,
		"_sum:" + strconv.FormatFloat(r.data.TotalSum, 'f', 2, 64),
	}
}

func parseRefText(refText string) (*ReceiptRefData, error) {
	// http://consumer.kofd.kz?i=123456789012&f=010101234567&s=1230.00&t=20251208T123456
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if u.Host != "consumer.kofd.kz" {
		return nil, merry.Errorf("unexpected host: %s", u.Host)
	}

	query := u.Query()
	var data ReceiptRefData
	data.FiscalId, err = receipts.ReadString(query, "i")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.KkmFnsId, err = receipts.ReadString(query, "f")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.TotalSum, err = receipts.ReadFloat64(query, "s")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.TransactionDate, err = receipts.ReadTime(query, "t")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, nil
}

package kz_ktc

import (
	"fmt"
	"net/url"
	"receipt_qr_scanner/receipts"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

const domainCode = "kz-ktc"

var Domain = receipts.Domain{
	Code:           domainCode,
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

type ReceiptRefData struct {
	// ФП, фискальный признак ККМ (возможно нужно сохранять нули в начале).
	// Поле так называется в ответе kz-ktc
	FiscalID string
	// Код ККМ, РНМ, регистрационный номер ККМ (нужно сохранять нули в начале).
	// Поле так называется в ответе kz-ktc
	KkmFnsId  string
	Sum       float64
	CreatedAt time.Time
}

func (d ReceiptRefData) SearchKeyItems() []string {
	return []string{
		"_created_at:" + d.CreatedAt.Format("2006-01-02 15:04"),
		"_fiscal_id:" + d.FiscalID,
		"_kkm_fns_id:" + d.KkmFnsId,
		"_sum:" + strconv.FormatFloat(d.Sum, 'f', 2, 64),
	}
}

func (d *ReceiptRefData) FillFromQuery(query url.Values) error {
	var err error
	d.FiscalID, err = receipts.ReadString(query, "i")
	if err != nil {
		return merry.Wrap(err)
	}
	d.KkmFnsId, err = receipts.ReadString(query, "f")
	if err != nil {
		return merry.Wrap(err)
	}
	d.Sum, err = receipts.ReadFloat64(query, "s")
	if err != nil {
		return merry.Wrap(err)
	}
	d.CreatedAt, err = receipts.ReadTime(query, "t")
	if err != nil {
		return merry.Wrap(err)
	}
	return nil
}

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
	// http://consumer.oofd.kz?i=123456789&f=010101012345&s=1600.00&t=20240309T123456
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if u.Host != "consumer.oofd.kz" {
		return nil, merry.Errorf("unexpected host: %s", u.Host)
	}

	var data ReceiptRefData
	data.FillFromQuery(u.Query())
	return &data, nil
}

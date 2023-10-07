package ru_fns

import (
	"fmt"
	"net/url"
	"receipt_qr_scanner/utils"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

func NewReceiptRef(refText string) (ReceiptRef, error) {
	ref := ReceiptRef{text: refText}
	err := ref.ValidateFormat()
	return ref, merry.Wrap(err)
}

type ReceiptRef struct {
	text string
}

type ReceiptRefData struct {
	FiscalNum  int64     `json:"fiscalNum"`
	FiscalDoc  int64     `json:"fiscalDoc"`
	FiscalSign int64     `json:"fiscalSign"`
	Kind       int64     `json:"kind"`
	Summ       float64   `json:"summ"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (r ReceiptRef) String() string {
	return fmt.Sprintf("Ref{%s:%s}", r.Domain(), r.text)
}

func (r ReceiptRef) Domain() string {
	return "ru-fns"
}

func (r ReceiptRef) RefText() string {
	return r.text
}

func (r ReceiptRef) ValidateFormat() error {
	_, err := r.parseRefText()
	return merry.Wrap(err)
}

func (r ReceiptRef) UniqueKey() string {
	items := strings.Split(r.text, "&")
	sort.Strings(items)
	return strings.Join(items, "&")
}

func (r ReceiptRef) CreatedAt() (time.Time, error) {
	data, err := r.parseRefText()
	if err != nil {
		return time.Time{}, merry.Wrap(err)
	}
	return data.CreatedAt, nil
}

func (r ReceiptRef) SearchKeyItems() ([]string, error) {
	data, err := r.parseRefText()
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return []string{
		"_created_at:" + data.CreatedAt.Format("2006-01-02 15:04"),
		"_sum:" + strconv.FormatFloat(data.Summ, 'f', 2, 64),
		"_num:" + strconv.FormatInt(data.FiscalNum, 10),
		"_doc:" + strconv.FormatInt(data.FiscalDoc, 10),
		"_sign:" + strconv.FormatInt(data.FiscalSign, 10),
		"_type:" + strconv.FormatInt(data.Kind, 10),
	}, nil
}

func (r ReceiptRef) parseRefText() (*ReceiptRefData, error) {
	values, err := url.ParseQuery(r.text)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var data ReceiptRefData
	data.FiscalNum, err = utils.ReceiptInt64(values, "fn")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDoc, err = utils.ReceiptInt64(values, "i")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalSign, err = utils.ReceiptInt64(values, "fp")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Kind, err = utils.ReceiptInt64(values, "n")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Summ, err = utils.ReceiptFloat64(values, "s")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.CreatedAt, err = utils.ReceiptTime(values, "t")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

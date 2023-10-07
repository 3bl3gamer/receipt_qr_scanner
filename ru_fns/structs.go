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
	FiscalDriveNumber    int64
	FiscalDocumentNumber int64
	FiscalDocumentSign   int64
	Kind                 int64
	Sum                  float64
	CreatedAt            time.Time
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
	return r.Domain() + ":" + strings.Join(items, "&")
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
		"_sum:" + strconv.FormatFloat(data.Sum, 'f', 2, 64),
		"_fiscal_drive_number:" + strconv.FormatInt(data.FiscalDriveNumber, 10),
		"_fiscal_document_number:" + strconv.FormatInt(data.FiscalDocumentNumber, 10),
		"_fiscal_document_sign:" + strconv.FormatInt(data.FiscalDocumentSign, 10),
		"_type:" + strconv.FormatInt(data.Kind, 10),
	}, nil
}

func (r ReceiptRef) parseRefText() (*ReceiptRefData, error) {
	values, err := url.ParseQuery(r.text)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var data ReceiptRefData
	data.FiscalDriveNumber, err = utils.ReceiptInt64(values, "fn")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentNumber, err = utils.ReceiptInt64(values, "i")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentSign, err = utils.ReceiptInt64(values, "fp")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Kind, err = utils.ReceiptInt64(values, "n")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Sum, err = utils.ReceiptFloat64(values, "s")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.CreatedAt, err = utils.ReceiptTime(values, "t")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

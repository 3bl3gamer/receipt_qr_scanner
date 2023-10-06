package main

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

type ReceiptRef struct {
	Text string `json:"text"`
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
	return fmt.Sprintf("Ref{%s}", r.Text)
}

func (r ReceiptRef) ValidateFormat() error {
	_, err := r.parseRefText()
	return merry.Wrap(err)
}

func (r ReceiptRef) UniqueKey() string {
	items := strings.Split(r.Text, "&")
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
	values, err := url.ParseQuery(r.Text)
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

type Receipt struct {
	ID          int64          `json:"id"`
	SavedAt     time.Time      `json:"savedAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	CreatedAt   time.Time      `json:"createdAt"`
	RefText     string         `json:"refText"`
	RefData     ReceiptRefData `json:"refData"`
	IsCorrect   bool           `json:"isCorrect"`
	Data        string         `json:"data"`
	SearchKey   string         `json:"searchKey"`
	RetriesLeft int64          `json:"retriesLeft"`
	NextRetryAt time.Time      `json:"nextRetryAt"`
}

type ReceiptPending struct {
	ID        int64
	Ref       ReceiptRef
	IsCorrect bool
}

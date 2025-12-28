package ru_fns

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

var Domain = receipts.Domain{
	Code:           "ru-fns",
	CurrencySymbol: "₽",
	FlagSymbol:     "🇷🇺",
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

// https://www.consultant.ru/document/cons_doc_LAW_214339/6111d2e938c6fe4df089424ce2fe9ef428678b1d/
//
// https://ofd-ya.ru/docs/API_OFD_YA.pdf
//
// https://kabinet.dreamkas.ru/api/
type ReceiptRefData struct {
	FiscalDriveNumber    int64 //ФН, ЗН ККТ, заводской номер фискального накопителя (номер ФН)
	FiscalDocumentNumber int64 //ФД, порядковый номер фискального документа, нулями не дополняется
	FiscalDocumentSign   int64 //ФП, фискальный признак документа, нулями не дополняется
	// Признак расчета
	//  - 1 приход
	//  - 2 возврат прихода
	//  - 3 расход
	//  - 4 возврат расхода
	// https://www.consultant.ru/document/cons_doc_LAW_362322/c3f6615226cb89c3d7f325ed9d064a64f45a481d/
	Kind      int64
	Sum       float64
	CreatedAt time.Time
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
	items := strings.Split(r.text, "&")
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
	return []string{
		"_created_at:" + r.data.CreatedAt.Format("2006-01-02 15:04"),
		"_sum:" + strconv.FormatFloat(r.data.Sum, 'f', 2, 64),
		"_fiscal_drive_number:" + strconv.FormatInt(r.data.FiscalDriveNumber, 10),
		"_fiscal_document_number:" + strconv.FormatInt(r.data.FiscalDocumentNumber, 10),
		"_fiscal_document_sign:" + strconv.FormatInt(r.data.FiscalDocumentSign, 10),
		"_type:" + strconv.FormatInt(r.data.Kind, 10),
	}
}

func parseRefText(refText string) (*ReceiptRefData, error) {
	values, err := url.ParseQuery(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	// https://www.consultant.ru/document/cons_doc_LAW_214339/6111d2e938c6fe4df089424ce2fe9ef428678b1d/

	var data ReceiptRefData
	// заводской номер фискального накопителя
	data.FiscalDriveNumber, err = receipts.ReadInt64(values, "fn")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	// порядковый номер фискального документа, нулями не дополняется
	data.FiscalDocumentNumber, err = receipts.ReadInt64(values, "i")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	// фискальный признак документа, нулями не дополняется
	data.FiscalDocumentSign, err = receipts.ReadInt64(values, "fp")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	// признак расчета
	data.Kind, err = receipts.ReadInt64(values, "n")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	// сумма расчета в рублях и копейках, разделенных точкой
	data.Sum, err = receipts.ReadFloat64(values, "s")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	// дата и время осуществления расчета в формате ГГГГММДДТЧЧММ
	data.CreatedAt, err = receipts.ReadTime(values, "t")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

package kg_gns

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
	Code:           "kg-gns",
	CurrencySymbol: "с",
	FlagSymbol:     "🇰🇬",
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
	CreatedAt                time.Time
	Kind                     int64
	OperationType            int64
	FiscalModuleSerialNumber int64
	FiscalDocumentNumber     int64
	FiscalDocumentSign       int64
	TaxpayerIdNumber         int64
	KktRegNumber             int64
	Sum                      float64
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

func (r ReceiptRef) CreatedAt() (time.Time, error) {
	return r.data.CreatedAt, nil
}

func (r ReceiptRef) SearchKeyItems() ([]string, error) {
	return []string{
		"_created_at:" + r.data.CreatedAt.Format("2006-01-02 15:04"),
		"_type:" + strconv.FormatInt(r.data.Kind, 10),
		"_operation_type:" + strconv.FormatInt(r.data.OperationType, 10),
		"_fiscal_module_serial_number:" + strconv.FormatInt(r.data.FiscalModuleSerialNumber, 10),
		"_fiscal_document_number:" + strconv.FormatInt(r.data.FiscalDocumentNumber, 10),
		"_fiscal_document_sign:" + strconv.FormatInt(r.data.FiscalDocumentSign, 10),
		"_taxpayer_id_number:" + strconv.FormatInt(r.data.TaxpayerIdNumber, 10),
		"_kkt_reg_number:" + strconv.FormatInt(r.data.KktRegNumber, 10),
		"_sum:" + strconv.FormatFloat(r.data.Sum, 'f', 2, 64),
	}, nil
}

func parseRefText(refText string) (*ReceiptRefData, error) {
	// https://tax.salyk.kg/tax-web-control/client/api/v1/ticket
	//   ?date=20230729T210806&type=3&operation_type=1&fn_number=000123&fd_number=123&fm=123&tin=123&regNumber=0001233&sum=12300
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	query := u.Query()
	var data ReceiptRefData
	data.CreatedAt, err = receipts.ReadTime(query, "date")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Kind, err = receipts.ReadInt64(query, "type")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.OperationType, err = receipts.ReadInt64(query, "operation_type")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalModuleSerialNumber, err = receipts.ReadInt64(query, "fn_number")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentNumber, err = receipts.ReadInt64(query, "fd_number")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentSign, err = receipts.ReadInt64(query, "fm")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.TaxpayerIdNumber, err = receipts.ReadInt64(query, "tin")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.KktRegNumber, err = receipts.ReadInt64(query, "regNumber")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Sum, err = receipts.ReadFloat64(query, "sum")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

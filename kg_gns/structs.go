package kg_gns

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
	return fmt.Sprintf("Ref{%s:%s}", r.Domain(), r.text)
}

func (r ReceiptRef) Domain() string {
	return "kg-gns"
}

func (r ReceiptRef) RefText() string {
	return r.text
}

func (r ReceiptRef) ValidateFormat() error {
	_, err := r.parseRefText()
	return merry.Wrap(err)
}

func (r ReceiptRef) UniqueKey() string {
	query := r.text
	i := strings.LastIndex(r.text, "?")
	if i != -1 {
		query = query[i+1:]
	}
	items := strings.Split(query, "&")
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
		"_type:" + strconv.FormatInt(data.Kind, 10),
		"_operation_type:" + strconv.FormatInt(data.OperationType, 10),
		"_fiscal_module_serial_number:" + strconv.FormatInt(data.FiscalModuleSerialNumber, 10),
		"_fiscal_document_number:" + strconv.FormatInt(data.FiscalDocumentNumber, 10),
		"_fiscal_document_sign:" + strconv.FormatInt(data.FiscalDocumentSign, 10),
		"_taxpayer_id_number:" + strconv.FormatInt(data.TaxpayerIdNumber, 10),
		"_kkt_reg_number:" + strconv.FormatInt(data.KktRegNumber, 10),
		"_sum:" + strconv.FormatFloat(data.Sum, 'f', 2, 64),
	}, nil
}

func (r ReceiptRef) parseRefText() (*ReceiptRefData, error) {
	// https://tax.salyk.kg/tax-web-control/client/api/v1/ticket
	//   ?date=20230729T210806&type=3&operation_type=1&fn_number=000123&fd_number=123&fm=123&tin=123&regNumber=0001233&sum=12300
	u, err := url.Parse(r.text)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	query := u.Query()
	var data ReceiptRefData
	data.CreatedAt, err = utils.ReceiptTime(query, "date")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Kind, err = utils.ReceiptInt64(query, "type")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.OperationType, err = utils.ReceiptInt64(query, "operation_type")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalModuleSerialNumber, err = utils.ReceiptInt64(query, "fn_number")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentNumber, err = utils.ReceiptInt64(query, "fd_number")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.FiscalDocumentSign, err = utils.ReceiptInt64(query, "fm")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.TaxpayerIdNumber, err = utils.ReceiptInt64(query, "tin")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.KktRegNumber, err = utils.ReceiptInt64(query, "regNumber")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	data.Sum, err = utils.ReceiptFloat64(query, "s")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

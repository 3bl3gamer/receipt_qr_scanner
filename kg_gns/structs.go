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
	Provider: receipts.Provider{
		Name:       "ГНС КР",
		ShortLabel: "Г",
		Color:      "#018A91",
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

// https://sti.gov.kg/section/0/%D0%BA%D0%BA%D0%BC_%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD
//
// https://sti.gov.kg/section/view-pdf?filePath=websti%2F2023%2F1%2F12%2Fstidocument_f1a2adc3-cb14-438f-81a3-2200ec03ff0b.pdf
//
// https://sti.gov.kg/section/view-pdf?filePath=websti%2F2023%2F1%2F12%2Fstidocument_683ca1c7-8db1-4d25-9898-5f0a43f4fe46.pdf
type ReceiptRefData struct {
	CreatedAt time.Time
	// Код формы фискального документа
	//   - 1 Отчет о регистрации
	//   - 11 Отчет об изменении параметров регистрации
	//   - 2 Отчет об открытии смены
	//   - 3 Кассовый чек
	//   - 5 Отчет о закрытии смены
	//   - 6 Отчет о закрытии фискального модуля
	//   - 7 Подтверждение оператора
	// https://sti.gov.kg/section/view-pdf?filePath=websti%2F2023%2F1%2F12%2Fstidocument_683ca1c7-8db1-4d25-9898-5f0a43f4fe46.pdf
	Kind int64
	// Тип кассовой расчетной операции
	//   - 1 продажа (приход)
	//   - 2 возврат продажи (возврат прихода)
	//   - 3 покупка (расход)
	//   - 4 возврат покупки (возврат расхода)
	// https://sti.gov.kg/section/view-pdf?filePath=websti%2F2023%2F1%2F12%2Fstidocument_f1a2adc3-cb14-438f-81a3-2200ec03ff0b.pdf
	OperationType            int64
	FiscalModuleSerialNumber int64 //ФМ, серийный номер фискального модуля
	FiscalDocumentNumber     int64 //ФД, номер фискального документа
	FiscalDocumentSign       int64 //ФПД, фискальный признак документа
	TaxpayerIdNumber         int64 //ИНН, идентификационный номер налогоплательщика
	KktRegNumber             int64 //РН ККМ, регистрационный номер контрольно-кассовой машины
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

func (r ReceiptRef) CreatedAt() time.Time {
	return r.data.CreatedAt
}

func (r ReceiptRef) Sum() float64 {
	return r.data.Sum
}

func (r ReceiptRef) SearchKeyItems() []string {
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
	}
}

func parseRefText(refText string) (*ReceiptRefData, error) {
	// https://tax.salyk.kg/tax-web-control/client/api/v1/ticket
	//   ?date=20230729T210806&type=3&operation_type=1&fn_number=000123&fd_number=123&fm=123&tin=123&regNumber=0001233&sum=12300
	u, err := url.Parse(refText)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if u.Host != "tax.salyk.kg" {
		return nil, merry.Errorf("unexpected host: %s", u.Host)
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
	data.Sum, err = receipts.ReadFloat64Div(query, "sum", 100)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &data, err
}

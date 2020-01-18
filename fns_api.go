package main

import (
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/ansel1/merry"
)

var ErrReceiptNotFound = merry.New("receipt not found")
var ErrReceiptChackError = merry.New("receipt check error")

func checkReceipt(ref *ReceiptRef) error {
	url := "https://proverkacheka.nalog.ru:9999/v1/ofds/*/inns/*" +
		"/fss/" + itoa(ref.FiscalNum) +
		"/operations/" + itoa(ref.Kind) +
		"/tickets/" + itoa(ref.FiscalDoc) +
		"?fiscalSign=" + itoa(ref.FiscalSign) +
		"&date=" + ref.CreatedAt.Format("2006-01-02T15:04:05") +
		"&sum=" + itoa(int64(ref.Summ*100))

	resp, err := http.Get(url)
	if err != nil {
		return merry.Wrap(err)
	}
	buf, _ := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()

	if resp.Status == "204 No Content" {
		return nil
	}
	if resp.Status == "406 Not Acceptable" {
		return ErrReceiptNotFound.Here()
	}
	msg := ErrReceiptChackError.Error() + resp.Status + " (" + strconv.Itoa(resp.StatusCode) + ")"
	if len(buf) > 0 {
		msg += ": " + string(buf)
	}
	return ErrReceiptChackError.Here().WithMessage(msg)
}

func fetchReceipt(ref *ReceiptRef) error {
	return nil
}

package main

import (
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/ansel1/merry"
)

// https://habr.com/ru/post/358966/ (Универсальный API для получения информации по чекам)

var ErrReceiptNotFound = merry.New("receipt not found")
var ErrReceiptCheckError = merry.New("receipt check error")
var ErrReceiptNotChecked = merry.New("receipt not checked")
var ErrReceiptFetchError = merry.New("receipt fetch error")

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
	msg := ErrReceiptCheckError.Error() + resp.Status + " (" + strconv.Itoa(resp.StatusCode) + ")"
	if len(buf) > 0 {
		msg += ": " + string(buf)
	}
	return ErrReceiptCheckError.Here().WithMessage(msg)
}

func fetchReceipt(ref *ReceiptRef) ([]byte, error) {
	url := "https://proverkacheka.nalog.ru:9999/v1/inns/*/kkts/*" +
		"/fss/" + itoa(ref.FiscalNum) +
		"/tickets/" + itoa(ref.FiscalDoc) +
		"?fiscalSign=" + itoa(ref.FiscalSign) +
		"&sendToEmail=no"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.SetBasicAuth("+79319806069", "552994")
	req.Header.Set("Device-Id", "iPhone 12 made in China")
	req.Header.Set("Device-OS", "Android 4.4")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	buf, _ := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()

	if resp.Status == "200 OK" {
		return buf, nil
	}
	if resp.Status == "202 Accepted" {
		return nil, ErrReceiptNotChecked.Here()
	}
	if resp.Status == "406 Not Acceptable" {
		return nil, ErrReceiptNotFound.Here()
	}
	msg := ErrReceiptFetchError.Error() + ": " + resp.Status + " (" + strconv.Itoa(resp.StatusCode) + ")"
	if len(buf) > 0 {
		msg += ": " + string(buf)
	}
	return nil, ErrReceiptFetchError.Here().WithMessage(msg)
}

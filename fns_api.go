package main

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"net/http"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

// https://habr.com/ru/post/358966/ (Универсальный API для получения информации по чекам)
// UPD:
//   АПИ изменилось, теперь нужен айди сессии
//   https://github.com/kosov/fns-check/issues/3#issuecomment-673966281

var ErrReceiptMaybeNotReadyYet = merry.New("Чек (возможно) ещё не подгружен") // точное название статусов (0/1) неизвестно, но при их получении стоит повторить запрос после небольшой паузы
var ErrWaitingForConnection = merry.New("Ожидает соединения")
var ErrCashboxOffline = merry.New("Чек корректен, но отсутствует в хранилище: касса автономна") // (Автономная касса)
var ErrReceiveFailed = merry.New("Ошибка получения")
var ErrWrongReceipt = merry.New("Чек не является кассовым чеком или БСО") // (Не кассовый чек)
var ErrByStatus = map[int64]merry.Error{
	0:  ErrReceiptMaybeNotReadyYet,
	1:  ErrReceiptMaybeNotReadyYet,
	5:  ErrWaitingForConnection,
	8:  ErrCashboxOffline,
	9:  ErrReceiveFailed,
	15: ErrWrongReceipt,
}
var ErrUnexpectedHttpStatus = merry.New("unexpected HTTP status")
var ErrNoReceiptData = merry.New("no receipt data in response")

type ReceiptInfoResponse struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Status int64  `json:"status"`
}

func addReceipt(refQRText, sessionID string) (*ReceiptInfoResponse, error) {
	body, err := json.Marshal(map[string]string{"qr": refQRText})
	if err != nil {
		return nil, merry.Wrap(err)
	}
	println(string(body))
	req, err := http.NewRequest("POST", "https://irkkt-mobile.nalog.ru:8888/v2/ticket", bytes.NewBuffer(body))
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("sessionId", sessionID)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	buf, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	defer resp.Body.Close()

	log.Debug().Str("status", resp.Status).Str("data", string(buf)).Msg("addReceipt")

	if resp.Status != "200 OK" {
		return nil, ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	recResp := &ReceiptInfoResponse{}
	if err := json.Unmarshal(buf, recResp); err != nil {
		return nil, merry.Wrap(err)
	}

	statusErr, ok := ErrByStatus[recResp.Status]
	if ok {
		return nil, statusErr.Here()
	}
	return recResp, nil
}

func getReceiptData(receiptID, sessionID string) ([]byte, error) {
	req, err := http.NewRequest("GET", "https://irkkt-mobile.nalog.ru:8888/v2/tickets/"+receiptID, nil)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("sessionId", sessionID)
	req.Header.Set("Device-Id", "iPhone 12 made in China")
	req.Header.Set("Device-OS", "Android 4.4")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	buf, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	defer resp.Body.Close()

	log.Debug().Str("status", resp.Status).Str("data", string(buf)).Msg("getReceiptData")

	if resp.Status != "200 OK" {
		return nil, ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	var dataKeys map[string]json.RawMessage
	if err := json.Unmarshal(buf, &dataKeys); err != nil {
		return nil, merry.Wrap(err)
	}
	if _, ok := dataKeys["ticket"]; !ok {
		return nil, ErrNoReceiptData.Here().Append(string(buf))
	}

	return buf, nil
}

func fetchReceipt(refQRText, sessionID string) ([]byte, error) {
	rec, err := addReceipt(refQRText, sessionID)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return getReceiptData(rec.ID, sessionID)
}

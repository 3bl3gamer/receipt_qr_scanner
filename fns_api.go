package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

// https://habr.com/ru/post/358966/ (Универсальный API для получения информации по чекам)
// UPD:
//   АПИ изменилось, теперь нужен айди сессии
//   https://github.com/kosov/fns-check/issues/3#issuecomment-673966281

var ErrReceiptMaybeNotReadyYet = merry.New("Чек (возможно) ещё не подгружен") // точное название статусов (0/1/3) неизвестно, но при их получении стоит повторить запрос после небольшой паузы
var ErrWaitingForConnection = merry.New("Ожидает соединения")
var ErrCashboxOffline = merry.New("Чек корректен, но отсутствует в хранилище: касса автономна") // (Автономная касса)
var ErrReceiveFailed = merry.New("Ошибка получения")
var ErrWrongReceipt = merry.New("Чек не является кассовым чеком или БСО") // (Не кассовый чек)
var ErrByStatus = map[int64]merry.Error{
	0:  ErrReceiptMaybeNotReadyYet,
	1:  ErrReceiptMaybeNotReadyYet,
	3:  ErrReceiptMaybeNotReadyYet,
	5:  ErrWaitingForConnection,
	8:  ErrCashboxOffline,
	9:  ErrReceiveFailed,
	15: ErrWrongReceipt,
}
var ErrUnexpectedHttpStatus = merry.New("unexpected HTTP status")
var ErrNoReceiptData = merry.New("no receipt data in response")
var ErrToManyRequests = merry.New("too many requests")

type ReceiptInfoResponse struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Status int64  `json:"status"`
}

type RefreshSessionResponse struct {
	SessionID    string `json:"sessionId"`
	RefreshToken string `json:"refresh_token"`
}

type ProfileResponse struct {
	Email   string `json:"email"`
	Inn     string `json:"inn"`
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Region  int64  `json:"region"`
	Surname string `json:"surname"`
}

func newGetRequest(url string) (*http.Request, error) {
	req, err := http.NewRequest("GET", "https://irkkt-mobile.nalog.ru:8888"+url, nil)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return req, nil
}

func newPostRequest(url string, body interface{}) (*http.Request, error) {
	bodyBuf, err := json.Marshal(body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req, err := http.NewRequest("POST", "https://irkkt-mobile.nalog.ru:8888"+url, bytes.NewBuffer(bodyBuf))
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func addDeviceHeaders(req *http.Request) {
	req.Header.Set("Device-Id", "iPhone 12 made in China")
	req.Header.Set("Device-OS", "Android 4.4")
}

func sendRequestAndRead(req *http.Request) ([]byte, error) {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	defer resp.Body.Close()

	log.Debug().Int("code", resp.StatusCode).Str("status", resp.Status).Str("path", req.URL.Path).Str("data", string(buf)).Msg("response")

	if resp.StatusCode == 429 {
		return nil, ErrToManyRequests.Here()
	}

	if resp.Status != "200 OK" {
		return nil, ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}
	return buf, nil
}

func sendRequestAndReadTo(req *http.Request, dest interface{}) error {
	buf, err := sendRequestAndRead(req)
	if err != nil {
		return merry.Wrap(err)
	}
	if err := json.Unmarshal(buf, dest); err != nil {
		return merry.Wrap(err)
	}
	return nil
}

func fnsRefreshSession(refreshToken, clientSecret string) (*RefreshSessionResponse, error) {
	params := map[string]string{"client_secret": clientSecret, "refresh_token": refreshToken}
	req, err := newPostRequest("/v2/mobile/users/refresh", params)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	addDeviceHeaders(req)

	sessUpdate := &RefreshSessionResponse{}
	if err := sendRequestAndReadTo(req, sessUpdate); err != nil {
		return nil, merry.Wrap(err)
	}
	return sessUpdate, nil
}

func fnsGetProfile(sessionID string) (*ProfileResponse, error) {
	req, err := newGetRequest("/v2/mobile/user/profile")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("sessionId", sessionID)

	profile := &ProfileResponse{}
	if err := sendRequestAndReadTo(req, profile); err != nil {
		return nil, merry.Wrap(err)
	}
	return profile, nil
}

func fnsAddReceipt(refQRText, sessionID string) (*ReceiptInfoResponse, error) {
	params := map[string]string{"qr": refQRText}
	req, err := newPostRequest("/v2/ticket", params)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("sessionId", sessionID)

	recResp := &ReceiptInfoResponse{}
	if err := sendRequestAndReadTo(req, recResp); err != nil {
		return nil, merry.Wrap(err)
	}
	statusErr, ok := ErrByStatus[recResp.Status]
	if ok {
		return nil, statusErr.Here()
	}
	return recResp, nil
}

func fnsGetReceiptData(receiptID, sessionID string) ([]byte, error) {
	req, err := newGetRequest("/v2/tickets/" + receiptID)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	req.Header.Set("sessionId", sessionID)
	addDeviceHeaders(req)

	buf, err := sendRequestAndRead(req)
	if err != nil {
		return nil, merry.Wrap(err)
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

func fnsFetchReceipt(refQRText, sessionID string) ([]byte, error) {
	rec, err := fnsAddReceipt(refQRText, sessionID)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return fnsGetReceiptData(rec.ID, sessionID)
}

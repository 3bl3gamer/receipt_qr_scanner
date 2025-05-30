package ru_fns

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"math/rand"
	"net/http"
	"os"
	"receipt_qr_scanner/utils"
	"strconv"

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
	req.Header["Content-Type"] = []string{"application/json; charset=utf-8"}
	// req.Header["Content-Length"] будет добавлен автоматически
	return req, nil
}

func addCommonHeaders(req *http.Request, useFirebaseTokenForDeviceID bool) {
	var deviceID string
	if useFirebaseTokenForDeviceID {
		deviceID = os.Getenv("RU_FNS_FIREBASE_TOKEN")
		if deviceID == "" {
			deviceID = "noFirebaseToken" //так было в приложении
		}
	} else {
		deviceID = os.Getenv("RU_FNS_DEVICE_ID")
		if deviceID == "" {
			deviceID = strconv.FormatUint(rand.Uint64()|(1<<63), 16)
		}
	}

	// req.Header.Set() сделает ключи каноничными (Device-OS -> Device-Os), это не нужно, прописываем напрямую
	req.Header["Accept-Encoding"] = []string{"gzip"}
	req.Header["ClientVersion"] = []string{"2.27.3"}
	req.Header["Connection"] = []string{"Keep-Alive"}
	req.Header["Device-Id"] = []string{deviceID}
	req.Header["Device-OS"] = []string{"Android"}
	req.Header["User-Agent"] = []string{"okhttp/5.0.0-alpha.2"}
	// req.Header["Host"] = []string{"irkkt-mobile.nalog.ru:8888"} //добавляется автоматически
}

func addSessionIDHeader(req *http.Request, sessionID string) {
	req.Header["sessionId"] = []string{sessionID}
}

func sendRequestAndRead(req *http.Request) ([]byte, error) {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	bodyReader := resp.Body
	defer bodyReader.Close()
	// "if the user explicitly requested gzip it is not automatically uncompressed" https://go.dev/src/net/http/transport.go#L194
	if resp.Header.Get("Content-Encoding") == "gzip" {
		bodyReader, err = gzip.NewReader(bodyReader)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		defer bodyReader.Close()
	}

	buf, err := io.ReadAll(bodyReader)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	log.Debug().Int("code", resp.StatusCode).Str("status", resp.Status).Str("path", req.URL.Path).Str("data", string(buf)).Msg("ru-fns: response")

	if resp.StatusCode == 429 {
		return nil, ErrToManyRequests.Here()
	}

	if resp.Status != "200 OK" {
		return nil, utils.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
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
	// Accept-Encoding: gzip
	// ClientVersion: 2.27.3
	// Connection: Keep-Alive
	// Content-Length: 103
	// Content-Type: application/json; charset=utf-8
	// Device-Id: shared_prefs/ru.fns.billchecker_preferences.xml -> FIREBASE_TOKEN (142 chars)
	// Device-OS: Android
	// Host: irkkt-mobile.nalog.ru:8888
	// User-Agent: okhttp/5.0.0-alpha.2
	params := map[string]string{"client_secret": clientSecret, "refresh_token": refreshToken}
	req, err := newPostRequest("/v2/mobile/users/refresh", params)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	addCommonHeaders(req, true)

	sessUpdate := &RefreshSessionResponse{}
	if err := sendRequestAndReadTo(req, sessUpdate); err != nil {
		return nil, merry.Wrap(err)
	}
	return sessUpdate, nil
}

func fnsGetProfile(sessionID string) (*ProfileResponse, error) {
	// Accept-Encoding: gzip
	// ClientVersion: 2.27.3
	// Connection: Keep-Alive
	// Device-Id: 1122334455667788 (ANDROID_ID, 64-bit number (expressed as a hexadecimal string), unique to each combination of app-signing key, user, and device)
	// Device-OS: Android
	// Host: irkkt-mobile.nalog.ru:8888
	// sessionId: 009988776655443322110099:11223344-1122-4xxx-axxx-112233445566
	// User-Agent: okhttp/5.0.0-alpha.2
	req, err := newGetRequest("/v2/mobile/user/profile")
	if err != nil {
		return nil, merry.Wrap(err)
	}
	addCommonHeaders(req, false)
	addSessionIDHeader(req, sessionID)

	profile := &ProfileResponse{}
	if err := sendRequestAndReadTo(req, profile); err != nil {
		return nil, merry.Wrap(err)
	}
	return profile, nil
}

func fnsAddReceipt(refQRText, sessionID string) (*ReceiptInfoResponse, error) {
	// Accept-Encoding: gzip
	// ClientVersion: 2.27.3
	// Connection: Keep-Alive
	// Content-Length: 73
	// Content-Type: application/json; charset=UTF-8
	// Device-Id: 1122334455667788 (ANDROID_ID, 64-bit number (expressed as a hexadecimal string), unique to each combination of app-signing key, user, and device)
	// Device-OS: Android
	// Host: irkkt-mobile.nalog.ru:8888
	// sessionId: 009988776655443322110099:11223344-1122-4xxx-axxx-112233445566
	// User-Agent: okhttp/5.0.0-alpha.2
	params := map[string]string{"qr": refQRText}
	req, err := newPostRequest("/v2/ticket", params)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	addCommonHeaders(req, false)
	addSessionIDHeader(req, sessionID)

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
	// Accept-Encoding: gzip
	// ClientVersion: 2.27.3
	// Connection: Keep-Alive
	// Device-Id: 1122334455667788 (ANDROID_ID, 64-bit number (expressed as a hexadecimal string), unique to each combination of app-signing key, user, and device)
	// Device-OS: Android
	// Host: irkkt-mobile.nalog.ru:8888
	// sessionId: 009988776655443322110099:11223344-1122-4xxx-axxx-112233445566
	// User-Agent: okhttp/5.0.0-alpha.2
	req, err := newGetRequest("/v2/tickets/" + receiptID)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	addCommonHeaders(req, false)
	addSessionIDHeader(req, sessionID)

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

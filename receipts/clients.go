package receipts

import "github.com/ansel1/merry"

var ErrSessionNotFound = merry.New("session not found")
var ErrUnexpectedHttpStatus = merry.New("unexpected HTTP status")
var ErrResponseDataMalformed = merry.New("response data malformed")

type FetchReceiptResult struct {
	ShouldDecreaseRetries bool
	Data                  []byte
	RedirectRefText       string // если не пустой, нужно пересохранить чек с новым ref_text (см. kz-wip-proxy)
}

type Client interface {
	Init() error
	FetchReceipt(ref ReceiptRef, onIsCorrect func() error) (FetchReceiptResult, error)
}

type ClientWithSession interface {
	Client
	LoadSession() error
	InitSession(args ...string) error
}

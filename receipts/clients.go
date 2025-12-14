package receipts

import "github.com/ansel1/merry"

var ErrSessionNotFound = merry.New("session not found")
var ErrUnexpectedHttpStatus = merry.New("unexpected HTTP status")
var ErrResponseDataMalformed = merry.New("response data malformed")

type FetchReceiptResult struct {
	ShouldDecreaseRetries bool
	Data                  []byte
}

type Client interface {
	FetchReceipt(ref ReceiptRef, onIsCorrect func() error) (FetchReceiptResult, error)
}

type ClientWithSession interface {
	Client
	LoadSession() error
	InitSession(args ...string) error
}

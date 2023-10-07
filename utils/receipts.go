package utils

import (
	"time"

	"github.com/ansel1/merry"
)

var ErrSessionNotFound = merry.New("session not found")
var ErrUnexpectedHttpStatus = merry.New("unexpected HTTP status")

type ReceiptRef interface {
	String() string
	Domain() string
	RefText() string
	ValidateFormat() error
	UniqueKey() string
	CreatedAt() (time.Time, error)
	SearchKeyItems() ([]string, error)
}

type Receipt struct {
	ID          int64     `json:"id"`
	Domain      string    `json:"domain"`
	SavedAt     time.Time `json:"savedAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	CreatedAt   time.Time `json:"createdAt"`
	RefText     string    `json:"refText"`
	IsCorrect   bool      `json:"isCorrect"`
	Data        string    `json:"data"`
	SearchKey   string    `json:"searchKey"`
	RetriesLeft int64     `json:"retriesLeft"`
	NextRetryAt time.Time `json:"nextRetryAt"`
}

type FetchReceiptResult struct {
	ShouldDecreaseRetries bool
	Data                  []byte
}

type Client interface {
	LoadSession() error
	FetchReceipt(ref ReceiptRef, onIsCorrect func() error) (FetchReceiptResult, error)
}

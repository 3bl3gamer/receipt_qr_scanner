package receipts

import (
	"errors"
	"time"
)

type Domain struct {
	Code            string
	CurrencySymbol  string
	FlagSymbol      string
	ParseReceiptRef func(refText string) (ReceiptRef, error)
	MakeClient      func() Client
}

type ReceiptRef interface {
	String() string
	Domain() Domain
	RefText() string
	UniqueKey() string
	CreatedAt() time.Time
	Sum() float64
	SearchKeyItems() []string
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

func ReceiptRefFromText(domains []Domain, refText string) (ReceiptRef, error) {
	var errs []error
	for _, d := range domains {
		ref, err := d.ParseReceiptRef(refText)
		if err == nil {
			return ref, nil
		}
		errs = append(errs, err)
	}
	return nil, errors.Join(errs...)
}

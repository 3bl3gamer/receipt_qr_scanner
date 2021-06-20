package main

import (
	"fmt"
	"time"
)

type ReceiptRef struct {
	FiscalNum  int64     `json:"fiscalNum"`
	FiscalDoc  int64     `json:"fiscalDoc"`
	FiscalSign int64     `json:"fiscalSign"`
	Kind       int64     `json:"kind"`
	Summ       float64   `json:"summ"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (r ReceiptRef) String() string {
	return fmt.Sprintf("Ref{%d-%d-%d-%d %.02f %s}",
		r.FiscalNum, r.FiscalDoc, r.FiscalSign, r.Kind, r.Summ, r.CreatedAt.Format("2006-01-02 15:04"))
}

type Receipt struct {
	ID          int64      `json:"id"`
	SavedAt     time.Time  `json:"savedAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	Ref         ReceiptRef `json:"ref"`
	IsCorrect   bool       `json:"isCorrect"`
	RefText     string     `json:"refText"`
	Data        string     `json:"data"`
	SearchKey   string     `json:"searchKey"`
	RetriesLeft int64      `json:"retriesLeft"`
	NextRetryAt time.Time  `json:"nextRetryAt"`
}

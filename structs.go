package main

import "time"

import "database/sql"

import "fmt"

type ReceiptRef struct {
	FiscalNum  int64
	FiscalDoc  int64
	FiscalSign int64
	Kind       int64
	Summ       float64
	CreatedAt  time.Time
}

func (r ReceiptRef) String() string {
	return fmt.Sprintf("Ref{%d-%d-%d-%d %.02f %s}",
		r.FiscalNum, r.FiscalDoc, r.FiscalSign, r.Kind, r.Summ, r.CreatedAt.Format("2006-01-02 15:04"))
}

type Receipt struct {
	Ref       ReceiptRef
	IsCorrect sql.NullBool
}

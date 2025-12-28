package kz_jus

import (
	"slices"
	"strings"
	"testing"
	"time"
)

func TestParseReceiptRef(t *testing.T) {
	tests := []struct {
		qrText                 string
		wantTicketNumber       string
		wantRegistrationNumber string
		wantSum                float64
		wantDate               string
		wantUniqKey            string
		wantSearchKey          string
	}{
		{
			qrText:                 "http://consumer.kofd.kz?i=123456789012&f=010101234567&s=1230.00&t=20251208T123456",
			wantTicketNumber:       "123456789012",
			wantRegistrationNumber: "010101234567",
			wantSum:                1230.00,
			wantDate:               "2025-12-08 12:34:56",
			wantUniqKey:            "kz-jus:f=010101234567&i=123456789012&s=1230.00&t=20251208T123456",
			wantSearchKey:          "_created_at:2025-12-08 12:34   _fiscal_id:123456789012   _kkm_fns_id:010101234567   _sum:1230.00",
		},
		{
			qrText:                 "http://consumer.kofd.kz?i=0123&f=010101234567&s=1230.12&t=20251220T123456",
			wantTicketNumber:       "0123",
			wantRegistrationNumber: "010101234567",
			wantSum:                1230.12,
			wantDate:               "2025-12-20 12:34:56",
			wantUniqKey:            "kz-jus:f=010101234567&i=0123&s=1230.12&t=20251220T123456",
			wantSearchKey:          "_created_at:2025-12-20 12:34   _fiscal_id:0123   _kkm_fns_id:010101234567   _sum:1230.12",
		},
	}

	for _, tt := range tests {
		t.Run(tt.qrText, func(t *testing.T) {
			ref, err := NewReceiptRef(tt.qrText)
			if err != nil {
				t.Errorf("NewReceiptRef() error = %v", err)
				return
			}

			if ref.data.FiscalId != tt.wantTicketNumber {
				t.Errorf("TicketNumber = %v, want %v", ref.data.FiscalId, tt.wantTicketNumber)
			}
			if ref.data.KkmFnsId != tt.wantRegistrationNumber {
				t.Errorf("RegistrationNumber = %v, want %v", ref.data.KkmFnsId, tt.wantRegistrationNumber)
			}
			if ref.data.TotalSum != tt.wantSum {
				t.Errorf("TotalSum = %v, want %v", ref.data.TotalSum, tt.wantSum)
			}

			wantTime, _ := time.Parse("2006-01-02 15:04:05", tt.wantDate)
			if !ref.data.TransactionDate.Equal(wantTime) {
				t.Errorf("TransactionDate = %v, want %v", ref.data.TransactionDate, wantTime)
			}

			// Проверка методов интерфейса
			if ref.Sum() != tt.wantSum {
				t.Errorf("Sum() = %v, want %v", ref.Sum(), tt.wantSum)
			}
			if !ref.CreatedAt().Equal(wantTime) {
				t.Errorf("CreatedAt() = %v, want %v", ref.CreatedAt(), wantTime)
			}
			if ref.Domain().Code != "kz-jus" {
				t.Errorf("Domain().Code = %v, want kz-jus", ref.Domain().Code)
			}
			if ref.RefText() != tt.qrText {
				t.Errorf("RefText() = %v, want %v", ref.RefText(), tt.qrText)
			}
			if ref.UniqueKey() != tt.wantUniqKey {
				t.Errorf("UniqueKey() = %v, want %v", ref.UniqueKey(), tt.wantUniqKey)
			}
			if !slices.Equal(ref.SearchKeyItems(), strings.Split(tt.wantSearchKey, "   ")) {
				t.Errorf("SearchKeyItems() = %v, want %v", ref.SearchKeyItems(), strings.Split(tt.wantSearchKey, "   "))
			}
		})
	}
}

func TestUniqueKeyConsistency(t *testing.T) {
	// Один и тот же чек должен давать одинаковый UniqueKey
	qr1 := "http://consumer.kofd.kz?i=123456789012&f=010101234567&s=1230.00&t=20251208T123456"
	qr2 := "http://consumer.kofd.kz?t=20251208T123456&s=1230.00&f=010101234567&i=123456789012" // Параметры в другом порядке

	ref1, err1 := NewReceiptRef(qr1)
	ref2, err2 := NewReceiptRef(qr2)

	if err1 != nil || err2 != nil {
		t.Fatalf("Parsing failed: err1=%v, err2=%v", err1, err2)
	}

	if ref1.UniqueKey() != ref2.UniqueKey() {
		t.Errorf("UniqueKey mismatch:\n  ref1: %s\n  ref2: %s", ref1.UniqueKey(), ref2.UniqueKey())
	}
}

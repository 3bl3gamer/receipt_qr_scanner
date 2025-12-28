package kz_ktc

import (
	"slices"
	"strings"
	"testing"
	"time"
)

func TestParseReceiptRef(t *testing.T) {
	tests := []struct {
		qrText        string
		wantFiscalId  string
		wantKkmFnsId  string
		wantSum       float64
		wantDate      string
		wantUniqKey   string
		wantSearchKey string
	}{
		{
			qrText:        "http://consumer.oofd.kz?i=0123456789&f=010101012345&s=1600.00&t=20240309T123456",
			wantFiscalId:  "0123456789",
			wantKkmFnsId:  "010101012345",
			wantSum:       1600.00,
			wantDate:      "2024-03-09 12:34:56",
			wantUniqKey:   "kz-ktc:f=010101012345&i=0123456789&s=1600.00&t=20240309T123456",
			wantSearchKey: "_created_at:2024-03-09 12:34   _fiscal_id:0123456789   _kkm_fns_id:010101012345   _sum:1600.00",
		},
		{
			qrText:        "http://consumer.oofd.kz?i=123456789&f=910101012345&s=1600.12&t=20240309T123456",
			wantFiscalId:  "123456789",
			wantKkmFnsId:  "910101012345",
			wantSum:       1600.12,
			wantDate:      "2024-03-09 12:34:56",
			wantUniqKey:   "kz-ktc:f=910101012345&i=123456789&s=1600.12&t=20240309T123456",
			wantSearchKey: "_created_at:2024-03-09 12:34   _fiscal_id:123456789   _kkm_fns_id:910101012345   _sum:1600.12",
		},
	}

	for _, tt := range tests {
		t.Run(tt.qrText, func(t *testing.T) {
			ref, err := NewReceiptRef(tt.qrText)
			if err != nil {
				t.Errorf("NewReceiptRef() error = %v", err)
				return
			}

			if ref.data.FiscalID != tt.wantFiscalId {
				t.Errorf("FiscalId = %v, want %v", ref.data.FiscalID, tt.wantFiscalId)
			}
			if ref.data.KkmFnsId != tt.wantKkmFnsId {
				t.Errorf("KkmFnsId = %v, want %v", ref.data.KkmFnsId, tt.wantKkmFnsId)
			}
			if ref.data.Sum != tt.wantSum {
				t.Errorf("TotalSum = %v, want %v", ref.data.Sum, tt.wantSum)
			}

			wantTime, _ := time.Parse("2006-01-02 15:04:05", tt.wantDate)
			if !ref.data.CreatedAt.Equal(wantTime) {
				t.Errorf("TransactionDate = %v, want %v", ref.data.CreatedAt, wantTime)
			}

			// Проверка методов интерфейса
			if ref.Sum() != tt.wantSum {
				t.Errorf("Sum() = %v, want %v", ref.Sum(), tt.wantSum)
			}
			if !ref.CreatedAt().Equal(wantTime) {
				t.Errorf("CreatedAt() = %v, want %v", ref.CreatedAt(), wantTime)
			}
			if ref.Domain().Code != "kz-ktc" {
				t.Errorf("Domain().Code = %v, want kz-ktc", ref.Domain().Code)
			}
			if ref.RefText() != tt.qrText {
				t.Errorf("RefText() = %v, want %v", ref.RefText(), tt.qrText)
			}
			if ref.UniqueKey() != tt.wantUniqKey {
				t.Errorf("UniqueKey() = %v, want %v", ref.UniqueKey(), tt.wantUniqKey)
			}
			if !slices.Equal(ref.SearchKeyItems(), strings.Split(tt.wantSearchKey, "   ")) {
				t.Errorf("UniqueKey() = %v, want %v", ref.SearchKeyItems(), strings.Split(tt.wantSearchKey, "   "))
			}
		})
	}
}

func TestUniqueKeyConsistency(t *testing.T) {
	// Один и тот же чек должен давать одинаковый UniqueKey
	qr1 := "http://consumer.oofd.kz?i=123456789&f=010101012345&s=10600.00&t=20240309T195411"
	qr2 := "http://consumer.oofd.kz?t=20240309T195411&s=10600.00&f=010101012345&i=123456789" // Параметры в другом порядке

	ref1, err1 := NewReceiptRef(qr1)
	ref2, err2 := NewReceiptRef(qr2)

	if err1 != nil || err2 != nil {
		t.Fatalf("Parsing failed: err1=%v, err2=%v", err1, err2)
	}

	if ref1.UniqueKey() != ref2.UniqueKey() {
		t.Errorf("UniqueKey mismatch:\n  ref1: %s\n  ref2: %s", ref1.UniqueKey(), ref2.UniqueKey())
	}
}

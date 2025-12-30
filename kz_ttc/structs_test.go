package kz_ttc

import (
	"slices"
	"strings"
	"testing"
	"time"
)

func TestParseReceiptRef(t *testing.T) {
	tests := []struct {
		qrText        string
		wantFiscalID  string
		wantKkmFnsId  string
		wantSum       float64
		wantDate      string
		wantUniqKey   string
		wantSearchKey string
	}{
		{
			qrText:        "http://ofd1.kz/t/?i=123456789012&f=010101234567&s=1230.00&t=20240309T123456",
			wantFiscalID:  "123456789012",
			wantKkmFnsId:  "010101234567",
			wantSum:       1230.00,
			wantDate:      "2024-03-09 12:34:56",
			wantUniqKey:   "kz-ttc:f=010101234567&i=123456789012&s=1230.00&t=20240309T123456",
			wantSearchKey: "_created_at:2024-03-09 12:34   _fiscal_id:123456789012   _kkm_fns_id:010101234567   _sum:1230.00",
		},
		{
			qrText:        "http://ofd1.kz/t/?i=023456789012&f=010101234567&s=1230.12&t=20240309T123456",
			wantFiscalID:  "023456789012",
			wantKkmFnsId:  "010101234567",
			wantSum:       1230.12,
			wantDate:      "2024-03-09 12:34:56",
			wantUniqKey:   "kz-ttc:f=010101234567&i=023456789012&s=1230.12&t=20240309T123456",
			wantSearchKey: "_created_at:2024-03-09 12:34   _fiscal_id:023456789012   _kkm_fns_id:010101234567   _sum:1230.12",
		},
	}

	for _, tt := range tests {
		t.Run(tt.qrText, func(t *testing.T) {
			ref, err := NewReceiptRef(tt.qrText)
			if err != nil {
				t.Errorf("NewReceiptRef() error = %v", err)
				return
			}

			if ref.data.FiscalID != tt.wantFiscalID {
				t.Errorf("FiscalID = %v, want %v", ref.data.FiscalID, tt.wantFiscalID)
			}
			if ref.data.KkmFnsId != tt.wantKkmFnsId {
				t.Errorf("KkmFnsId = %v, want %v", ref.data.KkmFnsId, tt.wantKkmFnsId)
			}
			if ref.data.Sum != tt.wantSum {
				t.Errorf("Sum = %v, want %v", ref.data.Sum, tt.wantSum)
			}

			wantTime, _ := time.Parse("2006-01-02 15:04:05", tt.wantDate)
			if !ref.data.CreatedAt.Equal(wantTime) {
				t.Errorf("CreatedAt = %v, want %v", ref.data.CreatedAt, wantTime)
			}

			// Проверка методов интерфейса
			if ref.Sum() != tt.wantSum {
				t.Errorf("Sum() = %v, want %v", ref.Sum(), tt.wantSum)
			}
			if !ref.CreatedAt().Equal(wantTime) {
				t.Errorf("CreatedAt() = %v, want %v", ref.CreatedAt(), wantTime)
			}
			if ref.Domain().Code != "kz-ttc" {
				t.Errorf("Domain().Code = %v, want kz-ttc", ref.Domain().Code)
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
	qr1 := "http://ofd1.kz/t/?i=123456789012&f=010101234567&s=1230.00&t=20240309T123456"
	qr2 := "http://ofd1.kz/t/?f=010101234567&s=1230.00&i=123456789012&t=20240309T123456"

	ref1, err1 := NewReceiptRef(qr1)
	ref2, err2 := NewReceiptRef(qr2)

	if err1 != nil || err2 != nil {
		t.Fatalf("Parsing failed: err1=%v, err2=%v", err1, err2)
	}

	if ref1.UniqueKey() != ref2.UniqueKey() {
		t.Errorf("UniqueKey mismatch:\n  ref1: %s\n  ref2: %s", ref1.UniqueKey(), ref2.UniqueKey())
	}
}

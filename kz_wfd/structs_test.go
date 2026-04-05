package kz_wfd

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
			qrText:        "https://consumer.wofd.kz?i=912345678901&f=010105678901&s=8500.00&t=20260115T143000",
			wantFiscalID:  "912345678901",
			wantKkmFnsId:  "010105678901",
			wantSum:       8500.00,
			wantDate:      "2026-01-15 14:30:00",
			wantUniqKey:   "kz-wfd:f=010105678901&i=912345678901&s=8500.00&t=20260115T143000",
			wantSearchKey: "_created_at:2026-01-15 14:30   _fiscal_id:912345678901   _kkm_fns_id:010105678901   _sum:8500.00",
		},
		{
			qrText:        "http://consumer.wofd.kz?i=823456789012&f=010105678901&s=6200.50&t=20251120T091500",
			wantFiscalID:  "823456789012",
			wantKkmFnsId:  "010105678901",
			wantSum:       6200.50,
			wantDate:      "2025-11-20 09:15:00",
			wantUniqKey:   "kz-wfd:f=010105678901&i=823456789012&s=6200.50&t=20251120T091500",
			wantSearchKey: "_created_at:2025-11-20 09:15   _fiscal_id:823456789012   _kkm_fns_id:010105678901   _sum:6200.50",
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
			if ref.Domain().Code != "kz-wfd" {
				t.Errorf("Domain().Code = %v, want kz-wfd", ref.Domain().Code)
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
	qr1 := "https://consumer.wofd.kz?i=912345678901&f=010105678901&s=8500.00&t=20260115T143000"
	qr2 := "https://consumer.wofd.kz?t=20260115T143000&s=8500.00&f=010105678901&i=912345678901"

	ref1, err1 := NewReceiptRef(qr1)
	ref2, err2 := NewReceiptRef(qr2)

	if err1 != nil || err2 != nil {
		t.Fatalf("Parsing failed: err1=%v, err2=%v", err1, err2)
	}

	if ref1.UniqueKey() != ref2.UniqueKey() {
		t.Errorf("UniqueKey mismatch:\n  ref1: %s\n  ref2: %s", ref1.UniqueKey(), ref2.UniqueKey())
	}
}

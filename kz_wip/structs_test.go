package kz_wip

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
			qrText:        "https://app.kassa.wipon.kz/consumer?i=5612340017&f=600407890704&s=2750.00&t=20260310T093045",
			wantFiscalID:  "5612340017",
			wantKkmFnsId:  "600407890704",
			wantSum:       2750.00,
			wantDate:      "2026-03-10 09:30:45",
			wantUniqKey:   "kz-wip:f=600407890704&i=5612340017&s=2750.00&t=20260310T093045",
			wantSearchKey: "_created_at:2026-03-10 09:30   _fiscal_id:5612340017   _kkm_fns_id:600407890704   _sum:2750.00",
		},
		{
			qrText:        "https://app.kassa.wipon.kz/consumer?i=2987650017&f=010105432842&s=8430.00&t=20260115T201500",
			wantFiscalID:  "2987650017",
			wantKkmFnsId:  "010105432842",
			wantSum:       8430.00,
			wantDate:      "2026-01-15 20:15:00",
			wantUniqKey:   "kz-wip:f=010105432842&i=2987650017&s=8430.00&t=20260115T201500",
			wantSearchKey: "_created_at:2026-01-15 20:15   _fiscal_id:2987650017   _kkm_fns_id:010105432842   _sum:8430.00",
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
			if ref.Domain().Code != "kz-wip" {
				t.Errorf("Domain().Code = %v, want kz-wip", ref.Domain().Code)
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
	qr1 := "https://app.kassa.wipon.kz/consumer?i=5612340017&f=600407890704&s=2750.00&t=20260310T093045"
	qr2 := "https://app.kassa.wipon.kz/consumer?t=20260310T093045&s=2750.00&f=600407890704&i=5612340017"

	ref1, err1 := NewReceiptRef(qr1)
	ref2, err2 := NewReceiptRef(qr2)

	if err1 != nil || err2 != nil {
		t.Fatalf("Parsing failed: err1=%v, err2=%v", err1, err2)
	}

	if ref1.UniqueKey() != ref2.UniqueKey() {
		t.Errorf("UniqueKey mismatch:\n  ref1: %s\n  ref2: %s", ref1.UniqueKey(), ref2.UniqueKey())
	}
}

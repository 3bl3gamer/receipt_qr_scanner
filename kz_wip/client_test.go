package kz_wip

import (
	"testing"
	"time"
)

func TestBuildAPIURL(t *testing.T) {
	tests := []struct {
		data    ReceiptRefData
		wantURL string
	}{
		{
			data: ReceiptRefData{
				FiscalID:  "5612340017",
				KkmFnsId:  "600407890704",
				Sum:       2750.00,
				CreatedAt: time.Date(2026, 3, 10, 9, 30, 45, 0, time.UTC),
			},
			wantURL: "https://api.kassa.wipon.kz/api/v1/consumer?f=600407890704&i=5612340017&s=2750.00&t=20260310T093045",
		},
		{
			data: ReceiptRefData{
				FiscalID:  "2987650017",
				KkmFnsId:  "010105432842",
				Sum:       8430.00,
				CreatedAt: time.Date(2026, 1, 15, 20, 15, 0, 0, time.UTC),
			},
			wantURL: "https://api.kassa.wipon.kz/api/v1/consumer?f=010105432842&i=2987650017&s=8430.00&t=20260115T201500",
		},
	}

	for _, tt := range tests {
		t.Run(tt.wantURL, func(t *testing.T) {
			gotURL := makeAPIURL(tt.data)
			if gotURL != tt.wantURL {
				t.Errorf("makeAPIURL() =\n  %v\nwant:\n  %v", gotURL, tt.wantURL)
			}
		})
	}
}

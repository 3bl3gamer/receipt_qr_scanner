package kz_ktc

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
				FiscalID:  "0123456789",
				KkmFnsId:  "010101012345",
				Sum:       1600.12,
				CreatedAt: time.Date(2024, 3, 9, 12, 34, 56, 0, time.UTC),
			},
			wantURL: "https://consumer.oofd.kz/api/tickets/get-by-url?f=010101012345&i=0123456789&s=1600.12&t=20240309T123456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.wantURL, func(t *testing.T) {
			gotURL := makeAPIURL(tt.data)
			if gotURL != tt.wantURL {
				t.Errorf("buildAPIURL() =\n  %v\nwant:\n  %v", gotURL, tt.wantURL)
			}
		})
	}
}

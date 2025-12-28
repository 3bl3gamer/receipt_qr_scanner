package kz_jus

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
				FiscalId:        "123456789012",
				KkmFnsId:        "910101234567",
				TransactionDate: time.Date(2025, 12, 8, 12, 34, 0, 0, time.UTC),
			},
			wantURL: "https://cabinet.kofd.kz/api/tickets?registrationNumber=910101234567&ticketDate=2025-12-08&ticketNumber=123456789012",
		},
		{
			data: ReceiptRefData{
				FiscalId:        "023456789012",
				KkmFnsId:        "010101234567",
				TransactionDate: time.Date(2025, 12, 20, 12, 34, 6, 0, time.UTC),
			},
			wantURL: "https://cabinet.kofd.kz/api/tickets?registrationNumber=010101234567&ticketDate=2025-12-20&ticketNumber=023456789012",
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

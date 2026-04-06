package kz_wip_proxy

import "testing"

func TestParseReceiptRef(t *testing.T) {
	tests := []struct {
		qrText      string
		wantUUID    string
		wantUniqKey string
	}{
		{
			qrText:      "https://app.kassa.wipon.kz/links/check/8ab7d2bb-1234-4a8c-4321-02185db12a23",
			wantUUID:    "8ab7d2bb-1234-4a8c-4321-02185db12a23",
			wantUniqKey: "kz-wip-proxy:8ab7d2bb-1234-4a8c-4321-02185db12a23",
		},
		{
			qrText:      "https://app.kassa.wipon.kz/links/check/019c387e-9e9a-717c-a70e-d6c7f6e0ff67",
			wantUUID:    "019c387e-9e9a-717c-a70e-d6c7f6e0ff67",
			wantUniqKey: "kz-wip-proxy:019c387e-9e9a-717c-a70e-d6c7f6e0ff67",
		},
	}

	for _, tt := range tests {
		t.Run(tt.qrText, func(t *testing.T) {
			ref, err := NewReceiptRef(tt.qrText)
			if err != nil {
				t.Fatalf("NewReceiptRef() error = %v", err)
			}
			if ref.uuid != tt.wantUUID {
				t.Errorf("uuid = %v, want %v", ref.uuid, tt.wantUUID)
			}
			if ref.UniqueKey() != tt.wantUniqKey {
				t.Errorf("UniqueKey() = %v, want %v", ref.UniqueKey(), tt.wantUniqKey)
			}
			if ref.Domain().Code != "kz-wip-proxy" {
				t.Errorf("Domain().Code = %v, want kz-wip-proxy", ref.Domain().Code)
			}
		})
	}
}

func TestRejectNonProxyURLs(t *testing.T) {
	// kz-wip URL не должен парситься как kz-wip-proxy
	_, err := NewReceiptRef("https://app.kassa.wipon.kz/consumer?i=123&f=456&s=100&t=20260101T120000")
	if err == nil {
		t.Error("expected error for consumer URL, got nil")
	}

	// другой хост
	_, err = NewReceiptRef("https://ofd.beeline.kz/t/?i=123&f=456&s=100&t=20260101T120000")
	if err == nil {
		t.Error("expected error for beeline URL, got nil")
	}

	// пустой UUID
	_, err = NewReceiptRef("https://app.kassa.wipon.kz/links/check/")
	if err == nil {
		t.Error("expected error for empty UUID, got nil")
	}
}

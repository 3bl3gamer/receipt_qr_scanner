package kz_wip_proxy

import (
	"testing"
)

func TestDecodeInnerQR_BeelineExample(t *testing.T) {
	html := []byte(`<html><body>
    <tr>
        <td colspan="12" class="text-center">
            <img src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAFcAAABXAQMAAABLBksvAAAABlBMVEUAAAD///+l2Z/dAAAAAnRSTlP//8i138cAAAAJcEhZcwAACxIAAAsSAdLdfvwAAAC3SURBVDiNzdOxDQMhDAVQn66gSxaw5DXoWOlYAHITZCU61jgpC0BHgeI4UnTXXEwXxdUrkP7HkoGPgb9wAQgWAUhx5R6gR1adcLG4mIGD7UPHjAOzhOLe4dTS3+fjL6eWKZb2nZy6GADYYtZcmST64nT3a6baSPHTzDf3ef/dsgScmBTL1PYojhW/95C2KZFi6ebTfGfVCX3bgh04uO4b6/ZMaybNkpt7bKxY+i8Op0aKf3lfY78Ah8+1JUIPmDkAAAAASUVORK5CYII="/>
        </td>
    </tr>
</body></html>`)

	innerRef, err := DecodeInnerQR(html)
	if err != nil {
		t.Fatalf("DecodeInnerQR() error = %v", err)
	}

	expected := "QR text"
	if innerRef != expected {
		t.Errorf("got %q, want %q", innerRef, expected)
	}
}

func TestDecodeInnerQR_NoImage(t *testing.T) {
	html := []byte(`<html><body><p>No QR here</p></body></html>`)

	_, err := DecodeInnerQR(html)
	if err == nil {
		t.Error("expected error for HTML without QR image, got nil")
	}
}

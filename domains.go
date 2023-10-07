package main

import (
	"receipt_qr_scanner/kg_gns"
	"receipt_qr_scanner/ru_fns"
	"receipt_qr_scanner/utils"
	"regexp"
)

var kgGnsRefTextRe = regexp.MustCompile(`^https?://[^/]+\.kg/`)

func receiptRefFromText(refText string) (utils.ReceiptRef, error) {
	if kgGnsRefTextRe.Match([]byte(refText)) {
		return kg_gns.NewReceiptRef(refText)
	}
	return ru_fns.NewReceiptRef(refText)
}

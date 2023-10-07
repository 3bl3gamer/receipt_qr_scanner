package main

import (
	"receipt_qr_scanner/ru_fns"
	"receipt_qr_scanner/utils"
)

func receiptRefFromText(refText string) (utils.ReceiptRef, error) {
	return ru_fns.NewReceiptRef(refText)
}

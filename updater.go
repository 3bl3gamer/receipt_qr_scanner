package main

import (
	"database/sql"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

func updateIter(db *sql.DB) error {
	receipts, err := loadPendingReceipts(db, 5)
	if err != nil {
		return merry.Wrap(err)
	}

	for _, rec := range receipts {
		log.Info().Msgf("checking receipt %s", rec.Ref)

		err = checkReceipt(&rec.Ref)
		if err != nil {
			log.Warn().Err(err).Msgf("receipt %s error: %s", rec.Ref, err)
			if err := saveReceiptFailure(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
			continue
		}

		log.Info().Msgf("receipt %s seems correct", rec.Ref)

		if !rec.IsCorrect.Valid || !rec.IsCorrect.Bool {
			if err := saveReceiptCorrectness(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
		}
	}
	return nil
}

func StartUpdater(db *sql.DB) error {
	for {
		if err := updateIter(db); err != nil {
			return merry.Wrap(err)
		}
		time.Sleep(5 * time.Second)
	}
}

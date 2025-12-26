package main

import (
	"database/sql"
	"maps"
	"receipt_qr_scanner/receipts"
	"slices"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

func updateIter(db *sql.DB, domain2client map[string]receipts.Client, updatedReceiptIDsChan chan int64) error {
	domainCodes := slices.Collect(maps.Keys(domain2client))

	receipts, err := loadPendingReceipts(db, domainCodes, 5)
	if err != nil {
		return merry.Wrap(err)
	}

	for _, rec := range receipts {
		log.Info().Str("ref", rec.Ref.String()).Msg("fetching receipt")

		client, ok := domain2client[rec.Ref.Domain().Code]
		if !ok {
			return merry.Errorf("no client for domain '%s'", rec.Ref.Domain().Code)
		}

		res, err := client.FetchReceipt(rec.Ref, func() error {
			var err error
			if !rec.IsCorrect {
				err = saveReceiptCorrectness(db, rec.Ref)
				updatedReceiptIDsChan <- rec.ID
			}
			return merry.Wrap(err)
		})

		if err == nil {
			log.Info().Str("ref", rec.Ref.String()).Msg("got receipt data")
			if err := saveRecieptData(db, rec.Ref, res.Data); err != nil {
				return merry.Wrap(err)
			}
		} else {
			log.Warn().Err(err).Str("ref", rec.Ref.String()).Msg("receipt error")
			if err := saveReceiptFailure(db, rec.Ref, res.ShouldDecreaseRetries); err != nil {
				return merry.Wrap(err)
			}
		}
		updatedReceiptIDsChan <- rec.ID
	}
	return nil
}

func StartUpdater(db *sql.DB, domain2client map[string]receipts.Client, triggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
	timer := time.NewTimer(200 * 365 * 24 * time.Hour) //timedelta can store ~292 years
	for {
		if err := updateIter(db, domain2client, updatedReceiptIDsChan); err != nil {
			return merry.Wrap(err)
		}
		nextRetryAt, err := loadNextRetryTime(db)
		if err != nil {
			return merry.Wrap(err)
		}
		delay := time.Until(nextRetryAt)
		if delay < time.Second {
			delay = time.Second
		}

		log.Debug().Str("delay", delay.String()).Msgf("pausing updater")
		if !timer.Stop() && len(timer.C) > 0 {
			<-timer.C
		}
		timer.Reset(delay)

		select {
		case <-triggerChan:
			log.Debug().Int("chan_len", len(triggerChan)).Msg("updater triggered")
		case <-timer.C:
		}
		//emptying triggerChan
		for len(triggerChan) > 0 {
			<-triggerChan
		}
	}
}

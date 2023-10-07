package main

import (
	"database/sql"
	"receipt_qr_scanner/utils"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

func updateIter(db *sql.DB, domain2client map[string]utils.Client, updatedReceiptIDsChan chan int64) error {
	receipts, err := loadPendingReceipts(db, 5)
	if err != nil {
		return merry.Wrap(err)
	}

	for _, rec := range receipts {
		log.Info().Str("ref", rec.Ref.String()).Msg("fetching receipt")

		client, ok := domain2client[rec.Ref.Domain()]
		if !ok {
			return merry.Errorf("no client for domain '%s'", rec.Ref.Domain())
		}

		res, err := client.FetchReceipt(rec.Ref, func() error {
			var err error
			if !rec.IsCorrect {
				err = saveReceiptCorrectness(db, rec.Ref)
				updatedReceiptIDsChan <- rec.ID
			}
			return merry.Wrap(err)
		})
		if err != nil {
			log.Warn().Err(err).Str("ref", rec.Ref.String()).Msg("receipt error")
			if err := saveReceiptFailure(db, rec.Ref, res.ShouldDecreaseRetries); err != nil {
				return merry.Wrap(err)
			}
			updatedReceiptIDsChan <- rec.ID
		}

		log.Info().Str("ref", rec.Ref.String()).Msg("got receipt data")
		if err := saveRecieptData(db, rec.Ref, res.Data); err != nil {
			return merry.Wrap(err)
		}
		updatedReceiptIDsChan <- rec.ID
	}
	return nil
}

func StartUpdater(db *sql.DB, domain2client map[string]utils.Client, triggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
	timer := time.NewTimer(200 * 365 * 24 * time.Hour) //timedelta can store ~292 years
	for {
		if err := updateIter(db, domain2client, updatedReceiptIDsChan); err != nil {
			return merry.Wrap(err)
		}
		nextRetryAt, err := loadNextRetryTime(db)
		if err != nil {
			return merry.Wrap(err)
		}
		delay := nextRetryAt.Sub(time.Now())
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

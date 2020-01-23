package main

import (
	"database/sql"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

func updateIter(db *sql.DB, updatedReceiptIDsChan chan int64) error {
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
			updatedReceiptIDsChan <- rec.ID
			continue
		}

		log.Info().Msgf("receipt %s seems correct", rec.Ref)

		if !rec.IsCorrect {
			if err := saveReceiptCorrectness(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
		}
		updatedReceiptIDsChan <- rec.ID

		log.Info().Msgf("fetching receipt %s", rec.Ref)

		data, err := fetchReceipt(&rec.Ref)
		for i := 0; i < 3; i++ {
			if merry.Is(err, ErrReceiptNotChecked) {
				log.Info().Msgf("receipt seems not checked to FNS, waiting a bit more x%d", i+1)
				time.Sleep(2 * time.Second)
				data, err = fetchReceipt(&rec.Ref)
			} else {
				break
			}
		}
		if err != nil {
			log.Warn().Err(err).Msgf("receipt %s error: %s", rec.Ref, err)
			if err := saveReceiptFailure(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
			updatedReceiptIDsChan <- rec.ID
			continue
		}

		log.Info().Msgf("got receipt %s data", rec.Ref)
		log.Debug().Msgf("data: %s", string(data))

		if err := saveRecieptData(db, &rec.Ref, data); err != nil {
			return merry.Wrap(err)
		}
		updatedReceiptIDsChan <- rec.ID
	}
	return nil
}

func StartUpdater(db *sql.DB, triggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
	timer := time.NewTimer(200 * 365 * 24 * time.Hour) //timedelta can store ~292 years
	for {
		if err := updateIter(db, updatedReceiptIDsChan); err != nil {
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

		log.Debug().Msgf("waiting %s", delay)
		if !timer.Stop() && len(timer.C) > 0 {
			<-timer.C
		}
		timer.Reset(delay)

		select {
		case <-triggerChan:
			log.Debug().Int("chan len", len(triggerChan)).Msg("updater triggered")
		case <-timer.C:
		}
		//emptying triggerChan
		for len(triggerChan) > 0 {
			<-triggerChan
		}
	}
}

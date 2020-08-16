package main

import (
	"database/sql"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

func updateIter(db *sql.DB, session *Session, updatedReceiptIDsChan chan int64) error {
	if err := updateSessionIfOld(session); err != nil {
		return merry.Wrap(err)
	}

	receipts, err := loadPendingReceipts(db, 5)
	if err != nil {
		return merry.Wrap(err)
	}

	for _, rec := range receipts {
		log.Info().Str("ref_text", rec.RefText).Msg("fetching receipt")

		data, err := fnsFetchReceipt(rec.RefText, session.SessonID)

		if !rec.IsCorrect && merry.Is(err, ErrReceiptMaybeNotReadyYet) {
			if err := saveReceiptCorrectness(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
			updatedReceiptIDsChan <- rec.ID
		}

		for i := 0; i < 3; i++ {
			if merry.Is(err, ErrWaitingForConnection) || merry.Is(err, ErrCashboxOffline) || merry.Is(err, ErrReceiptMaybeNotReadyYet) {
				log.Info().Int("iter", i+i).Msg("receipt seems not checked to FNS, waiting a bit more")
				time.Sleep(2 * time.Second)
				data, err = fnsFetchReceipt(rec.RefText, session.SessonID)
			} else {
				break
			}
		}

		if err != nil {
			log.Warn().Err(err).Str("ref_text", rec.RefText).Msg("receipt error")
			if err := saveReceiptFailure(db, &rec.Ref); err != nil {
				return merry.Wrap(err)
			}
			updatedReceiptIDsChan <- rec.ID
			continue
		}

		log.Info().Str("ref_text", rec.RefText).Msg("got receipt data")

		if err := saveRecieptData(db, &rec.Ref, data); err != nil {
			return merry.Wrap(err)
		}
		updatedReceiptIDsChan <- rec.ID
	}
	return nil
}

func StartUpdater(db *sql.DB, session *Session, triggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
	timer := time.NewTimer(200 * 365 * 24 * time.Hour) //timedelta can store ~292 years
	for {
		if err := updateIter(db, session, updatedReceiptIDsChan); err != nil {
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

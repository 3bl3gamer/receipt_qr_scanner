package ru_fns

import (
	"receipt_qr_scanner/receipts"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

type Client struct {
	session *Session
}

func (c *Client) InitSession(args ...string) error {
	if len(args) != 2 {
		return merry.Errorf("exactly two arguments (refreshToken and clientSecret) are required for session init, got %d", len(args))
	}
	refreshToken := args[0]
	clientSecret := args[1]
	session, err := initSession(refreshToken, clientSecret)
	if err != nil {
		return merry.Wrap(err)
	}
	c.session = session
	return nil
}

func (c *Client) LoadSession() error {
	session, err := loadSession()
	if err != nil {
		return merry.Wrap(err)
	}

	// Checking session
	updateSessionAndPrintProfile := func() error {
		if err := updateSessionIfOld(session); err != nil {
			return err
		}
		profile, err := fnsGetProfile(session.SessonID)
		if err == nil {
			log.Info().Str("phone", profile.Phone).Msg("ru-fns: profile")
		}
		return err
	}
	for i := 2; i >= 0; i-- {
		if err := updateSessionAndPrintProfile(); err != nil {
			if i > 0 && !merry.Is(err, receipts.ErrUnexpectedHttpStatus) {
				log.Warn().Err(err).Int("retries_left", i).Msg("ru-fns: can not get profile")
				time.Sleep(3 * time.Second)
				continue
			}
			return merry.Wrap(err)
		}
		break
	}

	c.session = session
	return nil
}

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	if c.session == nil {
		return res, merry.New("ru-fns: session is not ready")
	}

	var ref ReceiptRef
	switch r := iRef.(type) {
	case ReceiptRef:
		ref = r
	case *ReceiptRef:
		ref = *r
	default:
		return res, merry.Errorf("ru-fns: unexpected receipt ref %#T %s", iRef, iRef.String())
	}

	if err := updateSessionIfOld(c.session); err != nil {
		return res, merry.Wrap(err)
	}

	for iter := 0; ; iter++ {
		data, err := fnsFetchReceipt(ref.RefText(), c.session.SessonID)

		// isCorrect flag
		if merry.Is(err, ErrReceiptMaybeNotReadyYet) {
			if err := onIsCorrect(); err != nil {
				return res, merry.Wrap(err)
			}
		}

		// aborting loop
		if iter >= 3 {
			if err == nil {
				res.Data = data
				return res, nil
			} else {
				return res, merry.Wrap(err)
			}
		}

		// sleep + loop
		if merry.Is(err, ErrWaitingForConnection) || merry.Is(err, ErrCashboxOffline) || merry.Is(err, ErrReceiptMaybeNotReadyYet) {
			log.Info().Int("iter", iter+1).Msg("receipt seems not checked to FNS, waiting a bit more")
			time.Sleep(2 * time.Second)
		}
	}
}

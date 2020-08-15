package main

import (
	"database/sql"
	"time"

	"github.com/ansel1/merry"
	"github.com/mattn/go-sqlite3"
)

var ErrReceiptRefAlreadyExists = merry.New("receipt ref already exists")

func createTables(db *sql.DB) error {
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS receipts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

		fiscal_num INTEGER,
		fiscal_doc INTEGER,
		fiscal_sign INTEGER,
		kind INTEGER,
		summ FLOAT,
		created_at DATETIME,

		is_correct INTEGER,

		ref_text TEXT,
		data BLOB,

		retries_left INTEGER NOT NULL DEFAULT 10,
		next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP,

		UNIQUE(fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at)
	)`)
	return merry.Wrap(err)
}

func setupDB(configDir string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", configDir+"/main.db")
	if err != nil {
		return nil, merry.Wrap(err)
	}

	if err := createTables(db); err != nil {
		db.Close()
		return nil, merry.Wrap(err)
	}
	return db, nil
}

func saveRecieptRef(db *sql.DB, ref *ReceiptRef, refText string) (int64, error) {
	res, err := db.Exec(`
		INSERT INTO receipts (ref_text, fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at)
		VALUES (?,?,?,?,?,?,?)`,
		refText, ref.FiscalNum, ref.FiscalDoc, ref.FiscalSign, ref.Kind, ref.Summ, ref.CreatedAt)
	if sqlite3Error, ok := err.(sqlite3.Error); ok {
		if sqlite3Error.ExtendedCode == sqlite3.ErrConstraintUnique {
			return 0, ErrReceiptRefAlreadyExists.Here()
		}
	}
	if err != nil {
		return 0, merry.Wrap(err)
	}
	rowID, err := res.LastInsertId()
	if err != nil {
		return 0, merry.Wrap(err)
	}
	return rowID, nil
}

func saveReceiptFailure(db *sql.DB, ref *ReceiptRef) error {
	_, err := db.Exec(`
		UPDATE receipts
		SET next_retry_at = datetime(CURRENT_TIMESTAMP, '+'||((1-retries_left%2)*30 + (retries_left%2)*20*3600)||' seconds'),
		    retries_left = MAX(0, retries_left-1)
		WHERE (fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at) = (?,?,?,?,?,?)`,
		ref.FiscalNum, ref.FiscalDoc, ref.FiscalSign, ref.Kind, ref.Summ, ref.CreatedAt)
	return merry.Wrap(err)
}

func saveReceiptCorrectness(db *sql.DB, ref *ReceiptRef) error {
	_, err := db.Exec(`
		UPDATE receipts SET is_correct = 1
		WHERE (fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at) = (?,?,?,?,?,?)`,
		ref.FiscalNum, ref.FiscalDoc, ref.FiscalSign, ref.Kind, ref.Summ, ref.CreatedAt)
	return merry.Wrap(err)
}

func saveRecieptData(db *sql.DB, ref *ReceiptRef, data []byte) error {
	_, err := db.Exec(`
		UPDATE receipts SET is_correct = 1, data = ?
		WHERE (fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at) = (?,?,?,?,?,?)`,
		data, ref.FiscalNum, ref.FiscalDoc, ref.FiscalSign, ref.Kind, ref.Summ, ref.CreatedAt)
	return merry.Wrap(err)
}

func loadPendingReceipts(db *sql.DB, limit int64) ([]*Receipt, error) {
	rows, err := db.Query(`
		SELECT id, ref_text, fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at, COALESCE(is_correct, 0)
		FROM receipts
		WHERE (is_correct IS NULL OR data IS NULL)
		  AND next_retry_at <= CURRENT_TIMESTAMP
		  AND retries_left > 0
		ORDER BY next_retry_at
		LIMIT ?`, limit)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var recs []*Receipt
	for rows.Next() {
		rec := &Receipt{}
		err = rows.Scan(&rec.ID, &rec.RefText,
			&rec.Ref.FiscalNum, &rec.Ref.FiscalDoc, &rec.Ref.FiscalSign,
			&rec.Ref.Kind, &rec.Ref.Summ, &rec.Ref.CreatedAt, &rec.IsCorrect)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		recs = append(recs, rec)
	}
	err = rows.Err()
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return recs, nil
}

func loadNextRetryTime(db *sql.DB) (time.Time, error) {
	var nextRetryAt time.Time
	err := db.QueryRow(`
		SELECT next_retry_at FROM receipts
		WHERE data IS NULL AND retries_left > 0
		ORDER BY next_retry_at`).Scan(&nextRetryAt)
	if err == sql.ErrNoRows {
		return time.Date(2200, 12, 31, 23, 59, 59, 0, time.UTC), nil //timedelta can store ~292 years
	}
	if err != nil {
		return time.Time{}, merry.Wrap(err)
	}
	return nextRetryAt, nil
}

type SQLMultiScanner interface {
	Scan(...interface{}) error
}

const receiptSQLFields = `id, saved_at, updated_at,
fiscal_num, fiscal_doc, fiscal_sign, kind, summ, created_at,
COALESCE(is_correct, FALSE), ref_text, CAST(COALESCE(data, '') AS text),
retries_left, next_retry_at`

func scanReceipt(row SQLMultiScanner, rec *Receipt) error {
	err := row.Scan(
		&rec.ID, &rec.SavedAt, &rec.UpdatedAt,
		&rec.Ref.FiscalNum, &rec.Ref.FiscalDoc, &rec.Ref.FiscalSign,
		&rec.Ref.Kind, &rec.Ref.Summ, &rec.Ref.CreatedAt,
		&rec.IsCorrect, &rec.RefText, &rec.Data,
		&rec.RetriesLeft, &rec.NextRetryAt)
	return merry.Wrap(err)
}

func loadReceipt(db *sql.DB, id int64) (*Receipt, error) {
	row := db.QueryRow(`SELECT `+receiptSQLFields+` FROM receipts WHERE id = ?`, id)
	rec := &Receipt{}
	err := scanReceipt(row, rec)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return rec, nil
}

func loadUpdatedReceipts(db *sql.DB, timeFrom time.Time) ([]*Receipt, error) {
	rows, err := db.Query(`
		SELECT `+receiptSQLFields+`
		FROM receipts
		WHERE updated_at > ?
		ORDER BY saved_at`, timeFrom)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var recs []*Receipt
	for rows.Next() {
		rec := &Receipt{}
		err = scanReceipt(rows, rec)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		recs = append(recs, rec)
	}
	err = rows.Err()
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return recs, nil
}

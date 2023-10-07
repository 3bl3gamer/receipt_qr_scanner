package main

import (
	"database/sql"
	"encoding/json"
	"receipt_qr_scanner/utils"
	"strconv"
	"strings"
	"time"

	"github.com/ansel1/merry"
	"github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog/log"
)

var ErrReceiptRefAlreadyExists = merry.New("receipt ref already exists")

type ReceiptPending struct {
	ID        int64
	Ref       utils.ReceiptRef
	IsCorrect bool
}

var migrations = []func(*sql.Tx) error{
	func(tx *sql.Tx) error {
		_, err := tx.Exec(`
		CREATE TABLE migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			version INTEGER NOT NULL,
			migrated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`)
		return merry.Wrap(err)
	},
	func(tx *sql.Tx) error {
		_, err := tx.Exec(`
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
	},
	func(tx *sql.Tx) error {
		_, err := tx.Exec(`ALTER TABLE receipts ADD COLUMN search_key TEXT NOT NULL DEFAULT '<pending>'`)
		if err != nil {
			return merry.Wrap(err)
		}
		/* [REDACTED] */
		return nil
	},
	func(tx *sql.Tx) error {
		nullsCount := -1
		err := tx.QueryRow(`
		SELECT count(*) FROM receipts WHERE
			fiscal_num IS NULL OR
			fiscal_doc IS NULL OR
			fiscal_sign IS NULL OR
			kind IS NULL OR
			summ IS NULL OR
			created_at IS NULL OR`).Scan(&nullsCount)
		if err != nil && err != sql.ErrNoRows && err.Error() != "no such table: migrations" {
			merry.Wrap(err)
		}
		if nullsCount > 0 {
			return merry.Errorf("%d row(s) has NULL values in unique key", nullsCount)
		}

		_, err = tx.Exec(`ALTER TABLE receipts RENAME TO receipts_old`)
		if err != nil {
			return merry.Wrap(err)
		}
		_, err = tx.Exec(`
		CREATE TABLE receipts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT NOT NULL,

			saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at DATETIME NOT NULL,

			unique_key TEXT NOT NULL,
			search_key TEXT NOT NULL DEFAULT '<pending>',

			is_correct INTEGER,

			ref_text TEXT NOT NULL,
			data BLOB,

			retries_left INTEGER NOT NULL DEFAULT 10,
			next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`)
		if err != nil {
			return merry.Wrap(err)
		}

		_, err = tx.Exec(`
		INSERT INTO receipts (
			id, domain, saved_at, updated_at, created_at,
			unique_key, search_key, is_correct,
			ref_text, data,
			retries_left, next_retry_at
		)
		SELECT id, 'ru-fns', saved_at, updated_at, created_at,
			'TODO:'||id, search_key, is_correct,
			ref_text, data,
			retries_left, next_retry_at
		FROM receipts_old`)
		if err != nil {
			return merry.Wrap(err)
		}

		_, err = tx.Exec(`DROP TABLE receipts_old`)
		if err != nil {
			return merry.Wrap(err)
		}

		rows, err := tx.Query(`SELECT id, domain, ref_text FROM receipts`)
		if err != nil {
			return merry.Wrap(err)
		}
		for rows.Next() {
			var id int64
			var refText string
			err := rows.Scan(&id, &refText)
			if err != nil {
				return merry.Wrap(err)
			}
			ref, err := receiptRefFromText(refText)
			if err != nil {
				return merry.Wrap(err)
			}
			_, err = tx.Exec(`UPDATE receipts SET unique_key = ? WHERE id = ?`, ref.UniqueKey(), id)
			if err != nil {
				return merry.Wrap(err)
			}
		}
		if err := rows.Err(); err != nil {
			return merry.Wrap(err)
		}
		return nil
	},
}

func createTables(db *sql.DB) error {
	lastVersion := -1
	err := db.QueryRow(`SELECT version FROM migrations ORDER BY migrated_at DESC, id DESC LIMIT 1`).Scan(&lastVersion)
	if err != nil && err != sql.ErrNoRows && err.Error() != "no such table: migrations" {
		merry.Wrap(err)
	}
	for version := lastVersion + 1; version < len(migrations); version += 1 {
		tx, err := db.Begin()
		if err != nil {
			return merry.Wrap(err)
		}
		if err := migrations[version](tx); err != nil {
			tx.Rollback()
			return merry.Wrap(err)
		}
		if _, err := tx.Exec(`INSERT INTO migrations (version) VALUES (?)`, version); err != nil {
			tx.Rollback()
			return merry.Wrap(err)
		}
		if err := tx.Commit(); err != nil {
			tx.Rollback()
			return merry.Wrap(err)
		}
		log.Info().Int("version", version).Msg("migrated DB")
	}
	return nil
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

func makeReceiptSearchKeyInner(valPrefix string, obj interface{}, items *[]string) {
	switch obj := obj.(type) {
	case map[string]interface{}:
		for k, v := range obj {
			if k != "rawData" && //бесполезный для поиска base64
				k != "qr" && //данные из QR-кода (иногда бывает)
				k != "logo" { //путь к картинке (/static/logo/<...>.png, иногда бывает)
				makeReceiptSearchKeyInner(k+":", v, items)
			}
		}
	case []interface{}:
		for _, v := range obj {
			makeReceiptSearchKeyInner("", v, items)
		}
	case string:
		*items = append(*items, valPrefix+strings.TrimSpace(obj))
	case float64:
		*items = append(*items, valPrefix+strconv.FormatFloat(obj, 'f', -1, 64))
	case bool:
		v := "false"
		if obj == true {
			v = "true"
		}
		*items = append(*items, valPrefix+v)
	default:
		log.Fatal().Interface("item", obj).Msg("unexpected JSON item")
	}
}
func makeReceiptSearchKey(ref utils.ReceiptRef, dataStr string) (string, error) {
	items, err := ref.SearchKeyItems()
	if err != nil {
		return "", merry.Wrap(err)
	}
	if dataStr != "" {
		var data interface{}
		if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
			return "", merry.Wrap(err)
		}
		makeReceiptSearchKeyInner("", data, &items)
	}
	return strings.ToLower(strings.Join(items, " ")), nil
}

func escapeLike(str, escChar string) string {
	str = strings.Replace(str, escChar, escChar+escChar, -1)
	str = strings.Replace(str, "%", escChar+"%", -1)
	str = strings.Replace(str, "_", escChar+"_", -1)
	return str
}

func saveRecieptRef(db *sql.DB, ref utils.ReceiptRef) (int64, error) {
	searchKey, err := makeReceiptSearchKey(ref, "")
	if err != nil {
		return 0, merry.Wrap(err)
	}
	createdAt, err := ref.CreatedAt()
	if err != nil {
		return 0, merry.Wrap(err)
	}
	res, err := db.Exec(`
		INSERT INTO receipts (domain, unique_key, ref_text, created_at, search_key)
		VALUES (?,?,?,?,?)`,
		ref.Domain(), ref.UniqueKey(), ref.RefText(), createdAt, searchKey)
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

func saveReceiptFailure(db *sql.DB, ref utils.ReceiptRef, decreaseRetries bool) error {
	_, err := db.Exec(`
		UPDATE receipts
		SET next_retry_at = datetime(CURRENT_TIMESTAMP,
		        '+' || ((1-retries_left%2)*30 + (retries_left%2 | not ?)*20*3600) || ' seconds'),
		    retries_left = CASE ? WHEN true THEN MAX(0, retries_left-1) ELSE retries_left END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE unique_key = ?`,
		decreaseRetries, decreaseRetries,
		ref.UniqueKey())
	return merry.Wrap(err)
}

func saveReceiptCorrectness(db *sql.DB, ref utils.ReceiptRef) error {
	_, err := db.Exec(`
		UPDATE receipts SET is_correct = 1, updated_at = CURRENT_TIMESTAMP
		WHERE unique_key = ?`,
		ref.UniqueKey())
	return merry.Wrap(err)
}

func saveRecieptData(db *sql.DB, ref utils.ReceiptRef, data []byte) error {
	searchKey, err := makeReceiptSearchKey(ref, string(data))
	if err != nil {
		return merry.Wrap(err)
	}
	_, err = db.Exec(`
		UPDATE receipts SET is_correct = 1, data = ?, search_key = ?, updated_at = CURRENT_TIMESTAMP
		WHERE unique_key = ?`,
		data, searchKey,
		ref.UniqueKey())
	return merry.Wrap(err)
}

func loadPendingReceipts(db *sql.DB, limit int64) ([]*ReceiptPending, error) {
	rows, err := db.Query(`
		SELECT id, ref_text, COALESCE(is_correct, 0)
		FROM receipts
		WHERE (is_correct IS NULL OR data IS NULL)
		  AND next_retry_at <= CURRENT_TIMESTAMP
		  AND retries_left > 0
		ORDER BY next_retry_at
		LIMIT ?`, limit)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var recs []*ReceiptPending
	for rows.Next() {
		rec := &ReceiptPending{}
		var refText string
		err = rows.Scan(&rec.ID, &refText, &rec.IsCorrect)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		rec.Ref, err = receiptRefFromText(refText)
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

const receiptSQLFields = `id, saved_at, updated_at, created_at, search_key,
COALESCE(is_correct, FALSE), ref_text, CAST(COALESCE(data, '') AS text),
retries_left, next_retry_at`

func scanReceipt(row SQLMultiScanner, rec *utils.Receipt) error {
	err := row.Scan(
		&rec.ID, &rec.SavedAt, &rec.UpdatedAt, &rec.CreatedAt, &rec.SearchKey,
		&rec.IsCorrect, &rec.RefText, &rec.Data,
		&rec.RetriesLeft, &rec.NextRetryAt)
	return merry.Wrap(err)
}

func loadReceipt(db *sql.DB, id int64) (*utils.Receipt, error) {
	row := db.QueryRow(`SELECT `+receiptSQLFields+` FROM receipts WHERE id = ?`, id)
	rec := &utils.Receipt{}
	err := scanReceipt(row, rec)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return rec, nil
}

func readReceiptsFromRows(rows *sql.Rows) ([]*utils.Receipt, error) {
	var recs []*utils.Receipt
	for rows.Next() {
		rec := &utils.Receipt{}
		if err := scanReceipt(rows, rec); err != nil {
			return nil, merry.Wrap(err)
		}
		recs = append(recs, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, merry.Wrap(err)
	}
	return recs, nil
}

func searchAndReadReceipts(db *sql.DB, filter []string, args []interface{}, searchQuery, sortColumn string) ([]*utils.Receipt, error) {
	sql := `SELECT ` + receiptSQLFields + ` FROM receipts`
	if searchQuery != "" {
		filter = append(filter, `search_key LIKE ? ESCAPE '\'`)
		args = append(args, "%"+escapeLike(searchQuery, `\`)+"%")
	}
	if len(filter) > 0 {
		sql += " WHERE " + strings.Join(filter, " AND ")
	}
	sql += " ORDER BY " + sortColumn + " DESC LIMIT 25"
	rows, err := db.Query(sql, args...)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return readReceiptsFromRows(rows)
}

func loadReceiptsSortedByID(db *sql.DB, beforeID int64, searchQuery string) ([]*utils.Receipt, error) {
	args := []interface{}{}
	filter := []string{}
	if beforeID > 0 {
		filter = append(filter, "id < ?")
		args = append(args, beforeID)
	}
	return searchAndReadReceipts(db, filter, args, searchQuery, "id")
}

func loadReceiptsSortedByCreatedAt(db *sql.DB, beforeTime time.Time, searchQuery string) ([]*utils.Receipt, error) {
	args := []interface{}{}
	filter := []string{}
	if !beforeTime.IsZero() {
		filter = append(filter, "created_at < ?")
		args = append(args, beforeTime)
	}
	return searchAndReadReceipts(db, filter, args, searchQuery, "created_at")
}

package main

import (
	"database/sql"
	"os"

	"github.com/ansel1/merry"
)

type Env struct {
	Val string
}

func (e *Env) Set(name string) error {
	if name != "dev" && name != "prod" {
		return merry.New("wrong env: " + name)
	}
	e.Val = name
	return nil
}

func (e Env) String() string {
	return e.Val
}

func (e Env) Type() string {
	return "string"
}

func (e Env) IsDev() bool {
	return e.Val == "dev"
}

func (e Env) IsProd() bool {
	return e.Val == "prod"
}

func MakeConfigDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", merry.Wrap(err)
	}
	dir = dir + "/receipt_qr_scanner"
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", merry.Wrap(err)
	}
	return dir, nil
}

func SetupDB(configDir string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", configDir+"/main.db")
	if err != nil {
		return nil, merry.Wrap(err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS receipts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			fiscal_num INTEGER,
			fiscal_doc INTEGER,
			fiscal_sign INTEGER,
			kind INTEGER,
			created_at DATETIME,

			ref_text TEXT,
			data blob,

			retries_left INTEGER NOT NULL DEFAULT 10,
			next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			UNIQUE(fiscal_num, fiscal_doc, fiscal_sign, kind, created_at)
		)`)
	if err != nil {
		db.Close()
		return nil, merry.Wrap(err)
	}
	return db, nil
}

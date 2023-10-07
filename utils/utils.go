package utils

import (
	"os"
	"strconv"

	"github.com/ansel1/merry"
)

type Env struct {
	Val string
}

func (e *Env) Set(name string) error {
	if name != "dev" && name != "prod" {
		return merry.New("must be 'dev' or 'prod'")
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

func itoa(val int64) string {
	return strconv.FormatInt(val, 10)
}

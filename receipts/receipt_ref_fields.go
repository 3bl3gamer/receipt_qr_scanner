package receipts

import (
	"net/url"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
)

type ReceiptRefFieldErr struct {
	Name      string
	ValueStr  string
	IsMissing bool
}

func (e ReceiptRefFieldErr) Error() string {
	var s string
	if e.IsMissing {
		s = "missing"
	} else {
		s = "wrong"
	}
	s += " " + e.Name
	if e.ValueStr != "" {
		s += "=" + e.ValueStr
	}
	return s
}

func ReadString(values url.Values, name string) (string, error) {
	if _, ok := values[name]; !ok {
		return "", ReceiptRefFieldErr{Name: name, ValueStr: "", IsMissing: true}
	}
	return values.Get(name), nil
}

func ReadInt64(values url.Values, name string) (int64, error) {
	valueStr, jsonErr := ReadString(values, name)
	if jsonErr != nil {
		return 0, jsonErr
	}
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		return 0, ReceiptRefFieldErr{Name: name, ValueStr: valueStr}
	}
	return value, nil
}

func ReadFloat64(values url.Values, name string) (float64, error) {
	valueStr, jsonErr := ReadString(values, name)
	if jsonErr != nil {
		return 0, jsonErr
	}
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return 0, ReceiptRefFieldErr{Name: name, ValueStr: valueStr}
	}
	return value, nil
}

func ReadTime(values url.Values, name string) (time.Time, error) {
	valueStr, jsonErr := ReadString(values, name)
	if jsonErr != nil {
		return time.Time{}, jsonErr
	}
	value, err := time.Parse("20060102T150405", valueStr)
	if err != nil {
		value, err = time.Parse("20060102T1504", valueStr)
	}
	if err != nil {
		log.Debug().Str("name", name).Str("value", valueStr).Err(err).Msg("wrong value")
		return time.Time{}, ReceiptRefFieldErr{Name: name, ValueStr: valueStr}
	}
	return value, nil
}

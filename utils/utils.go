package utils

import (
	"os"
	"slices"
	"strings"

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

// OptionValue validates and stores a single value from a set of allowed options
type OptionValue[T any] struct {
	Options []T
	ToStr   func(T) string
	Value   *T
}

func (o *OptionValue[T]) Set(value string) error {
	for i, option := range o.Options {
		if o.ToStr(option) == value {
			o.Value = &o.Options[i]
			return nil
		}
	}
	return merry.Errorf("must be one of: %s", o.JoinStrings(", "))
}

func (o OptionValue[T]) String() string {
	if o.Value == nil {
		return ""
	}
	return o.ToStr(*o.Value)
}

func (o OptionValue[T]) JoinStrings(sep string) string {
	optionStrs := make([]string, len(o.Options))
	for i, option := range o.Options {
		optionStrs[i] = o.ToStr(option)
	}
	return strings.Join(optionStrs, sep)
}

// OptionValues validates and stores multiple values from a set of allowed options
type OptionValues[T any] struct {
	Options   []T
	ToStr     func(T) string
	Separator string
	Values    []T
}

func (o *OptionValues[T]) Set(value string) error {
	parts := strings.Split(value, o.Separator)

	optionStrs := make([]string, len(o.Options))
	for i, option := range o.Options {
		optionStrs[i] = o.ToStr(option)
	}

	values := make([]T, len(parts))
	for partI, part := range parts {
		if optI := slices.Index(optionStrs, part); optI == -1 {
			return merry.Errorf("'%s' must be one of: %s", part, o.JoinStrings(", "))
		} else {
			values[partI] = o.Options[optI]
		}
	}
	o.Values = values
	return nil
}

func (o *OptionValues[T]) String() string {
	strs := make([]string, len(o.Values))
	for i, v := range o.Values {
		strs[i] = o.ToStr(v)
	}
	return strings.Join(strs, o.Separator)
}

func (o OptionValues[T]) JoinStrings(sep string) string {
	optionStrs := make([]string, len(o.Options))
	for i, option := range o.Options {
		optionStrs[i] = o.ToStr(option)
	}
	return strings.Join(optionStrs, sep)
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

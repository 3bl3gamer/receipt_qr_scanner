package receipts

import (
	"errors"
	"time"

	"github.com/ansel1/merry"
)

type Domain struct {
	Code            string
	CurrencySymbol  string
	FlagSymbol      string
	Provider        Provider
	ParseReceiptRef func(refText string) (ReceiptRef, error)
	NewClient       func() Client
}

type Provider struct {
	// название сервиса, с котрого скачиваются чеки (оператор фискальных данных или сервис-прослойка)
	Name string
	// короткий (желательно однобуквенный) лейбл провадера,
	// чтоб отличать разных провайдеров одной страны (будет выводить рядом с флагом)
	ShortLabel string
	// цвет провайдера, #RRGGBB, в основном для ShortLabel
	Color string
}

type ReceiptRef interface {
	String() string
	Domain() Domain
	RefText() string
	UniqueKey() string
	CreatedAt() time.Time
	Sum() float64
	SearchKeyItems() []string
}

type Receipt struct {
	ID          int64     `json:"id"`
	Domain      string    `json:"domain"`
	SavedAt     time.Time `json:"savedAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	CreatedAt   time.Time `json:"createdAt"`
	RefText     string    `json:"refText"`
	IsCorrect   bool      `json:"isCorrect"`
	Data        string    `json:"data"`
	SearchKey   string    `json:"searchKey"`
	RetriesLeft int64     `json:"retriesLeft"`
	NextRetryAt time.Time `json:"nextRetryAt"`
}

func ReceiptRefFromText(domains []Domain, refText string) (ReceiptRef, error) {
	var errs []error
	for _, d := range domains {
		ref, err := d.ParseReceiptRef(refText)
		if err == nil {
			return ref, nil
		}
		errs = append(errs, err)
	}
	return nil, errors.Join(errs...)
}

// CasetReceiptRefTo кастует iRef в T
// (обычно — интерфейс receipts.ReceiptRef в конкретный например ru_fns.ReceiptRef),
// дереференсит при необходимости.
func CasetReceiptRefTo[T ReceiptRef](iRef any, domainCode string) (T, error) {
	var zero T
	switch r := iRef.(type) {
	case T:
		return r, nil
	case *T:
		return *r, nil
	default:
		return zero, merry.Errorf("%s: unexpected receipt ref %#T %s", domainCode, iRef, iRef)
	}
}

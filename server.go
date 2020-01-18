package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	httputils "github.com/3bl3gamer/go-http-utils"
	"github.com/ansel1/merry"
	"github.com/julienschmidt/httprouter"
	"github.com/rs/zerolog/log"
)

type ctxKey string

const CtxKeyEnv = ctxKey("env")
const CtxKeyDB = ctxKey("db")
const CtxKeyTrigger = ctxKey("trigger")

func receiptString(values url.Values, name string) (string, *httputils.JsonError) {
	if _, ok := values[name]; !ok {
		return "", &httputils.JsonError{Code: 400, Error: "MISSING_VALUE_" + strings.ToUpper(name)}
	}
	return values.Get(name), nil
}

func receiptInt64(values url.Values, name string) (int64, *httputils.JsonError) {
	valueStr, jsonErr := receiptString(values, name)
	if jsonErr != nil {
		return 0, jsonErr
	}
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		return 0, &httputils.JsonError{Code: 400, Error: "WRONG_VALUE_" + strings.ToUpper(name), Description: valueStr}
	}
	return value, nil
}

func receiptFloat64(values url.Values, name string) (float64, *httputils.JsonError) {
	valueStr, jsonErr := receiptString(values, name)
	if jsonErr != nil {
		return 0, jsonErr
	}
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return 0, &httputils.JsonError{Code: 400, Error: "WRONG_VALUE_" + strings.ToUpper(name), Description: valueStr}
	}
	return value, nil
}

func receiptTime(values url.Values, name string) (time.Time, *httputils.JsonError) {
	valueStr, jsonErr := receiptString(values, name)
	if jsonErr != nil {
		return time.Time{}, jsonErr
	}
	value, err := time.Parse("20060102T150405", valueStr)
	if err != nil {
		value, err = time.Parse("20060102T1504", valueStr)
	}
	if err != nil {
		log.Debug().Str("name", name).Str("value", valueStr).Err(err).Msg("wrong value")
		return time.Time{}, &httputils.JsonError{Code: 400, Error: "WRONG_VALUE_" + strings.ToUpper(name), Description: valueStr}
	}
	return value, nil
}

func HandleIndex(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (httputils.TemplateCtx, error) {
	return map[string]interface{}{"FPath": "index.html", "Block": "index.html"}, nil
}

func HandleAPIReceipt(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (interface{}, error) {
	buf, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	text := string(buf)

	values, err := url.ParseQuery(text)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	fmt.Println(text, values)
	var jsonErr *httputils.JsonError
	var ref ReceiptRef
	ref.FiscalNum, jsonErr = receiptInt64(values, "fn")
	if jsonErr != nil {
		return jsonErr, nil
	}
	ref.FiscalDoc, jsonErr = receiptInt64(values, "i")
	if jsonErr != nil {
		return jsonErr, nil
	}
	ref.FiscalSign, jsonErr = receiptInt64(values, "fp")
	if jsonErr != nil {
		return jsonErr, nil
	}
	ref.Kind, jsonErr = receiptInt64(values, "n")
	if jsonErr != nil {
		return jsonErr, nil
	}
	ref.Summ, jsonErr = receiptFloat64(values, "s")
	if jsonErr != nil {
		return jsonErr, nil
	}
	ref.CreatedAt, jsonErr = receiptTime(values, "t")
	if jsonErr != nil {
		return jsonErr, nil
	}

	db := r.Context().Value(CtxKeyDB).(*sql.DB)
	err = saveRecieptRef(db, &ref, text)
	if merry.Is(err, ErrReceiptRefAlreadyExists) {
		return httputils.JsonError{Code: 400, Error: "ALREADY_EXISTS"}, nil
	} else if err != nil {
		return nil, merry.Wrap(err)
	}

	updaterTriggerChan := r.Context().Value(CtxKeyTrigger).(chan struct{})
	updaterTriggerChan <- struct{}{}
	return "ok", nil
}

func StartHTTPServer(db *sql.DB, env Env, address string, updaterTriggerChan chan struct{}) error {
	ex, err := os.Executable()
	if err != nil {
		return merry.Wrap(err)
	}
	baseDir := filepath.Dir(ex)

	var bundleFPath, stylesFPath string

	// Config
	wrapper := &httputils.Wrapper{
		ShowErrorDetails: env.IsDev(),
		ExtraChainItem: func(handle httputils.HandlerExt) httputils.HandlerExt {
			return func(wr http.ResponseWriter, r *http.Request, params httprouter.Params) error {
				log.Debug().Str("method", r.Method).Str("path", r.URL.Path).Msg("request")
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyEnv, env))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyDB, db))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyTrigger, updaterTriggerChan))
				return merry.Wrap(handle(wr, r, params))
			}
		},
		TemplateHandler: &httputils.TemplateHandler{
			CacheParsed: env.IsProd(),
			BasePath:    baseDir + "/www/templates",
			ParamsFunc: func(r *http.Request, ctx *httputils.MainCtx, params httputils.TemplateCtx) error {
				params["BundleFPath"] = bundleFPath
				params["StylesFPath"] = stylesFPath
				return nil
			},
			LogBuild: func(path string) { log.Info().Str("path", path).Msg("building template") },
		},
		LogError: func(err error, r *http.Request) {
			log.Error().Stack().Err(err).Str("method", r.Method).Str("path", r.URL.Path).Msg("")
		},
	}

	router := httprouter.New()
	route := func(method, path string, chain ...interface{}) {
		router.Handle(method, path, wrapper.WrapChain(chain...))
	}

	// Routes
	route("GET", "/", HandleIndex)
	route("POST", "/api/receipt", HandleAPIReceipt)

	route("GET", "/api/explode", func(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (interface{}, error) {
		return nil, merry.New("test API error")
	})
	route("GET", "/explode", func(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) error {
		return merry.New("test error")
	})

	if env.IsDev() {
		devServerAddress, err := httputils.RunBundleDevServerNear(address, baseDir+"/www", "--configHost", "--configPort")
		if err != nil {
			return merry.Wrap(err)
		}
		bundleFPath = "http://" + devServerAddress + "/bundle.js"
		stylesFPath = "http://" + devServerAddress + "/bundle.css"
	} else {
		distPath := baseDir + "/www/dist"
		// bundleFPath, stylesFPath, err = httputils.LastJSAndCSSFNames(distPath, "bundle.", "bundle.")
		bundleFPath, err = httputils.LastBundleFName(distPath, "bundle.", ".js")
		if err != nil {
			return merry.Wrap(err)
		}
		if err != nil {
			return merry.Wrap(err)
		}
		bundleFPath = "/dist/" + bundleFPath
		stylesFPath = "/dist/" + stylesFPath
		router.ServeFiles("/dist/*filepath", http.Dir(distPath))
	}
	log.Info().Str("fpath", bundleFPath).Msg("bundle")
	log.Info().Str("fpath", stylesFPath).Msg("styles")

	// Server
	log.Info().Msg("starting server on " + address)
	return merry.Wrap(http.ListenAndServe(address, router))
}

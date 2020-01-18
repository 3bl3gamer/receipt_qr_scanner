package main

import (
	"context"
	"database/sql"
	"flag"
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
	"github.com/mattn/go-sqlite3"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type ctxKey string

const CtxKeyEnv = ctxKey("env")
const CtxKeyDB = ctxKey("db")

// func atoi(str string) (int64, error) {
// 	return strconv.ParseInt(str, 10, 64)
// }

func receiptInt64(values url.Values, name string) (int64, *httputils.JsonError) {
	upperName := strings.ToUpper(name)
	if _, ok := values[name]; !ok {
		return 0, &httputils.JsonError{Code: 400, Error: "MISSING_VALUE_" + upperName}
	}
	valueStr := values.Get(name)
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		return 0, &httputils.JsonError{Code: 400, Error: "WRONG_VALUE_" + upperName, Description: valueStr}
	}
	return value, nil
}

func receiptTime(values url.Values, name string) (time.Time, *httputils.JsonError) {
	upperName := strings.ToUpper(name)
	if _, ok := values[name]; !ok {
		return time.Time{}, &httputils.JsonError{Code: 400, Error: "MISSING_VALUE_" + upperName}
	}
	valueStr := values.Get(name)
	value, err := time.Parse("20060102T150405", valueStr)
	if err != nil {
		return time.Time{}, &httputils.JsonError{Code: 400, Error: "WRONG_VALUE_" + upperName, Description: valueStr}
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
	fiscalNum, jsonErr := receiptInt64(values, "fn")
	if jsonErr != nil {
		return jsonErr, nil
	}
	fiscalDoc, jsonErr := receiptInt64(values, "i")
	if jsonErr != nil {
		return jsonErr, nil
	}
	fiscalSign, jsonErr := receiptInt64(values, "fp")
	if jsonErr != nil {
		return jsonErr, nil
	}
	kind, jsonErr := receiptInt64(values, "n")
	if jsonErr != nil {
		return jsonErr, nil
	}
	createdAt, jsonErr := receiptTime(values, "t")
	if jsonErr != nil {
		return jsonErr, nil
	}

	db := r.Context().Value(CtxKeyDB).(*sql.DB)
	_, err = db.Exec(`
		INSERT INTO receipts (ref_text, fiscal_num, fiscal_doc, fiscal_sign, kind, created_at)
		VALUES (?,?,?,?,?,?)`, text, fiscalNum, fiscalDoc, fiscalSign, kind, createdAt)
	if sqlite3Error, ok := err.(sqlite3.Error); ok {
		if sqlite3Error.ExtendedCode == sqlite3.ErrConstraintUnique {
			return httputils.JsonError{Code: 400, Error: "ALREADY_EXISTS"}, nil
		}
	}
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return "ok", nil
}

func StartHTTPServer(address string, env Env) error {
	ex, err := os.Executable()
	if err != nil {
		return merry.Wrap(err)
	}
	baseDir := filepath.Dir(ex)

	cfgDir, err := MakeConfigDir()
	if err != nil {
		return merry.Wrap(err)
	}

	db, err := SetupDB(cfgDir)
	if err != nil {
		return merry.Wrap(err)
	}
	defer db.Close()

	var bundleFPath, stylesFPath string

	// Config
	wrapper := &httputils.Wrapper{
		ShowErrorDetails: env.IsDev(),
		ExtraChainItem: func(handle httputils.HandlerExt) httputils.HandlerExt {
			return func(wr http.ResponseWriter, r *http.Request, params httprouter.Params) error {
				log.Debug().Str("method", r.Method).Str("path", r.URL.Path).Msg("request")
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyEnv, env))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyDB, db))
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
		bundleFPath, stylesFPath, err = httputils.LastJSAndCSSFNames(distPath, "bundle.", "bundle.")
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

func main() {
	var env Env
	var serverAddr string
	flag.Var(&env, "env", "evironment, dev or prod")
	flag.StringVar(&serverAddr, "addr", "127.0.0.1:9010", "HTTP server address:port")
	flag.Parse()

	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.ErrorStackMarshaler = func(err error) interface{} { return merry.Details(err) }
	zerolog.ErrorStackFieldName = "message" //TODO: https://github.com/rs/zerolog/issues/157
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "2006-01-02 15:04:05.000"})

	if err := StartHTTPServer(serverAddr, env); err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
}

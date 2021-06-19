package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
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
const CtxKeyUpdateRec = ctxKey("updateRec")

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
	log.Debug().Str("text", text).Msg("receipt ref text")

	values, err := url.ParseQuery(text)
	if err != nil {
		return nil, merry.Wrap(err)
	}
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
	recID, err := saveRecieptRef(db, &ref, text)
	if merry.Is(err, ErrReceiptRefAlreadyExists) {
		return httputils.JsonError{Code: 400, Error: "ALREADY_EXISTS"}, nil
	} else if err != nil {
		return nil, merry.Wrap(err)
	}

	updaterTriggerChan := r.Context().Value(CtxKeyTrigger).(chan struct{})
	updaterTriggerChan <- struct{}{}
	updatedReceiptIDsChan := r.Context().Value(CtxKeyUpdateRec).(chan int64)
	updatedReceiptIDsChan <- recID
	return "ok", nil
}

type ReceiptsBroadcaster struct {
	InReceiptsChan chan *Receipt
	clients        map[chan *Receipt]struct{}
	mutex          sync.RWMutex
}

func NewReceiptsBroadcaster() *ReceiptsBroadcaster {
	b := &ReceiptsBroadcaster{
		InReceiptsChan: make(chan *Receipt, 10),
		clients:        make(map[chan *Receipt]struct{}),
	}
	go func() {
		for rec := range b.InReceiptsChan {
			b.broadcast(rec)
		}
	}()
	return b
}

func (b *ReceiptsBroadcaster) AddClient() chan *Receipt {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	client := make(chan *Receipt, 10)
	b.clients[client] = struct{}{}
	return client
}

func (b *ReceiptsBroadcaster) RemoveClient(client chan *Receipt) {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	if _, ok := b.clients[client]; ok {
		close(client)
		delete(b.clients, client)
	}
}

func (b *ReceiptsBroadcaster) broadcast(rec *Receipt) {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	for client := range b.clients {
		client <- rec
	}
}

func writeSseJson(wr io.Writer, name string, obj interface{}) error {
	if _, err := wr.Write([]byte("event: " + name + "\ndata: ")); err != nil {
		return merry.Wrap(err)
	}
	if err := json.NewEncoder(wr).Encode(obj); err != nil {
		return merry.Wrap(err)
	}
	if _, err := wr.Write([]byte("\n\n")); err != nil {
		return merry.Wrap(err)
	}
	return nil
}

var emptyReceipts = []*Receipt{}

func ensureRecsNotNil(receipts []*Receipt) []*Receipt {
	if receipts == nil {
		return emptyReceipts
	}
	return receipts
}

func (b *ReceiptsBroadcaster) HandleAPIReceiptsList(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (interface{}, error) {
	db := r.Context().Value(CtxKeyDB).(*sql.DB)
	query := r.URL.Query()

	sortMode := query.Get("sort_mode")
	if sortMode == "" {
		sortMode = "id"
	}
	if sortMode != "id" && sortMode != "created_at" {
		return httputils.JsonError{Code: 400, Error: "WRONG_SORT_MODE"}, nil
	}

	searchQuery := query.Get("search")

	var err error
	var receipts []*Receipt
	if sortMode == "id" {
		beforeIDStr := query.Get("before_id")
		beforeID := int64(0)
		if beforeIDStr != "" {
			beforeID, err = strconv.ParseInt(beforeIDStr, 10, 64)
			if err != nil {
				return httputils.JsonError{Code: 400, Error: "WRONG_NUMBER_FORMAT"}, nil
			}
		}
		receipts, err = loadReceiptsSortedByID(db, beforeID, searchQuery)
	} else if sortMode == "created_at" {
		beforeTimeStr := query.Get("before_time")
		beforeTime := time.Time{}
		if beforeTimeStr != "" {
			beforeTime, err = time.Parse(time.RFC3339, beforeTimeStr)
			if err != nil {
				return httputils.JsonError{Code: 400, Error: "WRONG_TIME_FORMAT"}, nil
			}
		}
		receipts, err = loadReceiptsSortedByCreatedAt(db, beforeTime, searchQuery)
	}
	if err != nil {
		return nil, merry.Wrap(err)
	}

	startSSE := query.Get("sse")
	if startSSE == "" || startSSE == "0" {
		return ensureRecsNotNil(receipts), nil
	}

	flusher, ok := wr.(http.Flusher)
	if !ok {
		log.Debug().Msg("SSE: flushing not available, aborting")
		return ensureRecsNotNil(receipts), nil
	}
	log.Debug().Msg("SSE: starting loop")

	recsChan := b.AddClient()
	defer b.RemoveClient(recsChan)

	closeNotify := wr.(http.CloseNotifier).CloseNotify()

	wr.Header().Set("Content-Type", "text/event-stream")
	wr.Header().Set("X-Accel-Buffering", "no") //disabling Nginx buffering

	if receipts == nil {
		receipts = []*Receipt{}
	}
	if err := writeSseJson(wr, "initial_receipts", receipts); err != nil {
		return nil, merry.Wrap(err)
	}
	flusher.Flush()

sseLoop:
	for {
		select {
		case rec := <-recsChan:
			log.Debug().Msg("SSE: got receipt")
			// errors.Is(err, syscall.EPIPE)
			if err := writeSseJson(wr, "receipt", rec); err != nil {
				return nil, merry.Wrap(err)
			}
			flusher.Flush()
		case <-closeNotify:
			log.Debug().Msg("SSE: client closed connection, aborting loop")
			break sseLoop
		}
	}
	return nil, nil
}

func StartHTTPServer(db *sql.DB, env Env, address string, updaterTriggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
	ex, err := os.Executable()
	if err != nil {
		return merry.Wrap(err)
	}
	baseDir := filepath.Dir(ex)

	var bundleFPath, stylesFPath string

	receiptsBroadcaster := NewReceiptsBroadcaster()
	go func() {
		for recID := range updatedReceiptIDsChan {
			rec, err := loadReceipt(db, recID)
			if err != nil {
				log.Fatal().Stack().Err(err).Msg("")
			}
			receiptsBroadcaster.InReceiptsChan <- rec
		}
	}()

	// Config
	wrapper := &httputils.Wrapper{
		ShowErrorDetails: env.IsDev(),
		ExtraChainItem: func(handle httputils.HandlerExt) httputils.HandlerExt {
			return func(wr http.ResponseWriter, r *http.Request, params httprouter.Params) error {
				log.Debug().Str("method", r.Method).Str("path", r.URL.Path).Msg("request")
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyEnv, env))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyDB, db))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyTrigger, updaterTriggerChan))
				r = r.WithContext(context.WithValue(r.Context(), CtxKeyUpdateRec, updatedReceiptIDsChan))
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
	route("GET", "/api/receipts_list", receiptsBroadcaster.HandleAPIReceiptsList)

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
		bundleFPath = "./bundle.js"
		stylesFPath = "./bundle.css"
		router.NotFound = &httputil.ReverseProxy{Director: func(req *http.Request) {
			req.URL.Scheme = "http"
			req.URL.Host = devServerAddress
		}}
	} else {
		distPath := baseDir + "/www/dist"
		bundleFPath, stylesFPath, err = httputils.LastJSAndCSSFNames(distPath, "bundle.", "bundle.")
		bundleFPath, err = httputils.LastBundleFName(distPath, "bundle.", ".js")
		if err != nil {
			return merry.Wrap(err)
		}
		bundleFPath = "./" + bundleFPath
		stylesFPath = "./" + stylesFPath
		router.NotFound = http.HandlerFunc(func(wr http.ResponseWriter, r *http.Request) {
			log.Debug().Str("path", r.URL.Path).Msg("serving static")
			http.ServeFile(wr, r, distPath+r.URL.Path)
		})
	}
	log.Info().Str("fpath", bundleFPath).Msg("bundle")
	log.Info().Str("fpath", stylesFPath).Msg("styles")

	// Server
	log.Info().Str("address", address).Msg("starting server")
	return merry.Wrap(http.ListenAndServe(address, router))
}

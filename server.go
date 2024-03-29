package main

import (
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httputil"
	"os"
	"path/filepath"
	"receipt_qr_scanner/utils"
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

func HandleIndex(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (httputils.TemplateCtx, error) {
	return map[string]interface{}{"FPath": "index.html", "Block": "index.html"}, nil
}

func HandleAPIReceipt(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) (interface{}, error) {
	buf, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	text := string(buf)
	log.Debug().Str("text", text).Msg("receipt ref text")

	ref, err := receiptRefFromText(text)
	var fErr utils.ReceiptRefFieldErr
	if errors.As(err, &fErr) {
		prefix := "WRONG_VALUE_"
		if fErr.IsMissing {
			prefix = "MISSING_VALUE_"
		}
		return &httputils.JsonError{
			Code:        400,
			Error:       prefix + strings.ToUpper(fErr.Name),
			Description: fErr.ValueStr,
		}, nil
	} else if err != nil {
		log.Warn().Err(err).Msg("ref text parse")
		return &httputils.JsonError{
			Code:        400,
			Error:       "WRONG_REF",
			Description: text,
		}, nil
	}

	db := r.Context().Value(CtxKeyDB).(*sql.DB)
	recID, err := saveRecieptRef(db, ref)
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
	InReceiptsChan chan *utils.Receipt
	clients        map[chan *utils.Receipt]struct{}
	mutex          sync.RWMutex
}

func NewReceiptsBroadcaster() *ReceiptsBroadcaster {
	b := &ReceiptsBroadcaster{
		InReceiptsChan: make(chan *utils.Receipt, 10),
		clients:        make(map[chan *utils.Receipt]struct{}),
	}
	go func() {
		for rec := range b.InReceiptsChan {
			b.broadcast(rec)
		}
	}()
	return b
}

func (b *ReceiptsBroadcaster) AddClient() chan *utils.Receipt {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	client := make(chan *utils.Receipt, 10)
	b.clients[client] = struct{}{}
	return client
}

func (b *ReceiptsBroadcaster) RemoveClient(client chan *utils.Receipt) {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	if _, ok := b.clients[client]; ok {
		close(client)
		delete(b.clients, client)
	}
}

func (b *ReceiptsBroadcaster) broadcast(rec *utils.Receipt) {
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

var gzippers = sync.Pool{New: func() interface{} {
	// receipts before_id=100: 1 - 37.9KB, 2 - 36.5KB, 3 - 35.5KB, 4 - 33.8KB, 5 - 32.9KB, 6 - 32.5KB, 7/8/9 - 32.4KB
	// speed: https://tukaani.org/lzma/benchmarks.html
	gz, err := gzip.NewWriterLevel(nil, 5)
	if err != nil {
		panic(err)
	}
	return gz
}}

type gzipResponseWriter struct {
	http.ResponseWriter
	gz *gzip.Writer
}

func (w *gzipResponseWriter) Write(p []byte) (int, error) {
	return w.gz.Write(p)
}

func (w *gzipResponseWriter) CloseNotify() <-chan bool {
	return w.ResponseWriter.(http.CloseNotifier).CloseNotify()
}

func (w *gzipResponseWriter) Flush() {
	w.gz.Flush() //TODO: error is ignored here, since it (looks like) should also be returned from Write()
	w.ResponseWriter.(http.Flusher).Flush()
}

func withGzip(handle httputils.HandlerExt) httputils.HandlerExt {
	return func(wr http.ResponseWriter, r *http.Request, ps httprouter.Params) error {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			return handle(wr, r, ps)
		}
		wr.Header().Set("Content-Encoding", "gzip")

		gz := gzippers.Get().(*gzip.Writer)
		defer gzippers.Put(gz)
		gz.Reset(wr)

		err := handle(&gzipResponseWriter{wr, gz}, r, ps)
		if err != nil {
			return merry.Wrap(err)
		}
		return merry.Wrap(gz.Close())
	}
}

var emptyReceipts = []*utils.Receipt{}

func ensureRecsNotNil(receipts []*utils.Receipt) []*utils.Receipt {
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
	var receipts []*utils.Receipt
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
		receipts = []*utils.Receipt{}
	}
	if err := writeSseJson(wr, "initial_receipts", receipts); err != nil {
		return nil, merry.Wrap(err)
	}
	flusher.Flush()
	// for _, rec := range receipts {
	// 	if err := writeSseJson(wr, "receipt", rec); err != nil {
	// 		return nil, merry.Wrap(err)
	// 	}
	// 	flusher.Flush()
	// 	time.Sleep(time.Second)
	// }

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

func StartHTTPServer(db *sql.DB, env utils.Env, address string, debugTLS bool, updaterTriggerChan chan struct{}, updatedReceiptIDsChan chan int64) error {
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
	route("GET", "/api/receipts_list", withGzip, receiptsBroadcaster.HandleAPIReceiptsList)

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
	if debugTLS {
		return merry.Wrap(http.ListenAndServeTLS(address, "debug.pem", "debug.key", router))
	} else {
		return merry.Wrap(http.ListenAndServe(address, router))
	}
}

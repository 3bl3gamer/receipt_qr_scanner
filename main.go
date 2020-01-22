package main

import (
	"flag"
	"os"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

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

	// DB
	cfgDir, err := MakeConfigDir()
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}

	db, err := setupDB(cfgDir)
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
	defer db.Close()

	triggerChan := make(chan struct{}, 10)
	updatedReceiptIDsChan := make(chan int64, 10)

	go func() {
		if err := StartUpdater(db, triggerChan, updatedReceiptIDsChan); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
	}()

	if err := StartHTTPServer(db, env, serverAddr, triggerChan, updatedReceiptIDsChan); err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
}

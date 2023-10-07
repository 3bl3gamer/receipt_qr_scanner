package main

import (
	"flag"
	"os"
	"receipt_qr_scanner/kg_gns"
	"receipt_qr_scanner/ru_fns"
	"receipt_qr_scanner/utils"
	"strings"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	env := utils.Env{Val: "dev"}
	flag.Var(&env, "env", "evironment, dev or prod")
	serverAddr := flag.String("addr", "127.0.0.1:9010", "HTTP server address:port")
	mustInitSession := flag.Bool("init-session", false, "init RU FNS session")
	skipClients := flag.String("skip-clients", "", "do not init cliets (example: 'ru-fns kg-gns')")
	debugTSL := flag.Bool("debug-tls", false, "start HTTP server in TLS mode for debugging")
	flag.Parse()

	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.ErrorStackMarshaler = func(err error) interface{} { return merry.Details(err) }
	zerolog.ErrorStackFieldName = "message" //TODO: https://github.com/rs/zerolog/issues/157
	var tsFmt zerolog.Formatter
	if env.IsProd() { //removeing timestamps in prod mode (systemd will add them)
		tsFmt = func(arg interface{}) string { return "" }
	}
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "2006-01-02 15:04:05.000", FormatTimestamp: tsFmt})

	domain2client := map[string]utils.Client{
		"ru-fns": &ru_fns.Client{},
		"kg-gns": &kg_gns.Client{},
	}

	if *mustInitSession {
		args := flag.Args()
		if len(args) != 2 {
			log.Fatal().Msg("exactly two arguments (refreshToken and clientSecret) are required for session init")
		}
		client := domain2client["ru-fns"].(*ru_fns.Client)
		if err := client.InitSession(args[0], args[1]); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		if err := client.LoadSession(); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		os.Exit(0)
	}

	for domain, client := range domain2client {
		if strings.Contains(*skipClients, domain) {
			continue
		}

		err := client.LoadSession()
		if merry.Is(err, utils.ErrSessionNotFound) {
			log.Fatal().Msg("session file not found, forgot to --init-session?")
		} else if err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
	}

	// DB
	cfgDir, err := utils.MakeConfigDir()
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
		if err := StartUpdater(db, domain2client, triggerChan, updatedReceiptIDsChan); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
	}()

	if err := StartHTTPServer(db, env, *serverAddr, *debugTSL, triggerChan, updatedReceiptIDsChan); err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
}

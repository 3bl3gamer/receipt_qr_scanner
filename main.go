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
	flag.Var(&env, "env", "evironment, dev or prod")
	serverAddr := flag.String("addr", "127.0.0.1:9010", "HTTP server address:port")
	mustInitSession := flag.Bool("init-session", false, "init FNS session")
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

	// Session
	var err error
	var session *Session
	if *mustInitSession {
		args := flag.Args()
		if len(args) != 2 {
			log.Fatal().Msg("exactly two arguments (refreshToken and clientSecret) are required for session init")
		}
		session, err = initSession(args[0], args[1])
	} else {
		session, err = loadSession()
		if merry.Is(err, ErrSessionNotFound) {
			log.Fatal().Msg("session file not found, forgot to --init-session?")
		}
	}
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
	if err := updateSessionIfOld(session); err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
	// Checking session
	profile, err := fnsGetProfile(session.SessonID)
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
	log.Info().Str("phone", profile.Phone).Msg("profile")
	if *mustInitSession {
		os.Exit(0)
	}

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
		if err := StartUpdater(db, session, triggerChan, updatedReceiptIDsChan); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
	}()

	if err := StartHTTPServer(db, env, *serverAddr, triggerChan, updatedReceiptIDsChan); err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
}

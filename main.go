package main

import (
	"flag"
	"os"
	"receipt_qr_scanner/kg_gns"
	"receipt_qr_scanner/kz_ktc"
	"receipt_qr_scanner/receipts"
	"receipt_qr_scanner/ru_fns"
	"receipt_qr_scanner/utils"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var allDomains = []receipts.Domain{
	ru_fns.Domain,
	kg_gns.Domain,
	kz_ktc.Domain,
}

func main() {
	var allSessionDomains []receipts.Domain
	for _, d := range allDomains {
		if _, ok := d.MakeClient().(receipts.ClientWithSession); ok {
			allSessionDomains = append(allSessionDomains, d)
		}
	}

	env := utils.Env{Val: "dev"}
	domainClientsToInit := utils.OptionValue[receipts.Domain]{
		Options: allSessionDomains,
		ToStr:   func(d receipts.Domain) string { return d.Code },
	}
	domainsClientsToUse := utils.OptionValues[receipts.Domain]{
		Options:   allDomains,
		ToStr:     func(d receipts.Domain) string { return d.Code },
		Separator: ",",
	}

	flag.Var(&env, "env", "evironment, dev or prod")
	serverAddr := flag.String("addr", "127.0.0.1:9010", "HTTP server address:port")
	flag.Var(&domainClientsToInit, "init-session", "init session for client, possible values: "+domainClientsToInit.JoinStrings(", "))
	flag.Var(&domainsClientsToUse, "clients", "use only specified cliets (all used by default: "+domainsClientsToUse.JoinStrings(",")+")")
	debugTSL := flag.Bool("debug-tls", false, "start HTTP server in TLS mode for debugging")
	flag.Parse()

	if len(domainsClientsToUse.Values) == 0 {
		domainsClientsToUse.Values = allDomains
	}

	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.ErrorStackMarshaler = func(err error) interface{} { return merry.Details(err) }
	zerolog.ErrorStackFieldName = "message" //TODO: https://github.com/rs/zerolog/issues/157
	var tsFmt zerolog.Formatter
	if env.IsProd() { //removeing timestamps in prod mode (systemd will add them)
		tsFmt = func(arg interface{}) string { return "" }
	}
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "2006-01-02 15:04:05.000", FormatTimestamp: tsFmt})

	// инициализация одного клиента (если выбрано)
	if domainClientsToInit.Value != nil {
		args := flag.Args()
		client := domainClientsToInit.Value.MakeClient().(receipts.ClientWithSession)
		if err := client.InitSession(args...); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		if err := client.LoadSession(); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		os.Exit(0)
	}

	// инициализация клиентов
	domain2client := map[string]receipts.Client{}
	for _, domain := range domainsClientsToUse.Values {
		client := domain.MakeClient()

		if err := client.Init(); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}

		if clientSess, ok := client.(receipts.ClientWithSession); ok {
			err := clientSess.LoadSession()
			if merry.Is(err, receipts.ErrSessionNotFound) {
				log.Fatal().Str("domain", domain.Code).Msgf("session file not found, forgot to --init-session %s ?", domain.Code)
			} else if err != nil {
				log.Fatal().Str("domain", domain.Code).Stack().Err(err).Msg("")
			}
		}

		domain2client[domain.Code] = client
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

	// запуск
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

package main

import (
	"database/sql"
	"flag"
	"os"
	"receipt_qr_scanner/kg_gns"
	"receipt_qr_scanner/kz_jus"
	"receipt_qr_scanner/kz_ktc"
	"receipt_qr_scanner/kz_ttc"
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
	kz_jus.Domain,
	kz_ttc.Domain,
}

func main() {
	var allSessionDomains []receipts.Domain
	for _, d := range allDomains {
		if _, ok := d.NewClient().(receipts.ClientWithSession); ok {
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
	updateSearchKey := flag.Bool("update-search-key", false, "update all receipts search_key, VACUUM and exit")
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

	// обновление search_key (если выбрано)
	if *updateSearchKey {
		db := openDB()

		log.Info().Msg("updating...")
		if err := updateAllSearchKeys(db, allDomains); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}

		log.Info().Msg("vacuuming...")
		if _, err := db.Exec("VACUUM"); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}

		log.Info().Msg("search keys updated and database vacuumed")
		os.Exit(0)
	}

	// инициализация одного клиента (если выбрано)
	if domainClientsToInit.Value != nil {
		args := flag.Args()
		client := domainClientsToInit.Value.NewClient().(receipts.ClientWithSession)
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
		client := domain.NewClient()

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
	db := openDB()
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

func openDB() *sql.DB {
	cfgDir, err := utils.MakeConfigDir()
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}

	db, err := setupDB(cfgDir)
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("")
	}
	return db
}

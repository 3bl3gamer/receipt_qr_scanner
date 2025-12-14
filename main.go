package main

import (
	"flag"
	"os"
	"receipt_qr_scanner/kg_gns"
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
}
var usedDomains = allDomains

func receiptRefFromText(refText string) (receipts.ReceiptRef, error) {
	return receipts.ReceiptRefFromText(usedDomains, refText)
}

func main() {
	var allSessionDomains []receipts.Domain
	for _, d := range allDomains {
		if _, ok := d.MakeClient().(receipts.ClientWithSession); ok {
			allSessionDomains = append(allSessionDomains, d)
		}
	}

	// allDomainCodes := make([]string, len(allDomains))
	// allSessionDomainCodes := []string{}
	// for i, d := range allDomains {
	// 	allDomainCodes[i] = d.Code
	// 	if _, ok := d.MakeClient().(receipts.ClientWithSession); ok {
	// 		allSessionDomainCodes = append(allSessionDomainCodes, d.Code)
	// 	}
	// }

	env := utils.Env{Val: "dev"}
	domainToInit := utils.OptionValue[receipts.Domain]{
		Options: allSessionDomains,
		ToStr:   func(d receipts.Domain) string { return d.Code },
	}
	domainsToUse := utils.OptionValues[receipts.Domain]{
		Options:   allDomains,
		ToStr:     func(d receipts.Domain) string { return d.Code },
		Separator: ",",
	}

	flag.Var(&env, "env", "evironment, dev or prod")
	serverAddr := flag.String("addr", "127.0.0.1:9010", "HTTP server address:port")
	flag.Var(&domainToInit, "init-session", "init session for client, possible values: "+domainToInit.JoinStrings(", "))
	flag.Var(&domainsToUse, "clients", "use only specified cliets (all used by default: "+domainsToUse.JoinStrings(",")+")")
	debugTSL := flag.Bool("debug-tls", false, "start HTTP server in TLS mode for debugging")
	flag.Parse()

	if len(domainsToUse.Values) == 0 {
		domainsToUse.Values = allDomains
	}
	usedDomains = domainsToUse.Values

	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.ErrorStackMarshaler = func(err error) interface{} { return merry.Details(err) }
	zerolog.ErrorStackFieldName = "message" //TODO: https://github.com/rs/zerolog/issues/157
	var tsFmt zerolog.Formatter
	if env.IsProd() { //removeing timestamps in prod mode (systemd will add them)
		tsFmt = func(arg interface{}) string { return "" }
	}
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "2006-01-02 15:04:05.000", FormatTimestamp: tsFmt})

	if domainToInit.Value != nil {
		args := flag.Args()
		client := domainToInit.Value.MakeClient().(receipts.ClientWithSession)
		if err := client.InitSession(args...); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		if err := client.LoadSession(); err != nil {
			log.Fatal().Stack().Err(err).Msg("")
		}
		os.Exit(0)
	}

	domain2client := map[string]receipts.Client{}
	for _, d := range usedDomains {
		domain2client[d.Code] = d.MakeClient()
	}

	for domainCode, c := range domain2client {
		if client, ok := c.(receipts.ClientWithSession); ok {
			err := client.LoadSession()
			if merry.Is(err, receipts.ErrSessionNotFound) {
				log.Fatal().Str("domain", domainCode).Msgf("session file not found, forgot to --init-session %s?", domainCode)
			} else if err != nil {
				log.Fatal().Str("domain", domainCode).Stack().Err(err).Msg("")
			}
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

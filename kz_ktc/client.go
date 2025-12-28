package kz_ktc

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"receipt_qr_scanner/receipts"
	"strconv"
	"time"

	"github.com/ansel1/merry"
	"github.com/rs/zerolog/log"
)

// https://www.gogetssl.com/wiki/intermediate-certificates/gogetssl-intermediate-root-certificates/
// Legacy GoGetSSL RSA DV CA (истекает 2028-09-05)
const goGetSSL_RSA_DV_CA_PEM = `
-----BEGIN CERTIFICATE-----
MIIF1zCCA7+gAwIBAgIRAJOLsI5imHtPdfmMtqUEXJYwDQYJKoZIhvcNAQEMBQAw
gYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpOZXcgSmVyc2V5MRQwEgYDVQQHEwtK
ZXJzZXkgQ2l0eTEeMBwGA1UEChMVVGhlIFVTRVJUUlVTVCBOZXR3b3JrMS4wLAYD
VQQDEyVVU0VSVHJ1c3QgUlNBIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTE4
MDkwNjAwMDAwMFoXDTI4MDkwNTIzNTk1OVowTDELMAkGA1UEBhMCTFYxDTALBgNV
BAcTBFJpZ2ExETAPBgNVBAoTCEdvR2V0U1NMMRswGQYDVQQDExJHb0dldFNTTCBS
U0EgRFYgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCfwF4hD6E1
kLglXs1n2fH5vMQukCGyyD4LqLsc3pSzeh8we7njU4TB85BH5YXqcfwiH1Sf78aB
hk1FgXoAZ3EQrF49We8mnTtTPFRnMwEHLJRpY9I/+peKeAZNL0MJG5zM+9gmcSpI
OTI6p7MPela72g0pBQjwcExYLqFFVsnroEPTRRlmfTBTRi9r7rYcXwIct2VUCRmj
jR1GX13op370YjYwgGv/TeYqUWkNiEjWNskFDEfxSc0YfoBwwKdPNfp6t/5+RsFn
lgQKstmFLQbbENsdUEpzWEvZUpDC4qPvRrxEKcF0uLoZhEnxhskwXSTC64BNtc+l
VEk7/g/be8svAgMBAAGjggF1MIIBcTAfBgNVHSMEGDAWgBRTeb9aqitKz1SA4dib
wJ3ysgNmyzAdBgNVHQ4EFgQU+ftQxItnu2dk/oMhpqnOP1WEk5kwDgYDVR0PAQH/
BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYIKwYBBQUHAwEG
CCsGAQUFBwMCMCIGA1UdIAQbMBkwDQYLKwYBBAGyMQECAkAwCAYGZ4EMAQIBMFAG
A1UdHwRJMEcwRaBDoEGGP2h0dHA6Ly9jcmwudXNlcnRydXN0LmNvbS9VU0VSVHJ1
c3RSU0FDZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNybDB2BggrBgEFBQcBAQRqMGgw
PwYIKwYBBQUHMAKGM2h0dHA6Ly9jcnQudXNlcnRydXN0LmNvbS9VU0VSVHJ1c3RS
U0FBZGRUcnVzdENBLmNydDAlBggrBgEFBQcwAYYZaHR0cDovL29jc3AudXNlcnRy
dXN0LmNvbTANBgkqhkiG9w0BAQwFAAOCAgEAXXRDKHiA5DOhNKsztwayc8qtlK4q
Vt2XNdlzXn4RyZIsC9+SBi0Xd4vGDhFx6XX4N/fnxlUjdzNN/BYY1gS1xK66Uy3p
rw9qI8X12J4er9lNNhrsvOcjB8CT8FyvFu94j3Bs427uxcSukhYbERBAIN7MpWKl
VWxT3q8GIqiEYVKa/tfWAvnOMDDSKgRwMUtggr/IE77hekQm20p7e1BuJODf1Q7c
FPt7T74m3chg+qu0xheLI6HsUFuOxc7R5SQlkFvaVY5tmswfWpY+rwhyJW+FWNbT
uNXkxR4v5KOQPWrY100/QN68/j17paKuSXNcsr56snuB/Dx+MACLBdsF35HxPadx
78vkfQ37WcVmKZtHrHJQ/QUyjxdG8fezMsh0f+puUln/O+NlsFtipve8qYa9h/K5
yD0oZN93ChWve78XrV4vCpjO75Nk5B8O9CWQqGTHbhkgvjyb9v/B+sYJqB22/NLl
R4RPvbmqDJGeEI+4u6NJ5YiLIVVsX+dyfFP8zUbSsj6J34RyCYKBbQ4L+r7k8Srs
LY51WUFP292wkFDPSDmV7XsUNTDOZoQcBh2Fycf7xFfxeA+6ERx2d8MpPPND7yS2
1dkf+SY5SdpSbAKtYmbqb9q8cZUDEImNWJFUVHBLDOrnYhGwJudE3OBXRTxNhMDm
IXnjEeWrFvAZQhk=
-----END CERTIFICATE-----`

type Client struct {
	customCert *x509.Certificate
	httpClient *http.Client
}

func (c *Client) Init() error {
	block, _ := pem.Decode([]byte(goGetSSL_RSA_DV_CA_PEM))
	if block == nil {
		return merry.New("kz_ktc: failed to decode PEM certificate")
	}

	customCert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return merry.Prependf(err, "kz_ktc: failed to parse certificate")
	}

	checkCertExpiration(customCert)

	// Создаём HTTP клиент с добавленным сертификатом
	rootCAs, err := x509.SystemCertPool()
	if err != nil {
		return merry.Prependf(err, "kz_ktc: failed to get system cert pool")
	}
	rootCAs.AddCert(customCert)

	c.customCert = customCert
	c.httpClient = &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{RootCAs: rootCAs},
		},
	}
	return nil
}

func (c *Client) FetchReceipt(iRef receipts.ReceiptRef, onIsCorrect func() error) (receipts.FetchReceiptResult, error) {
	res := receipts.FetchReceiptResult{ShouldDecreaseRetries: false, Data: nil}

	var ref ReceiptRef
	switch r := iRef.(type) {
	case ReceiptRef:
		ref = r
	case *ReceiptRef:
		ref = *r
	default:
		return res, merry.Errorf("%s: unexpected receipt ref %#T %s", Domain.Code, iRef, iRef.String())
	}

	checkCertExpiration(c.customCert)

	// https://consumer.oofd.kz/api/tickets/get-by-url?t={t}&i={i}&f={f}&s={s}
	apiURL := makeAPIURL(ref.data)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return res, merry.Wrap(err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return res, merry.Wrap(err)
	}
	buf, err := io.ReadAll(resp.Body)
	if err != nil {
		return res, merry.Wrap(err)
	}
	defer resp.Body.Close()

	if resp.TLS != nil {
		checkVerifiedChains(resp.TLS.VerifiedChains, c.customCert)
	}

	log.Debug().
		Int("code", resp.StatusCode).Str("status", resp.Status).
		Str("url", apiURL).Str("data", string(buf)).
		Msgf("%s: response", Domain.Code)

	if resp.Status != "200 OK" {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrUnexpectedHttpStatus.Here().Append(resp.Status).Append(string(buf))
	}

	// Проверка наличия поля "ticket" в ответе (на всякий случай)
	var response struct {
		Ticket json.RawMessage `json:"ticket"`
	}
	if err := json.Unmarshal(buf, &response); err != nil {
		res.ShouldDecreaseRetries = true
		return res, receipts.ErrResponseDataMalformed.Here().Append(string(buf))
	}

	res.Data = buf
	return res, nil
}

func makeAPIURL(data ReceiptRefData) string {
	dateStr := data.CreatedAt.Format("20060102T150405")

	// 2 знака после запятой
	sumStr := strconv.FormatFloat(data.Sum, 'f', 2, 64)

	params := url.Values{}
	params.Set("t", dateStr)
	params.Set("i", data.FiscalID)
	params.Set("f", data.KkmFnsId)
	params.Set("s", sumStr)

	return fmt.Sprintf("https://consumer.oofd.kz/api/tickets/get-by-url?%s", params.Encode())
}

// Проверка срока действия сертификата
func checkCertExpiration(cert *x509.Certificate) {
	now := time.Now()
	timeUntilExpiry := cert.NotAfter.Sub(now)

	if timeUntilExpiry <= 365*24*time.Hour {
		log.Warn().
			Str("domain", domainCode).
			Time("expires_at", cert.NotAfter).
			Dur("time_until_expiry", timeUntilExpiry).
			Msg("Custom CA certificate will expire in less than a year")
	}
}

// Проверка цепочек сертификатов в ответе
func checkVerifiedChains(chains [][]*x509.Certificate, customCert *x509.Certificate) {
	if len(chains) == 0 {
		return
	}

	hasChainWithoutCustomCert := false
	for _, chain := range chains {
		customCertFound := false
		for _, cert := range chain {
			if cert.Equal(customCert) {
				customCertFound = true
				break
			}
		}
		if !customCertFound {
			hasChainWithoutCustomCert = true
			break
		}
	}

	if hasChainWithoutCustomCert {
		log.Warn().
			Str("domain", Domain.Code).
			Int("chains_count", len(chains)).
			Msg("Custom CA certificate seems not needed: it is not required for one of chains")
	}
}

import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { makeKzTtcReceiptTitle, parseKzTtcReceipt } from './kz-ttc'

describe('makeKzTtcReceiptTitle', () => {
	function check(dest: unknown, data: string) {
		test.strictEqual(makeKzTtcReceiptTitle(data), dest)
	}

	it('should remove legal entity prefixes and quotes', () => {
		check('test', 'test')
		check('Name', 'ТОО "Name"')
		check('AIMEDI GROUP', 'ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "AIMEDI GROUP"')
		check('Name', 'ФИЛИАЛ ТОВАРИЩЕСТВА С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "Name"')
	})
})

describe('parseKzTtcReceipt', () => {
	it('should parse real receipt #1', () => {
		const htmlData = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="">
  <meta name="author" content="">
  <title>ОФД </title>
  <link rel="stylesheet" href="/css/green.css?5133031">
  <link rel='shortcut icon' href='/images/faviconttc.ico' type='image/x-icon'>

  <link rel="stylesheet" href="/css/datepicker.min.css" />
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script src="/js/jquery.min.js"></script>
  <script src="/js/inputmask.min.js"></script>
</head>

<body id="green_body">
  <div class="green_content">
    <div>
      <p class="alert alert-info" role="alert"></p>
      <p class="alert alert-danger" role="alert"></p>
    </div>
    <div class="demo_notification d-none">
      <p>"ВНИМАНИЕ!!! Вы попали на демоверсию портала ОФД ТТК. Портал для клиентов доступен по адресу <a
          href="https://ofd1.kz/login">https://ofd1.kz/login</a>. Нажмите для перехода на основной сайт"</p>
    </div>
    <div>
      <main role="main" id="green_main" style="margin-top: 40px;">
        <div class="logo_container">
          <a href="https://ofd.ttc.kz/"><img src="../images/design/logo-ttc.svg" class="logo" alt="Транстелеком"></a>
        </div>
        <span class="ticket_date_time d-none">2024-03-09 16:47:31.000000</span>
        <span class="ticket_fiscal_mark d-none">123456789012</span>
        <span class="ticket_state_number d-none">010101234567</span>
        <div class="ready_ticket tickets_data_for_print"
          style="width: 300px;margin: 0 auto 45px; font-family: monospace;-webkit-box-shadow: 0 5px 20px 0 rgba(0, 0, 0, 0.35);box-shadow: 0 5px 20px 0 rgba(0, 0, 0, 0.35);padding: 15px;font-size: 12px;height: 500px;overflow-y: auto;">
          <div class="ticket_header"
            style="text-align: center;border-bottom: 1px dotted #777;margin-bottom: 15px;padding-bottom: 15px; overflow: auto;">
            <div>
              <span class="">
                ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ &quot;AIMEDI GROUP&quot;
              </span>
            </div>
            <div>
              ЖСН/БСН / ИИН/БИН :
              <span class="">
                220540017611
              </span>
            </div>
            <div>
              МТН / РНМ:
              <span class="">
                010101234567
              </span>
            </div>
            <div>
              МЗН / ЗНМ:
              <span class="">
                SWK00123456
              </span>
            </div>
            <div>
              Мекен-жайы / Адрес:
              <span class="wb-all">
                Республика Казахстан, г. Алматы, р-н Медеуский,
                достык, д. 49, оф.
              </span>
            </div>
            <div>
              Күні мен уақыты / Дата и время:
              <span class="">
                9 мар 2024, 16:47
              </span>
            </div>
            <div>
              Кассалық чек / Кассовый чек
              <span class="">/ Кассалық чек / Продажа
              </span>
            </div>
            <div>
              Чек нөмірі / Номер чека:
              <span class="">
                12345
              </span>
            </div>
          </div>
          <div class="ticket_body">
            <ol class="ready_ticket__items_list"
              style="margin: 0;padding: 0; list-style: none; margin-bottom: 15px; padding-bottom: 15px;">
              <li style="border-bottom: 1px dotted #777; padding: 10px 0;">
                <span class="wb-all">
                  1075 MONGE MINI PUP&amp;JUN LAMB\\RICE Сухой корм д/щенков и юниоров мелких собак баранина/рис (7,5кг)
                </span>
                <small>
                </small> <br />
                <div class="ready_ticket__item">
                  <b>
                  </b>
                  3 960.00 x
                  0.5
                  кг
                  = 1 980.00
                  <div>
                    ҚҚС қоса алғанда / в т.ч НДС(12.0%): 212.14
                    <br />
                  </div>
                </div>
              </li>
              <li style="border-bottom: 1px dotted #777; padding: 10px 0;">
                <span class="wb-all">
                  6&quot; 2PC Лакомства для собак Кости жильные KZ091
                </span>
                <small>
                </small> <br />
                <div class="ready_ticket__item">
                  <b>
                  </b>
                  1 200.00 x
                  1
                  шт
                  = 1 200.00
                  <div>
                    ҚҚС қоса алғанда / в т.ч НДС(12.0%): 128.57
                    <br />
                  </div>
                </div>
              </li>
            </ol>
            <div class="total_sum" style="margin-top: -20px;">
              <div>
                <b style="font-size: 20px;">
                  Барлығы / ИТОГО:
                  <span class="ticket_total bit_depth">
                    3180.00
                  </span>
                </b>
              </div>
              <ul class="list-unstyled" style="display: inline">
                <li>
                  Карта / Карта: 3 180.00
                </li>
              </ul>
            </div>
            <div>
            </div>
            <br>
            <div>
              Cалықтар / Налоги:
              <div>
                ҚҚС қоса алғанда / в т.ч НДС(12.0): 340.71
              </div>
            </div>
          </div>
          <div class="ticket_footer">
            <div class="text-center">
              Фискалдық чек / Фискальный чек
            </div>
            <div class="text-center">
              <b>
              </b>
            </div>
            <div>
            </div>
            <div>
              Фискалдық белгі / Фискальный признак: <span class="">
                123456789012
              </span>
            </div>
            <div>
              ФДО / ОФД -
              <span class="">
                ФДО - «Транстелеком» АҚ / АО «Транстелеком»
              </span>
            </div>
            <div>
              Тексеру үшін сайтқа кіріңіз / Для проверки зайдите на сайт:
              <span class="">
                ofd.ttc.kz
              </span>
            </div>
            <div class="qrcode_show_ticket" style="display: flex; justify-content: center; margin: 1rem;"></div>
            <div class="text-center">Требуй чек - выиграй приз!<br>Сканируй этот чек с помощью приложения Amian и
              участвуй в розыгрыше ценных призов! /<br>Чекті талап етіп жүлде ұтып ал!<br>Amian қосымшасы арқылы осы
              чекті сканерлеп, бағалы сыйлықтар ұтысына қатысыңыз!</div>
          </div>
        </div>
        <button onclick="copyUrl()" class="btn btn-primary" style="max-width: 100%; margin-top: 0;">
          Скопировать ссылку на чек
        </button>
        <div style="display: flex; gap: 8px">
          <button class="btn btn-primary" onclick="printTicket()">
            Распечатать
          </button>
          <button class="btn btn-primary" onclick="printPdf()">
            Скачать PDF
          </button>
          <form accept-charset="UTF-8" action="/download_ticket_pdf" class="d-none" method="post"><input
              name="_csrf_token" type="hidden" value="XCwnGA0JKmA4IhIUEjFlG1kUNAgEWSgEjxfBBfcUgAZPSy3v8UUqFoLO"><input
              name="_utf8" type="hidden" value="✓">
            <textarea class="d-none" id="ticket_body" name="ticket_body">
</textarea>
            <button id="download_ticket_pdf_btn_submit" name="download_ticket_pdf_btn_submit" type="submit"></button>
          </form>
        </div>
        <div style="display: flex; gap: 8px">
          <input id="recipient_input" type="email" placeholder="Введите email..." class="form-control"
            style="margin-top: 1rem; border-radius: 0.5rem">
          <button class="btn btn-primary" onclick="sendEmail()">
            Отправить email
          </button>
          <form accept-charset="UTF-8" action="/email_ticket_pdf" class="d-none" method="post"><input name="_csrf_token"
              type="hidden" value="XCwnGA0JKmA4IhIUEjFlG1kUNAgEWSgEjxfBBfcUgAZPSy3v8UUqFoLO"><input name="_utf8"
              type="hidden" value="✓">
            <textarea class="d-none" id="ticket_body_email" name="ticket_body_email">
</textarea>
            <textarea class="d-none" id="recipient" name="recipient">
</textarea>
            <textarea class="d-none" id="url" name="url">
</textarea>
            <button id="email_ticket_pdf_btn_submit" name="email_ticket_pdf_btn_submit" type="submit"></button>
          </form>
        </div>
        <script>
          alert(1)
        </script>
      </main>
    </div>
    <div>
      <div class="copyright">
        ©2018 — 2025, Pulsar. Все права защищены.
      </div>
</body>
<script src="/js/app.js?rand"></script>
<script src="/js/green.js?rand"></script>
<script src="/js/ncalayer.js?rand"></script>
<script src="/js/process-ncalayer-calls.js?rand"></script>
</html>`
		const result = parseKzTtcReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: 'ТОВАРИЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "AIMEDI GROUP"',
			orgId: '220540017611',
			receiptNumber: '12345',
			fiscalId: '123456789012',
			kkmSerialNumber: 'SWK00123456',
			kkmFnsId: '010101234567',
			totalSum: 3180,
			address: 'Республика Казахстан, г. Алматы, р-н Медеуский,\n                достык, д. 49, оф.',
			items: [
				{
					name: '1075 MONGE MINI PUP&JUN LAMB\\RICE Сухой корм д/щенков и юниоров мелких собак баранина/рис (7,5кг)',
					price: 3960,
					quantity: 0.5,
					sum: 1980,
				},
				{
					name: '6" 2PC Лакомства для собак Кости жильные KZ091',
					price: 1200,
					quantity: 1,
					sum: 1200,
				},
			],
			parseErrors: [],
		})
	})

	it('should parse small and big item prices', () => {
		const htmlData = `<!DOCTYPE html>
<html>
<body>
<div class="ready_ticket">
  <div class="ticket_body">
    <ol class="ready_ticket__items_list">
      <li>
        <span class="wb-all"> Перевозка пассажиров и багажа </span>
        <div class="ready_ticket__item"> 500.00 x 1 одн.усл = 500.00 </div>
      </li>
      <li>
        <span class="wb-all"> Дорогие штуки </span>
        <div class="ready_ticket__item"> 123 400.12 x 2 шт = 246 800.24 </div>
      </li>
      <li>
        <span class="wb-all"> Дорогие килограммы </span>
        <div class="ready_ticket__item"> 100 000.00 x 2.5 кг = 250 000.00 </div>
      </li>
    </ol>
  </div>
</div>
</body>
</html>`
		const result = parseKzTtcReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: undefined,
			orgId: undefined,
			receiptNumber: undefined,
			fiscalId: undefined,
			kkmSerialNumber: undefined,
			kkmFnsId: undefined,
			totalSum: undefined,
			address: undefined,
			items: [
				{
					name: 'Перевозка пассажиров и багажа',
					price: 500,
					quantity: 1,
					sum: 500,
				},
				{
					name: 'Дорогие штуки',
					price: 123400.12,
					quantity: 2,
					sum: 246800.24,
				},
				{
					name: 'Дорогие килограммы',
					price: 100000,
					quantity: 2.5,
					sum: 250000,
				},
			],
			parseErrors: [],
		})
	})

	it('should handle missing fields gracefully', () => {
		const htmlData = `<!DOCTYPE html>
<html>
<body>
<div class="ready_ticket">
  <div class="ticket_header">
    <div><span>Minimal Receipt</span></div>
  </div>
  <div class="ticket_body">
    <span class="ticket_total">100.50</span>
  </div>
</div>
</body>
</html>`
		const result = parseKzTtcReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: 'Minimal Receipt',
			orgId: undefined,
			receiptNumber: undefined,
			fiscalId: undefined,
			kkmSerialNumber: undefined,
			kkmFnsId: undefined,
			totalSum: 100.5,
			address: undefined,
			items: [],
			parseErrors: [],
		})
	})
})

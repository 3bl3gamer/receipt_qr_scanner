import test from 'node:assert/strict'
import { it, suite as describe } from 'node:test'

import { parseKzBeeReceipt } from './kz-bee'

describe('parseKzBeeReceipt', () => {
	it('should parse receipt with items and discounts', () => {
		const htmlData = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>ОФД</title></head>
<body class="clean_layout">
<span class="ticket_date_time d-none">2025-02-14 14:30:00</span>
<span class="ticket_fiscal_mark d-none">887654321098</span>
<span class="ticket_state_number d-none">010104567890</span>
<div class="ready_ticket ticket_data_for_print">
  <div class="ticket_header">
    <div>Товарищество с ограниченной ответственностью &quot;Asia Foods&quot;</div>
    <div>ЖСН/БСН  / ИИН/БИН: 210987654321</div>
    <div>МТН / РНМ: 010104567890</div>
    <div>МЗН / ЗНМ: WPKS0000054321</div>
    <div>Мекен-жайы / Адрес: Республика Казахстан, г. Астана, р-н Есильский, ул. Кенесары, д. 10</div>
    <div>Күні мен уақыты / Дата и время: 14 фев 2025, 14:30</div>
    <div>Кассалық чек  / Кассовый чек / Кассалық чек / Продажа</div>
  </div>
  <div class="ticket_body">
    <ol class="ready_ticket__items_list">
      <li>
ЛАПША РАМЕН ОСТРАЯ 120Г
        <small></small>
        <br />
        <div class="ready_ticket__item">
          <b>8801234567890</b>
          1250.00 x 2 шт = 2500.00
          <div>- салық / налог (12.0%): 267.86<br /></div>
          <div></div>
        </div>
      </li>
      <li>
        <div class="ready_ticket__item">
          150 ₸ (скидка)  150.00
          <div></div>
        </div>
      </li>
      <li>
МОЛОКО БАНАНОВОЕ 200МЛ
        <small></small>
        <br />
        <div class="ready_ticket__item">
          <b>8809876543210</b>
          450.00 x 3 шт = 1350.00
          <div>- салық / налог (12.0%): 144.64<br /></div>
          <div></div>
        </div>
      </li>
    </ol>
    <div class="total_sum">
      <div><b>Барлығы / ИТОГО: <span class="ticket_total">3700.00</span></b></div>
      <ul class="list-unstyled" style="display: inline">
        <li>Карта / Карта: 3 700.00</li>
      </ul>
    </div>
  </div>
  <div class="ticket_footer">
    <div class="text-center">Фискальный чек</div>
    <div>Фискальный признак: <span>887654321098</span></div>
    <div>ОФД - <span>ФДО - «Кар-Тел» ЖШС / ТОО «КаР-Тел»</span></div>
  </div>
</div>
</body>
</html>`
		const result = parseKzBeeReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: 'Товарищество с ограниченной ответственностью "Asia Foods"',
			orgId: '210987654321',
			fiscalId: '887654321098',
			kkmSerialNumber: 'WPKS0000054321',
			kkmFnsId: '010104567890',
			totalSum: 3700,
			address: 'Республика Казахстан, г. Астана, р-н Есильский, ул. Кенесары, д. 10',
			items: [
				{
					name: 'ЛАПША РАМЕН ОСТРАЯ 120Г',
					price: 1250,
					quantity: 2,
					sum: 2500,
				},
				{
					name: 'МОЛОКО БАНАНОВОЕ 200МЛ',
					price: 450,
					quantity: 3,
					sum: 1350,
				},
			],
			parseErrors: [],
		})
	})

	it('should parse items with fractional quantities', () => {
		const htmlData = `<!DOCTYPE html>
<html>
<body>
<div class="ready_ticket">
  <div class="ticket_body">
    <ol class="ready_ticket__items_list">
      <li>
Сыр Голландский весовой
        <small></small>
        <br />
        <div class="ready_ticket__item">
          <b>4870001234567</b>
          3 200.00 x 0.5 кг = 1 600.00
          <div></div>
        </div>
      </li>
      <li>
Пакет фасовочный большой
        <small></small>
        <br />
        <div class="ready_ticket__item">
          <b>2700009999999</b>
          30.00 x 1 шт = 30.00
          <div></div>
        </div>
      </li>
    </ol>
  </div>
</div>
</body>
</html>`
		const result = parseKzBeeReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: undefined,
			orgId: undefined,
			fiscalId: undefined,
			kkmSerialNumber: undefined,
			kkmFnsId: undefined,
			totalSum: undefined,
			address: undefined,
			items: [
				{
					name: 'Сыр Голландский весовой',
					price: 3200,
					quantity: 0.5,
					sum: 1600,
				},
				{
					name: 'Пакет фасовочный большой',
					price: 30,
					quantity: 1,
					sum: 30,
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
    <div>Простой Магазин</div>
  </div>
  <div class="ticket_body">
    <span class="ticket_total">500.00</span>
  </div>
</div>
</body>
</html>`
		const result = parseKzBeeReceipt(htmlData)

		test.deepStrictEqual(result, {
			orgName: 'Простой Магазин',
			orgId: undefined,
			fiscalId: undefined,
			kkmSerialNumber: undefined,
			kkmFnsId: undefined,
			totalSum: 500,
			address: undefined,
			items: [],
			parseErrors: [],
		})
	})
})

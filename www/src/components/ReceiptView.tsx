import { useEffect } from 'preact/hooks'
import { dateStrAsYMDHM } from '../utils'
import { Receipt, getReceiptDataFrom, FullReceiptData } from '../receipts'
import { HighlightedText } from './HighlightedText'
import { DimmedKopeks } from './DimmedKopeks'
import { JSX } from 'preact/jsx-runtime'

/**
 * Попап с данными из чека.
 *
 * Подсвечивает в тексте вхождения подстроки searchQuery.
 */
export function ReceiptView({
	receipt,
	searchQuery,
	onClose,
}: {
	receipt: Receipt
	searchQuery: string
	onClose: () => void
}): JSX.Element {
	// закрытие по Esc
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onClose])

	const data = getReceiptDataFrom(receipt)

	return (
		<div class="receipt-view-wrap">
			<button class="close" onClick={onClose}>
				✕
			</button>
			<div class="receipt-view">
				<h1 class="title">{data?.common.title ?? 'Чек'}</h1>

				<div class="receipt-items">
					{data?.common.items.map((item, i) => (
						<ReceiptItem key={i} item={item} index={i + 1} searchQuery={searchQuery} />
					))}
				</div>

				<div class="receipt-items-total">
					<div>ИТОГ</div>
					<div class="summ">
						<DimmedKopeks value={data?.common.totalSum} />
					</div>
				</div>

				<ReceiptDates receipt={receipt} searchQuery={searchQuery} />
				<ReceiptPlaceInfo data={data} searchQuery={searchQuery} />
				<ReceiptContacts data={data} searchQuery={searchQuery} />

				<ReceiptInfoTable data={data} searchQuery={searchQuery} />

				<ReceiptParseErrors data={data} />

				<h3>Ответ ФНС</h3>
				<pre class="receipt-json-data">
					<HighlightedText text={JSON.stringify(data?.raw, null, '  ')} searchQuery={searchQuery} />
				</pre>

				<h3>Значение для поиска</h3>
				<pre class="receipt-seach-key">
					<HighlightedText text={receipt.searchKey} searchQuery={searchQuery} />
				</pre>
			</div>
		</div>
	)
}

/**
 * Даты чека (создан, считан, обновлён).
 */
function ReceiptDates({ receipt, searchQuery }: { receipt: Receipt; searchQuery: string }) {
	return (
		<div class="receipt-dates">
			<table>
				<tbody>
					<tr>
						<td>Создан</td>
						<td class="created-at">
							<HighlightedText
								text={dateStrAsYMDHM(receipt.createdAt)}
								searchQuery={searchQuery}
							/>
						</td>
					</tr>
					<tr>
						<td>Считан</td>
						<td class="saved-at">
							<HighlightedText
								text={dateStrAsYMDHM(receipt.savedAt)}
								searchQuery={searchQuery}
							/>
						</td>
					</tr>
					<tr>
						<td>Обновлён</td>
						<td class="updated-at">
							<HighlightedText
								text={dateStrAsYMDHM(receipt.updatedAt)}
								searchQuery={searchQuery}
							/>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	)
}

/**
 * Информация о месте покупки (кассир, смена, ИНН, адрес).
 */
function ReceiptPlaceInfo({ data, searchQuery }: { data: FullReceiptData | null; searchQuery: string }) {
	return (
		<div class="receipt-place-info">
			<table>
				<tbody>
					<tr>
						<td>Кассир</td>
						<td class="operator">
							<HighlightedText text={data?.common.cashierName} searchQuery={searchQuery} />
						</td>
					</tr>
					<tr>
						<td>Смена</td>
						<td class="shift-number">
							<HighlightedText text={data?.common.shiftNumber} searchQuery={searchQuery} />
						</td>
					</tr>
				</tbody>
				<tbody class="user-section">
					{data && 'ruFns' in data ? (
						<>
							<tr>
								<td>Пользователь</td>
								<td>
									<HighlightedText text={data.ruFns.orgName} searchQuery={searchQuery} />
								</td>
							</tr>
							<tr>
								<td>Его ИНН</td>
								<td>
									<HighlightedText text={data?.common.orgInn} searchQuery={searchQuery} />
								</td>
							</tr>
						</>
					) : (
						<tr>
							<td>ИНН</td>
							<td>
								<HighlightedText text={data?.common.orgInn} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
				</tbody>
				<tbody>
					<tr>
						<td>Место расчёта</td>
						<td class="retail-place">
							<HighlightedText text={data?.common.placeName} searchQuery={searchQuery} />
						</td>
					</tr>
					<tr>
						<td>Адрес расчёта</td>
						<td class="retail-place-address">
							<HighlightedText text={data?.common.address} searchQuery={searchQuery} />
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	)
}

/**
 * Контактная информация (телефоны, e-mail, сайт ФНС).
 */
function ReceiptContacts({ data, searchQuery }: { data: FullReceiptData | null; searchQuery: string }) {
	return (
		<div class="receipt-contacts">
			<table>
				<tbody>
					{data && 'ruFns' in data && data.ruFns.buyerPhoneOrAddress && (
						<tr>
							<td>
								{data.ruFns.buyerPhoneOrAddress.includes('@')
									? 'Е-мейл покупателя'
									: 'Телефон покупателя'}
							</td>
							<td>
								<Link
									text={data.ruFns.buyerPhoneOrAddress}
									protocol="mailto:"
									searchQuery={searchQuery}
								/>
							</td>
						</tr>
					)}
					{data && 'ruFns' in data && data.ruFns.sellerAddress && (
						<tr>
							<td>Е-мейл продавца</td>
							<td>
								<Link
									text={data.ruFns.sellerAddress}
									protocol="mailto:"
									searchQuery={searchQuery}
								/>
							</td>
						</tr>
					)}
					{data?.common.taxOrgUrl && (
						<tr>
							<td>Сайт для проверки</td>
							<td class="tax-org-url">
								<Link text={data.common.taxOrgUrl} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
}

/**
 * Отдельная позиция в чеке (товар + количество).
 */
function ReceiptItem({
	item,
	index,
	searchQuery,
}: {
	item: FullReceiptData['common']['items'][number]
	index: number
	searchQuery: string
}) {
	return (
		<div class="receipt-item">
			<div class="name">
				<b>{index}. </b>
				<HighlightedText text={item.name} searchQuery={searchQuery} />
			</div>
			<div class="price">
				{item.quantity !== 1 && (
					<span class="summ-details">
						<HighlightedText text={item.quantity} searchQuery={searchQuery} /> x{' '}
						<DimmedKopeks value={item.price} /> ={' '}
					</span>
				)}
				<span class="summ">
					<DimmedKopeks value={item.sum} />
				</span>
			</div>
		</div>
	)
}

/**
 * Доп.данные чека.
 */
function ReceiptInfoTable({ data, searchQuery }: { data: FullReceiptData | null; searchQuery: string }) {
	if (!data) return null

	const items: [string, string, string | null | undefined][] = []

	if ('ruFns' in data) {
		items.push(['РН ККТ', 'Регистрационный номер ККТ', data.ruFns.kktRegId])
		items.push(['ФН №', 'Заводской номер фискального накопителя', data.ruFns.fiscalDriveNumber])
		items.push(['ФД №', 'Порядковй номер фискального документа', data.ruFns.fiscalDocumentNumber])
		items.push(['ФП', 'Фискальный признак документа', data.ruFns.fiscalDocumentSign])
	}

	if ('kgGns' in data) {
		items.push(['РН ККМ', 'Регистрационный номер ККМ', data.kgGns.kktRegNumber])
		items.push(['ФМ №', 'Серийный номер фискального модуля', data.kgGns.fiscalModuleSerialNumber])
		items.push(['ФД №', 'Номер фискального документа', data.kgGns.fiscalDocumentNumber])
		items.push(['ФПД', 'Фискальный признак документа', data.kgGns.fiscalDocumentSign])
	}

	if ('kzKtc' in data) {
		items.push(['ЗНМ', 'Заводской номер ККМ', data.kzKtc.kkmSerialNumber])
		items.push(['РН ККМ', 'Регистрационный номер ККМ', data.kzKtc.kkmFnsId])
		items.push(['ФП', 'Фискальный признак ККМ', data.kzKtc.fiscalId])
		items.push(['БИН', 'Бизнес-идентификационный номер организации', data.kzKtc.orgId])
	}

	if ('kzJus' in data) {
		items.push(['ЗНМ', 'Заводской номер ККМ', data.kzJus.kkmSerialNumber])
		items.push(['РН ККМ', 'Регистрационный номер ККМ', data.kzJus.kkmFnsId])
		items.push(['ИНК', 'Идентификационный номер кассы', data.kzJus.kkmInkNumber])
		items.push(['ФП', 'Фискальный признак ККМ', data.kzJus.fiscalId])
		items.push(['БИН', 'Бизнес-идентификационный номер организации', data.kzJus.orgId])
		items.push(['Чек №', 'Порядковый номер чека', data.kzJus.receiptNumber])
		items.push(['Кассир', 'Код кассира', data.kzJus.cashierCode])
	}

	if (items.length === 0) return null

	return (
		<div class="receipt-info">
			<table>
				<tbody>
					{items.map(([name, title, value], i) => (
						<tr key={i}>
							<td title={title}>{name}</td>
							<td>
								<HighlightedText text={value} searchQuery={searchQuery} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

/**
 * Ошибки парсинга чека
 */
function ReceiptParseErrors({ data }: { data: FullReceiptData | null }) {
	if (!data || data.common.parseErrors.length === 0) {
		return null
	}

	return (
		<div class="receipt-parse-errors">
			<h3>Ошибки парсинга</h3>
			<pre>{data.common.parseErrors.join('\n')}</pre>
		</div>
	)
}

/**
 * Ссылка с подсветкой искомой подстроки
 */
function Link({
	text,
	protocol: urlPrefix = '',
	searchQuery,
}: {
	text: string | undefined
	protocol?: string
	searchQuery: string
}) {
	if (!text) return <HighlightedText text={text} searchQuery={searchQuery} />

	return (
		<a href={urlPrefix + text}>
			<HighlightedText text={text} searchQuery={searchQuery} />
		</a>
	)
}

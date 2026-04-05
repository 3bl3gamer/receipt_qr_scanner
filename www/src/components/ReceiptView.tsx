import { useEffect } from 'preact/hooks'
import { JSX } from 'preact/jsx-runtime'

import { Receipt } from '../api'
import { useDomainsMetadata } from '../contexts/DomainsMetadataContext'
import { FullReceiptData, getReceiptDataFrom } from '../receipts'
import { arrIncludesUntyped, dateStrAsYMDHM, OptStr, UnionToIntersection } from '../utils'
import { DimmedKopeks } from './DimmedKopeks'
import { HighlightedText } from './HighlightedText'

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
				<ReceiptExtraInfoTable data={data} searchQuery={searchQuery} />

				<ReceiptParseErrors data={data} />

				<h3>Значение QR-кода</h3>
				<p class="qr-code-content">
					{/^https?:\/\//.test(receipt.refText) ? (
						<a href={receipt.refText}>{receipt.refText}</a>
					) : (
						receipt.refText
					)}
				</p>
				<ProviderResponse receipt={receipt} data={data} searchQuery={searchQuery} />

				<h3>Значение для поиска</h3>
				<pre class="receipt-seach-key">
					<HighlightedText text={receipt.searchKey} searchQuery={searchQuery} />
				</pre>
			</div>
		</div>
	)
}

const extraLabels: Record<keyof UnionToIntersection<FullReceiptData['extra']>, [string, string | null]> = {
	ru_kktRegId: ['РН ККТ', 'Регистрационный номер ККТ'],
	ru_fiscalDriveNumber: ['ФН №', 'Заводской номер фискального накопителя'],
	ru_fiscalDocumentNumber: ['ФД №', 'Порядковй номер фискального документа'],
	ru_fiscalDocumentSign: ['ФП', 'Фискальный признак документа'],
	ru_orgInn: ['ИНН', 'Идентификационный номер налогоплательщика'],
	ru_buyerPhoneNumber: ['Телефон покупателя', null],
	ru_buyerEMailAddress: ['Е-мейл покупателя', null],
	ru_sellerEMailAddress: ['Е-мейл продавца', null],

	kg_kktRegNumber: ['РН ККМ', 'Регистрационный номер ККМ'],
	kg_fiscalModuleSerialNumber: ['ФМ №', 'Серийный номер фискального модуля'],
	kg_fiscalDocumentNumber: ['ФД №', 'Номер фискального документа'],
	kg_fiscalDocumentSign: ['ФПД', 'Фискальный признак документа'],
	kg_orgInn: ['ИНН', 'Идентификационный номер налогоплательщика'],

	kz_kkmSerialNumber: ['ЗНМ', 'Заводской номер ККМ'],
	kz_kkmFnsId: ['РН ККМ', 'Регистрационный номер ККМ'],
	kz_fiscalId: ['ФП', 'Фискальный признак ККМ'],
	kz_orgId: ['БИН', 'Бизнес-идентификационный номер организации'],
	kz_kkmInkNumber: ['ИНК', 'Идентификационный номер кассы'],
	kz_receiptNumber: ['Чек №', 'Порядковый номер чека'],
}

const orgIdNumberPropNames = [
	'ru_orgInn', //
	'kg_orgInn',
	'kz_orgId',
] satisfies (keyof typeof extraLabels)[]
const contactsPropNames = [
	'ru_buyerPhoneNumber',
	'ru_buyerEMailAddress',
	'ru_sellerEMailAddress',
] satisfies (keyof typeof extraLabels)[]

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
	if (!data) return null

	const extra = data && (data.extra as UnionToIntersection<typeof data.extra>)

	const cashierTitle = (
		(data.common.cashierCode ? '№' + data.common.cashierCode : '') +
		' ' +
		(data.common.cashierName ?? '')
	).trim()

	return (
		<div class="receipt-place-info">
			<table>
				<tbody>
					{cashierTitle && (
						<tr>
							<td>Кассир</td>
							<td class="operator">
								<HighlightedText text={cashierTitle} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
					{data.common.shiftNumber && (
						<tr>
							<td>Смена</td>
							<td class="shift-number">
								<HighlightedText text={data.common.shiftNumber} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
					{data.common.orgName && (
						<tr>
							<td>Организация</td>
							<td>
								<HighlightedText text={data.common.orgName} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
					{orgIdNumberPropNames.map(orgIdPropName => {
						if (!extra[orgIdPropName]) return null
						return (
							<tr key={orgIdPropName}>
								<td>
									{data.common.orgName ? 'Её ' : ''}{' '}
									<TextWithTitle
										text={extraLabels[orgIdPropName][0]}
										title={extraLabels[orgIdPropName][1] ?? undefined}
									/>
								</td>
								<td>
									<HighlightedText text={extra[orgIdPropName]} searchQuery={searchQuery} />
								</td>
							</tr>
						)
					})}
					<tr>
						<td>Место расчёта</td>
						<td class="retail-place">
							<HighlightedText text={data.common.placeName} searchQuery={searchQuery} />
						</td>
					</tr>
					<tr>
						<td>Адрес расчёта</td>
						<td class="retail-place-address">
							<HighlightedText text={data.common.placeAddress} searchQuery={searchQuery} />
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
	const extra =
		data &&
		(data.extra as Pick<UnionToIntersection<typeof data.extra>, (typeof contactsPropNames)[number]>)

	return (
		<div class="receipt-contacts">
			<table>
				<tbody>
					{extra?.ru_buyerEMailAddress && (
						<tr>
							<td>Е-мейл покупателя</td>
							<td>
								<Link
									text={extra.ru_buyerEMailAddress}
									protocol="mailto:"
									searchQuery={searchQuery}
								/>
							</td>
						</tr>
					)}
					{extra?.ru_buyerPhoneNumber && (
						<tr>
							<td>Телефон покупателя</td>
							<td>
								<Link
									text={extra.ru_buyerPhoneNumber}
									protocol="tel:"
									searchQuery={searchQuery}
								/>
							</td>
						</tr>
					)}
					{extra?.ru_sellerEMailAddress && (
						<tr>
							<td>Е-мейл продавца</td>
							<td>
								<Link
									text={extra.ru_sellerEMailAddress}
									protocol="mailto:"
									searchQuery={searchQuery}
								/>
							</td>
						</tr>
					)}
					{data?.common.taxOrgUrl && (
						<tr>
							<td>Сайт налоговой</td>
							<td class="tax-org-url">
								<Link text={data.common.taxOrgUrl} searchQuery={searchQuery} />
							</td>
						</tr>
					)}
					{data?.common.checkOrgUrl && (
						<tr>
							<td>Сайт для проверки</td>
							<td class="tax-org-url">
								<Link text={data.common.checkOrgUrl} searchQuery={searchQuery} />
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
function ReceiptExtraInfoTable({ data, searchQuery }: { data: FullReceiptData | null; searchQuery: string }) {
	if (!data) return null

	const items: [string, string | null, OptStr][] = []

	const extra = data && (data.extra as UnionToIntersection<typeof data.extra>)
	let attr: keyof typeof extra
	for (attr in extra) {
		if (arrIncludesUntyped(orgIdNumberPropNames, attr)) continue
		if (arrIncludesUntyped(contactsPropNames, attr)) continue
		const [name, title] = extraLabels[attr]
		items.push([name, title, extra[attr]])
	}

	if (items.length === 0) return null

	return (
		<div class="receipt-remaining-info">
			<table>
				<tbody>
					{items.map(([name, title, value], i) => (
						<tr key={i}>
							<td title={title ?? undefined}>{name}</td>
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
	if (!data || data.parseErrors.length === 0) {
		return null
	}

	return (
		<div class="receipt-parse-errors">
			<h3>Ошибки парсинга</h3>
			<pre>{data.parseErrors.join('\n')}</pre>
		</div>
	)
}

/**
 * Провайдер и его ответ
 */
function ProviderResponse({
	receipt,
	data,
	searchQuery,
}: {
	receipt: Receipt
	data: FullReceiptData | null
	searchQuery: string
}) {
	const { domainsMetadata } = useDomainsMetadata()
	const providerName = domainsMetadata.get(receipt.domain)?.providerName
	const rawData =
		typeof data?.raw === 'string' //
			? data.raw
			: JSON.stringify(data?.raw, null, '  ')

	return (
		<>
			<h3>
				Ответ <HighlightedText text={providerName} searchQuery={searchQuery} />
			</h3>
			<pre class="receipt-raw-data">
				<HighlightedText text={rawData} searchQuery={searchQuery} />
			</pre>
		</>
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

function TextWithTitle({ text, title }: { text: string; title: OptStr }): JSX.Element {
	return <span title={title}>{text}</span>
}

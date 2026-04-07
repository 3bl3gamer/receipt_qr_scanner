import './ReceiptProvider.css'

import { Receipt } from '../api'
import { useDomainsMetadata } from '../contexts/DomainsMetadataContext'
import { HighlightedText } from './HighlightedText'

export function ReceiptProviderIcons({
	receipt,
	searchQuery,
	fadeSoleInCountrLabel,
	size,
}: {
	receipt: Receipt
	searchQuery: string
	fadeSoleInCountrLabel: boolean
	size: 'small' | 'normal'
}) {
	const { domainsMetadata } = useDomainsMetadata()
	const domainMetadata = domainsMetadata.get(receipt.domain)

	const flagSymbol = domainMetadata?.flagSymbol
	const providerLabel = domainMetadata?.providerShortLabel
	const providerColor = domainMetadata?.providerColor
	const providerName = domainMetadata?.providerName
	const fadeLabelClass = fadeSoleInCountrLabel && domainMetadata?.isSoleInCountry ? 'fade-label' : ''

	return (
		<div class={`receipt-provider-icons ${fadeLabelClass} ${size} icon-with-title`} title={providerName}>
			{providerLabel && (
				<div class="provider-label" style={{ backgroundColor: providerColor }}>
					{providerLabel}
				</div>
			)}
			<div class="flag">
				<HighlightedText text={flagSymbol} searchQuery={searchQuery} />
			</div>
		</div>
	)
}

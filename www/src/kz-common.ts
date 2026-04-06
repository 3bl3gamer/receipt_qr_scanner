import { onError, OptStr } from './utils'

export type KzRefText = {
	/** ФП, фискальный признак ККМ (поле так называется в ответе kz-ktc) */
	fiscalId: string | null
	/** Код ККМ, РНМ, регистрационный номер ККМ (поле так называется в ответе kz-ktc) */
	kkmFnsId: string | null
	sum: string | null
	createdAt: string | null
}

export function parseKzRefText(refText: string): KzRefText | null {
	let url: URL
	try {
		url = new URL(refText)
	} catch (ex) {
		onError(ex)
		return null
	}
	const params = url.searchParams
	return {
		fiscalId: params.get('i'),
		kkmFnsId: params.get('f'),
		sum: params.get('s'),
		createdAt: params.get('t'),
	}
}

export function makeKzReceiptTitle(orgName: OptStr): OptStr {
	if (!orgName) return orgName

	let cleaned = orgName.trim()
	cleaned = cleaned.replace(/^товарищество с ограниченной ответственностью\s+/i, '')
	cleaned = cleaned.replace(/^ТОО\s+/i, '')

	cleaned = cleaned.replace(/^"([^"]*)"$/, '$1')

	return cleaned.trim()
}

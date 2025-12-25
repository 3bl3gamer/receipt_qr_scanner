import { createContext } from 'preact'
import { useContext, useEffect, useState } from 'preact/hooks'
import { ApiError, DomainMetadata, fetchDomainsMetadata } from '../api'
import { onError } from '../utils'

type DomainsMetadataContextValue = {
	readonly domainsMetadata: Map<string, DomainMetadata>
	readonly isLoaded: boolean
}

const INITIAL_VALUE: DomainsMetadataContextValue = {
	domainsMetadata: new Map(),
	isLoaded: false,
}

const DomainsMetadataContext = createContext<DomainsMetadataContextValue>({
	domainsMetadata: new Map(),
	isLoaded: false,
})

/**
 * Провайдер метаданных доменов.
 * Загружает метаданные при первом рендере и кеширует их.
 */
export function DomainsMetadataProvider({ children }: { children: preact.ComponentChildren }) {
	const [value, setValue] = useState(INITIAL_VALUE)

	useEffect(() => {
		fetchDomainsMetadata()
			.then(res => {
				if (!res.ok) throw new ApiError(res)

				const map = new Map<string, DomainMetadata>()
				for (const domain of res.result) {
					map.set(domain.domainCode, domain)
				}
				setValue({ domainsMetadata: map, isLoaded: true })
			})
			.catch(onError)
	}, [])

	return <DomainsMetadataContext.Provider value={value}>{children}</DomainsMetadataContext.Provider>
}

/**
 * Хук для получения метаданных доменов.
 */
export function useDomainsMetadata() {
	return useContext(DomainsMetadataContext)
}

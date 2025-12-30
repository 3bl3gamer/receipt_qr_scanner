/* eslint-disable no-console */

/// <reference lib="WebWorker" />
export type {}
declare let self: ServiceWorkerGlobalScope

const CACHE_KEY = 'receipt_qr_scanner_v0.6.0'

/*
self.addEventListener('install', e => {
	console.log('[Service Worker] Install')
	e.waitUntil(
		caches.open(cacheName).then(function(cache) {
			return cache.addAll(['/'])
		}),
	)
})
*/

self.addEventListener('activate', event => {
	console.log('[Service Worker] Activate')
	event.waitUntil(
		caches.keys().then(keyList => {
			return Promise.all(
				keyList.map(key => {
					if (key !== CACHE_KEY) return caches.delete(key)
				}),
			)
		}),
	)
})

self.addEventListener('fetch', event => {
	console.log('[Service Worker] Fetch: ' + event.request.url)
	if (event.request.url.includes('/api/')) {
		console.log('[Service Worker] Just fetching: ' + event.request.url)
		event.respondWith(fetch(event.request))
	} else {
		event.respondWith(
			caches.open(CACHE_KEY).then(cache =>
				cache.match(event.request).then(resp => {
					if (resp) {
						console.log('[Service Worker] Returning from cache: ' + event.request.url)
						return resp
					} else {
						console.log('[Service Worker] Fetching resource: ' + event.request.url)
						return fetch(event.request).then(response => {
							console.log('[Service Worker] Caching new resource: ' + event.request.url)
							cache.put(event.request, response.clone())
							return response
						})
					}
				}),
			),
		)
	}
})

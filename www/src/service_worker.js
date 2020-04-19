const cacheName = 'receipt_qr_scanner'

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

self.addEventListener('fetch', event => {
	console.log('[Service Worker] Fetch: ' + event.request.url)
	if (event.request.url.includes('/api/')) {
		console.log('[Service Worker] Just fetching: ' + event.request.url)
		event.respondWith(fetch(event.request))
	} else {
		event.respondWith(
			caches.match(event.request).then(resp => {
				if (resp) {
					console.log('[Service Worker] Returning from cache: ' + event.request.url)
					return resp
				} else {
					console.log('[Service Worker] Fetching resource: ' + event.request.url)
					return fetch(event.request).then(response =>
						caches.open(cacheName).then(cache => {
							console.log('[Service Worker] Caching new resource: ' + event.request.url)
							cache.put(event.request, response.clone())
							return response
						}),
					)
				}
			}),
		)
	}
})

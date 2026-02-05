// Service Worker for PWA
const CACHE_NAME = 'foodstream-approval-v2.0.1';
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/app.html',
    '/css/custom.css',
    '/manifest.json',
    '/images/web-app-manifest-192x192.png',
    '/images/web-app-manifest-512x512.png',
    '/images/favicon-96x96.png'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_CACHE);
            })
            .catch((error) => {
                console.error('Cache installation failed:', error);
            })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
    );
    self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    // API requests - Network only
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    console.error('API request failed:', error);
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'Network error. Please check your connection.',
                            offline: true
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }
    
    // Static assets - Cache first, fallback to network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // Clone response
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    });
            })
            .catch(() => {
                // Return offline page if available
                return caches.match('/offline.html');
            })
    );
});

// Push notification
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/images/web-app-manifest-192x192.png',
        badge: '/images/favicon-96x96.png',
        vibrate: [200, 100, 200],
        tag: 'payment-approval',
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification('FoodStream Approvals', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-vouchers') {
        event.waitUntil(syncVouchers());
    }
});

async function syncVouchers() {
    // Implement voucher sync logic
    console.log('Syncing vouchers in background');
}

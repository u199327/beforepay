// Retire old demo caches so mobile clients receive the current application.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('beforepay-')).map(key => caches.delete(key)))).then(() => self.registration.unregister()).then(() => self.clients.claim()))
})

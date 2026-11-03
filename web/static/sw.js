// Service worker : met l'application en cache pour l'usage hors ligne.
// La liste PRECACHE est remplie à la compilation (scripts/precache.js).
const VERSION = '__VERSION__';
const PRECACHE = /*__PRECACHE__*/ [];
const CACHE = `copro-${VERSION}`;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', ...PRECACHE])).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== self.location.origin) return;
	// Données et IA : toujours en direct (la copie hors ligne est dans IndexedDB)
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ia/')) return;

	// Navigation : réseau d'abord, sinon l'application en cache
	if (req.mode === 'navigate') {
		event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
		return;
	}

	// Fichiers de l'application : cache d'abord
	event.respondWith(
		caches.match(req).then(
			(enCache) =>
				enCache ||
				fetch(req).then((rep) => {
					if (rep.ok) {
						const copie = rep.clone();
						caches.open(CACHE).then((c) => c.put(req, copie));
					}
					return rep;
				})
		)
	);
});

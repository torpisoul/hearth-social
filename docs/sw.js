const CACHE = "hearth-shell-v1";
const APP_URL = new URL('./live.html', self.registration.scope).href;
self.addEventListener('push', event => {
  let payload={};
  try { payload=event.data?.json() || {}; } catch {}
  const update=payload.kind==='update';
  const body=update ? (payload.mode==='daily' ? 'A quiet moment to check in with your people, whenever you’re ready.' :
    payload.mode==='hourly' ? 'A few things have arrived in Hearth. Come by whenever you like.' :
    'Something new is waiting in Hearth. There’s no hurry.') : 'Your test notification arrived. Come by whenever you like.';
  // Fixed copy and destination: no private content or caller-controlled links.
  event.waitUntil(self.registration.showNotification('A little note from Hearth', {
    body,
    icon: new URL('./icons/hearth-192.png', self.registration.scope).href,
    tag: update ? 'hearth-updates' : 'hearth-test', data: {url: APP_URL}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows => {
    const open = windows.find(client => client.url.startsWith(self.registration.scope));
    if (open) { await open.navigate(APP_URL); return open.focus(); }
    return self.clients.openWindow(APP_URL);
  }));
});
const SHELL = ["./", "./live.html", "./manifest.webmanifest", "./styles/hearth.css", "./styles/live.css"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./live.html"))));
});

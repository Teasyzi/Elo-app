/* Elo PWA + Firebase Cloud Messaging background notifications */
const CACHE='elo-v32-app-shell-store-ux';
const CORE=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;

  // Navegações usam network-first para novas versões do Elo aparecerem sem
  // o usuário ficar preso ao HTML antigo do cache. Demais assets seguem cache-first.
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{
      const copy=r.clone(); caches.open(CACHE).then(cache=>cache.put('./index.html',copy)); return r;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
    const copy=r.clone(); caches.open(CACHE).then(cache=>cache.put(e.request,copy)); return r;
  })));
});

// Firebase Messaging uses this service worker when the PWA is in the background
// or completely closed. The Cloudflare Worker sends the actual FCM message.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAExc0XnqS2MjL3bTmvNNx2CnBbziiyJds',
  authDomain: 'elo-app-82e6e.firebaseapp.com',
  projectId: 'elo-app-82e6e',
  storageBucket: 'elo-app-82e6e.firebasestorage.app',
  messagingSenderId: '107299510923',
  appId: '1:107299510923:web:eb9c8b550ba4ecb3bc528e'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  // O Cloudflare Worker envia DATA-ONLY para impedir que o FCM/Chrome
  // crie uma segunda notificação automaticamente.
  const data = payload.data || {};
  const title = data.title || 'Elo 💕';
  const body = data.body || 'Você tem uma novidade do seu amor.';
  const icon = './icons/icon-192.png';

  const notificationId =
    data.notificationId ||
    `${data.type || 'elo'}-${Date.now()}`;

  return self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,

    // Um identificador por notificação evita duplicação e permite que
    // uma atualização real volte a alertar o usuário.
    tag: `elo-${notificationId}`,
    renotify: true,

    // Melhor esforço para Android/Web Push. O SO ainda decide se exibirá
    // banner/heads-up conforme as configurações do canal do navegador/PWA.
    silent: false,
    vibrate: [220, 100, 220],
    requireInteraction: false,
    timestamp: Date.now(),

    data: {
      ...data,
      url: data.url || './index.html'
    }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './index.html';
  event.waitUntil((async()=>{
    const clientsList = await clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        try { await client.navigate(target); } catch (_) {}
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

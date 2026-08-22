/* Elo PWA + Firebase Cloud Messaging background notifications */

const CACHE = 'elo-v33-6-mission-review-hotfix';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* =========================================================
   INSTALAÇÃO / CACHE
   ========================================================= */

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* =========================================================
   CARREGAMENTO DOS ARQUIVOS
   ========================================================= */

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não interfere em recursos externos.
  if (url.origin !== location.origin) return;

  /*
   * Para navegação sempre tentamos buscar a versão mais nova.
   * Isso evita o Elo ficar preso em um index.html antigo.
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store'
      })
        .then(response => {
          const copy = response.clone();

          caches
            .open(CACHE)
            .then(cache => cache.put('./index.html', copy));

          return response;
        })
        .catch(() => caches.match('./index.html'))
    );

    return;
  }

  /*
   * Para os demais arquivos:
   * cache primeiro -> internet caso não esteja armazenado.
   */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        const copy = response.clone();

        caches
          .open(CACHE)
          .then(cache => cache.put(event.request, copy));

        return response;
      });
    })
  );
});

/* =========================================================
   FIREBASE CLOUD MESSAGING
   ========================================================= */

importScripts(
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js'
);

importScripts(
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyAExc0XnqS2MjL3bTmvNNx2CnBbziiyJds',
  authDomain: 'elo-app-82e6e.firebaseapp.com',
  projectId: 'elo-app-82e6e',
  storageBucket: 'elo-app-82e6e.firebasestorage.app',
  messagingSenderId: '107299510',
  appId: '1:107299510:web:SEU_APP_ID'
});

const messaging = firebase.messaging();

/* =========================================================
   NOTIFICAÇÕES EM SEGUNDO PLANO
   ========================================================= */

messaging.onBackgroundMessage(payload => {
  console.log(
    '[Elo] Notificação recebida em segundo plano:',
    payload
  );

  /*
   * Se o FCM já trouxe uma seção "notification",
   * o navegador normalmente cria a notificação sozinho.
   *
   * Criar outra aqui poderia gerar notificações duplicadas.
   */
  if (payload.notification) {
    return;
  }

  const data = payload.data || {};

  const title =
    data.title ||
    'Elo ❤️';

  const body =
    data.body ||
    'Você tem uma novidade no Elo.';

  const options = {
    body,

    icon: './icons/icon-192.png',

    badge: './icons/icon-192.png',

    tag:
      data.tag ||
      data.type ||
      'elo-notification',

    renotify: true,

    silent: false,

    vibrate: [
      220,
      100,
      220
    ],

    data: {
      ...data,

      url:
        data.url ||
        './'
    }
  };

  return self.registration.showNotification(
    title,
    options
  );
});

/* =========================================================
   CLIQUE NA NOTIFICAÇÃO
   ========================================================= */

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const notificationData =
    event.notification.data || {};

  const destination =
    notificationData.url || './';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      .then(windowClients => {
        /*
         * Se o Elo já estiver aberto,
         * focamos a janela existente.
         */
        for (const client of windowClients) {
          if ('focus' in client) {
            return client.focus();
          }
        }

        /*
         * Caso contrário abre o Elo.
         */
        if (clients.openWindow) {
          return clients.openWindow(destination);
        }
      })
  );
});

/* =========================================================
   ATUALIZAÇÃO MANUAL DO SERVICE WORKER
   ========================================================= */

self.addEventListener('message', event => {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
  }
});
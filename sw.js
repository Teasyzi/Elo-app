/* Elo PWA + Firebase Cloud Messaging background notifications */

const CACHE = 'elo-v34-social-friends-base';

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

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

/* =========================================================
   ATIVAÇÃO / LIMPEZA DE CACHE ANTIGO
   ========================================================= */

self.addEventListener('activate', e => {
  e.waitUntil(
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
   CARREGAMENTO DO APP
   ========================================================= */

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Não interfere em recursos externos.
  if (url.origin !== location.origin) return;

  /*
   * Para navegação usamos NETWORK FIRST.
   *
   * Isso evita que o Elo fique preso em um index.html antigo
   * depois de uma atualização.
   */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, {
        cache: 'no-store'
      })
        .then(response => {
          const copy = response.clone();

          caches
            .open(CACHE)
            .then(cache =>
              cache.put(
                './index.html',
                copy
              )
            );

          return response;
        })
        .catch(() =>
          caches.match('./index.html')
        )
    );

    return;
  }

  /*
   * Demais arquivos:
   * CACHE FIRST.
   */
  e.respondWith(
    caches
      .match(e.request)
      .then(cached => {
        if (cached) {
          return cached;
        }

        return fetch(e.request)
          .then(response => {
            const copy =
              response.clone();

            caches
              .open(CACHE)
              .then(cache =>
                cache.put(
                  e.request,
                  copy
                )
              );

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
  apiKey:
    'AIzaSyAExc0XnqS2MjL3bTmvNNx2CnBbziiyJds',

  authDomain:
    'elo-app-82e6e.firebaseapp.com',

  projectId:
    'elo-app-82e6e',

  storageBucket:
    'elo-app-82e6e.firebasestorage.app',

  messagingSenderId:
    '107299510923',

  appId:
    '1:107299510923:web:eb9c8b550ba4ecb3bc528e'
});

const messaging =
  firebase.messaging();

/* =========================================================
   PUSH EM SEGUNDO PLANO
   ========================================================= */

messaging.onBackgroundMessage(
  payload => {

    /*
     * O Cloudflare Worker envia DATA-ONLY.
     *
     * Assim o Chrome/FCM não cria uma segunda
     * notificação automaticamente.
     */
    const data =
      payload.data || {};

    const title =
      data.title ||
      'Elo 💕';

    const body =
      data.body ||
      'Você tem uma novidade do seu amor.';

    const icon =
      './icons/icon-192.png';

    const notificationId =
      data.notificationId ||
      `${
        data.type ||
        'elo'
      }-${Date.now()}`;

    return self.registration
      .showNotification(
        title,
        {
          body,

          icon,

          badge:
            icon,

          /*
           * Um identificador diferente para
           * cada notificação.
           */
          tag:
            `elo-${notificationId}`,

          /*
           * Permite alertar novamente caso
           * a mesma tag seja atualizada.
           */
          renotify:
            true,

          /*
           * Melhor esforço para não ser
           * considerada silenciosa.
           *
           * Android/Chrome ainda possuem
           * controle final sobre som e
           * heads-up.
           */
          silent:
            false,

          vibrate: [
            220,
            100,
            220
          ],

          requireInteraction:
            false,

          timestamp:
            Date.now(),

          data: {
            ...data,

            url:
              data.url ||
              './index.html'
          }
        }
      );
  }
);

/* =========================================================
   CLIQUE NA NOTIFICAÇÃO
   ========================================================= */

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const target =
      event.notification
        .data
        ?.url ||
      './index.html';

    event.waitUntil(
      (
        async () => {

          const clientsList =
            await clients.matchAll({
              type:
                'window',

              includeUncontrolled:
                true
            });

          /*
           * Se o Elo já estiver aberto,
           * focamos a janela existente.
           */
          for (
            const client
            of clientsList
          ) {

            if (
              'focus' in client
            ) {

              await client.focus();

              try {
                await client.navigate(
                  target
                );
              } catch (_) {}

              return;
            }
          }

          /*
           * Caso contrário,
           * abre uma nova janela do Elo.
           */
          if (
            clients.openWindow
          ) {
            await clients.openWindow(
              target
            );
          }

        }
      )()
    );
  }
);

/* =========================================================
   ATUALIZAÇÃO DO SERVICE WORKER
   ========================================================= */

self.addEventListener(
  'message',
  event => {

    if (
      event.data &&
      event.data.type ===
        'SKIP_WAITING'
    ) {
      self.skipWaiting();
    }

  }
);
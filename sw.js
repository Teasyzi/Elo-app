/* Elo PWA + Firebase Cloud Messaging background notifications */
const CACHE = 'elo-v36-12-rc6-session-restore-20260904-2045';
const CORE=[
  './',
  './index.html',
  './app.js?v=36.11.8',
  './v36-11.js?v=36.11.8',
  './app-fluidity.js?v=36.11.8',
  './app-fluidity.js?v=36.12-rc6',
  './android-rc2-guard.js',
  './android-distribution-v36-12.js',
  './app-fluidity-core-v36-11-14.js',
  './app-fluidity-hotfix-v36-11-16.js',
  './app-fluidity-hotfix-v36-11-17.js',
  './app-fluidity-hotfix-v36-11-18.js',
  './app-fluidity-hotfix-v36-11-19.js',
  './app-fluidity-hotfix-v36-11-20.js',
  './app-fluidity-hotfix-v36-11-22.js',
  './app-fluidity-hotfix-v36-11-27.js',
  './app-fluidity-hotfix-v36-12-theme-exit.js',
  './app-fluidity-hotfix-v36-12-session-restore.js',
  './app-fluidity-hotfix-v36-12-login-stability.js',
  './tailwind.css?v=36.11.8',
  './styles.css?v=36.11.8',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/android-version.json')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;}).catch(()=>caches.match('./index.html')));return;
  }
  if(/\.(?:js|css)$/.test(url.pathname)){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request)));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;})));
});

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyAExc0XnqS2MjL3bTmvNNx2CnBbziiyJds',authDomain:'elo-app-82e6e.firebaseapp.com',projectId:'elo-app-82e6e',storageBucket:'elo-app-82e6e.firebasestorage.app',messagingSenderId:'107299510923',appId:'1:107299510923:web:eb9c8b550ba4ecb3bc528e'});
const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const notification=payload.notification||{};
  const data=payload.data||{};
  const title=notification.title||data.title||'Elo';
  const options={body:notification.body||data.body||'',icon:data.icon||'./icons/icon-192.png',badge:'./icons/icon-192.png',data:{url:data.url||'./'},tag:data.tag||undefined,renotify:true};
  return self.registration.showNotification(title,options);
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification?.data?.url||'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client){client.navigate(target);return client.focus();}}return clients.openWindow?clients.openWindow(target):null;}));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});

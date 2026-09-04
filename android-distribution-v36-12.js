// Elo V36.12 RC2 · distribuição Android + migração PWA → APK sem push duplicado.
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ANDROID_RELEASE = { versionName: '0.9.1-rc2', versionCode: 36 };
const REMOTE_MANIFEST = 'https://raw.githubusercontent.com/Teasyzi/Elo-app/main/android-version.json';
const isNative = !!window.Capacitor?.isNativePlatform?.();
const isAndroidWeb = !isNative && /Android/i.test(navigator.userAgent || '');
const isStandalone = !isNative && (window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true);
const PROFILE_POLL_MS = 1200;
let bannerNode = null;
let profileHandledForUid = '';
let cleanupTimer = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function removeBanner() {
  bannerNode?.remove();
  bannerNode = null;
}

function showBanner({title, text, primaryLabel, primaryHref, primaryAction, secondaryLabel, secondaryAction, tone='pink'}) {
  removeBanner();
  const wrap = document.createElement('div');
  wrap.id = 'elo-android-distribution-banner';
  wrap.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(5.9rem + env(safe-area-inset-bottom));z-index:2147483000;width:min(92vw,430px);font-family:Inter,system-ui,sans-serif;';
  const accent = tone === 'green' ? '#10b981' : '#db2777';
  wrap.innerHTML = `<div style="background:rgba(15,23,42,.98);border:1px solid ${accent}55;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.45);padding:14px;color:#fff;backdrop-filter:blur(18px)">
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div style="width:42px;height:42px;border-radius:14px;background:${accent}1c;color:${accent};display:grid;place-items:center;font-size:22px;flex:0 0 auto">📲</div>
      <div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:900;line-height:1.2">${esc(title)}</div><div style="font-size:10px;color:#94a3b8;line-height:1.45;margin-top:4px">${esc(text)}</div></div>
      <button data-close style="border:0;background:transparent;color:#64748b;font-size:18px;padding:0 2px;cursor:pointer">×</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      ${primaryLabel ? `<${primaryHref ? 'a' : 'button'} data-primary ${primaryHref ? `href="${esc(primaryHref)}" target="_blank" rel="noopener"` : ''} style="flex:1;min-width:150px;text-align:center;text-decoration:none;border:0;border-radius:13px;background:${accent};color:white;font-size:11px;font-weight:900;padding:11px 13px;cursor:pointer">${esc(primaryLabel)}</${primaryHref ? 'a' : 'button'}>` : ''}
      ${secondaryLabel ? `<button data-secondary style="flex:1;min-width:130px;border:1px solid #334155;border-radius:13px;background:#0f172a;color:#cbd5e1;font-size:10px;font-weight:900;padding:10px 12px;cursor:pointer">${esc(secondaryLabel)}</button>` : ''}
    </div>
  </div>`;
  wrap.querySelector('[data-close]')?.addEventListener('click', removeBanner);
  const primary = wrap.querySelector('[data-primary]');
  if (primaryAction && primary) primary.addEventListener('click', primaryAction);
  const secondary = wrap.querySelector('[data-secondary]');
  if (secondaryAction && secondary) secondary.addEventListener('click', secondaryAction);
  document.body.appendChild(wrap);
  bannerNode = wrap;
}

async function fetchManifest(source = null) {
  const url = source || (isNative ? REMOTE_MANIFEST : new URL('./android-version.json', location.href).href);
  try {
    const sep = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${sep}t=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) return null;
    return await response.json();
  } catch (_) { return null; }
}

async function firebaseContext() {
  for (let i = 0; i < 30; i++) {
    const user = window.currentUser;
    if (user?.uid && getApps().length) return {user, db:getFirestore(getApp())};
    await sleep(PROFILE_POLL_MS);
  }
  return null;
}

async function getProfileState(ctx) {
  const snap = await getDocs(collection(ctx.db, 'userProfiles', ctx.user.uid, 'fcmTokens'));
  let nativeTokens = 0;
  snap.forEach(tokenDoc => {
    const platform = String(tokenDoc.data()?.platform || 'web').toLowerCase();
    if (platform === 'android' || platform === 'native') nativeTokens++;
  });
  return {nativeTokens};
}

async function waitForNativeRegistration(ctx) {
  for (let i = 0; i < 15; i++) {
    try {
      const state = await getProfileState(ctx);
      if (state.nativeTokens > 0) return true;
    } catch (_) {}
    await sleep(1000);
  }
  return false;
}

async function removeAndroidWebPushTokens(db, uid) {
  const snap = await getDocs(collection(db, 'userProfiles', uid, 'fcmTokens'));
  const deletions = [];
  snap.forEach(tokenDoc => {
    const data = tokenDoc.data() || {};
    const platform = String(data.platform || 'web').toLowerCase();
    const ua = String(data.userAgent || '');
    if (platform === 'web' && /Android/i.test(ua)) deletions.push(deleteDoc(tokenDoc.ref));
  });
  if (deletions.length) await Promise.allSettled(deletions);
  return deletions.length;
}

async function setAndroidPrimary(ctx) {
  const registered = await waitForNativeRegistration(ctx);
  if (!registered) {
    console.info('[Elo] Push nativo ainda não registrado; PWA Android foi preservado.');
    return false;
  }
  await setDoc(doc(ctx.db, 'userProfiles', ctx.user.uid), {
    pushPrimaryPlatform: 'android',
    pushPrimaryUpdatedAt: Date.now(),
    androidAppVersionName: ANDROID_RELEASE.versionName,
    androidAppVersionCode: ANDROID_RELEASE.versionCode
  }, {merge:true});
  await removeAndroidWebPushTokens(ctx.db, ctx.user.uid);
  return true;
}

async function keepPwaPushSuppressed(ctx) {
  clearInterval(cleanupTimer);
  const run = () => removeAndroidWebPushTokens(ctx.db, ctx.user.uid).catch(()=>{});
  await run();
  cleanupTimer = setInterval(run, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); }, {passive:true});
}

async function activatePwaNotifications(ctx) {
  try {
    await setDoc(doc(ctx.db, 'userProfiles', ctx.user.uid), {
      pushPrimaryPlatform: 'web',
      pushPrimaryUpdatedAt: Date.now()
    }, {merge:true});
  } catch (_) {}
  clearInterval(cleanupTimer);
  removeBanner();
  try { await window.openNotificationPermissionPrompt?.({manual:true}); } catch (_) {}
}

async function handleAccountMigration() {
  const ctx = await firebaseContext();
  if (!ctx || profileHandledForUid === ctx.user.uid) return;
  profileHandledForUid = ctx.user.uid;

  if (isNative) {
    try { await setAndroidPrimary(ctx); }
    catch (error) { console.warn('Elo Android: migração de push:', error); }
    return;
  }

  if (!isAndroidWeb) return;
  try {
    const profileSnap = await getDoc(doc(ctx.db, 'userProfiles', ctx.user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() || {} : {};
    const state = await getProfileState(ctx);
    if (profile.pushPrimaryPlatform === 'android' || state.nativeTokens > 0) {
      await keepPwaPushSuppressed(ctx);
      showBanner({
        title:'Elo Android é seu app principal',
        text:'As notificações deste PWA foram pausadas para evitar duplicidade. Você pode remover este atalho antigo da tela inicial quando quiser.',
        primaryLabel:'Entendi',
        primaryAction:removeBanner,
        secondaryLabel:'Usar notificações neste PWA',
        secondaryAction:()=>activatePwaNotifications(ctx),
        tone:'green'
      });
    }
  } catch (error) { console.warn('Elo PWA: estado Android:', error); }
}

async function handleDistribution() {
  if (isNative) {
    const manifest = await fetchManifest(REMOTE_MANIFEST);
    if (manifest?.available && Number(manifest.versionCode || 0) > ANDROID_RELEASE.versionCode && manifest.downloadUrl) {
      showBanner({
        title:`Atualização ${manifest.versionName || 'nova'} disponível`,
        text:Array.isArray(manifest.changes) && manifest.changes.length ? String(manifest.changes[0]) : 'Há uma nova versão do Elo para Android.',
        primaryLabel:'Baixar atualização',
        primaryHref:manifest.downloadUrl,
        secondaryLabel:'Agora não',
        secondaryAction:removeBanner
      });
    }
    return;
  }

  if (!isAndroidWeb) return;
  const manifest = await fetchManifest();
  if (!manifest?.available || !manifest.downloadUrl) return;
  const text = isStandalone
    ? 'Você está usando o Elo instalado pelo navegador. Instale o APK e, depois de abrir o app Android, remova este atalho antigo para evitar dois ícones. As notificações serão migradas automaticamente.'
    : 'Instale o Elo para Android para ter notificações nativas e melhor integração com o aparelho.';
  showBanner({
    title:`Elo para Android ${manifest.versionName || ''}`.trim(),
    text,
    primaryLabel:'Baixar Elo para Android',
    primaryHref:manifest.downloadUrl,
    primaryAction:()=>localStorage.setItem('elo_android_apk_downloaded_at', String(Date.now())),
    secondaryLabel:isStandalone ? 'Continuar no PWA' : 'Agora não',
    secondaryAction:removeBanner
  });
}

window.eloAndroidDistribution = {
  release: ANDROID_RELEASE,
  check: handleDistribution,
  migrateAccount: handleAccountMigration
};

setTimeout(handleDistribution, 1800);
setTimeout(handleAccountMigration, 2600);
window.addEventListener('elo:auth-ready', handleAccountMigration);

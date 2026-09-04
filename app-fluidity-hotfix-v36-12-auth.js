// Elo V36.12 RC2 · recuperação robusta de autenticação no Chrome/PWA.
// O app principal usa popup no Web. Aqui tornamos a sessão explícita, evitamos popup
// duplicado e recuperamos o coupleId quando o Auth conclui antes do Firestore.
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const isNative = !!window.Capacitor?.isNativePlatform?.();
let recovering = false;
let originalGoogleLogin = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), {code:'elo/timeout'})), ms))
]);

function loading(active) {
  const boot = document.getElementById('loading-screen');
  if (!boot) return;
  if (active) {
    boot.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  } else {
    boot.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => boot.classList.add('hidden'), 220);
  }
}

function loginButton(active, text = '') {
  const button = document.getElementById('google-login-btn');
  const label = document.getElementById('google-login-label');
  if (button) button.disabled = !!active;
  if (label && text) label.textContent = text;
}

async function readProfileWithRetry(db, uid) {
  let lastError = null;
  for (const wait of [0, 500, 1200]) {
    if (wait) await sleep(wait);
    try {
      const snap = await withTimeout(getDoc(doc(db, 'userProfiles', uid)), 7000);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      lastError = error;
      console.warn('[Elo] perfil ainda indisponível; nova tentativa', error?.code || error);
    }
  }
  throw lastError || new Error('Perfil indisponível');
}

async function recoverAuthenticatedAccount(auth, db, user, {reload=true} = {}) {
  if (!user || user.isAnonymous || recovering) return false;
  recovering = true;
  loginButton(true, 'Recuperando seu Elo…');
  loading(true);
  try {
    const profile = await readProfileWithRetry(db, user.uid);
    if (profile?.coupleId) {
      const previous = localStorage.getItem('elo_coupleId') || '';
      localStorage.setItem('elo_coupleId', String(profile.coupleId));
      // Quando o callback principal já caiu de volta na tela de login, um reload limpo
      // faz o boot começar com Auth + coupleId prontos, sem abrir outro popup Google.
      if (reload && (previous !== String(profile.coupleId) || !document.getElementById('auth-screen')?.classList.contains('hidden'))) {
        location.reload();
        return true;
      }
      return true;
    }
    // Conta Google válida, porém sem Elo salvo: mantém a tela de criação/entrada utilizável.
    loading(false);
    document.getElementById('auth-screen')?.classList.remove('hidden');
    loginButton(false, 'Conta Google conectada');
    return true;
  } catch (error) {
    console.error('[Elo] recuperação da conta:', error);
    loading(false);
    document.getElementById('auth-screen')?.classList.remove('hidden');
    loginButton(false, 'Tentar carregar minha conta novamente');
    window.showToast?.('Google conectado, mas o Firebase demorou para carregar seu Elo. Toque novamente para tentar recuperar.', 'error');
    return false;
  } finally {
    recovering = false;
  }
}

function installGoogleLoginGuard(auth, db) {
  if (typeof window.signInWithGoogle !== 'function') return false;
  if (window.signInWithGoogle.__eloMobileRecovery) return true;
  originalGoogleLogin = window.signInWithGoogle;
  const wrapped = async () => {
    if (recovering) return;
    // O caso observado no Chrome mobile: Google já autenticou, mas o Firestore demorou e
    // o app voltou visualmente ao login. Nunca abrimos um segundo popup nessa situação.
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      return recoverAuthenticatedAccount(auth, db, auth.currentUser, {reload:true});
    }
    loginButton(true, 'Entrando com Google…');
    try {
      await setPersistence(auth, browserLocalPersistence);
      return await originalGoogleLogin();
    } finally {
      // onAuthStateChanged/recuperação assume daqui. Se o popup foi cancelado, libera o botão.
      setTimeout(() => { if (!recovering) loginButton(false); }, 600);
    }
  };
  wrapped.__eloMobileRecovery = true;
  window.signInWithGoogle = wrapped;
  return true;
}

function releaseBoot(auth) {
  loading(false);
  if (!auth.currentUser) loginButton(false, 'Continuar com Google');
}

async function boot() {
  if (isNative || !getApps().length) return;
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try { await setPersistence(auth, browserLocalPersistence); }
  catch (error) { console.warn('[Elo] persistência local do Auth:', error); }

  let tries = 0;
  const hook = setInterval(() => {
    tries++;
    if (installGoogleLoginGuard(auth, db) || tries >= 30) clearInterval(hook);
  }, 100);
  installGoogleLoginGuard(auth, db);

  const hardTimeout = setTimeout(() => releaseBoot(auth), 12000);
  onAuthStateChanged(auth, user => {
    clearTimeout(hardTimeout);
    window.currentUser = user || null;
    if (!user) {
      releaseBoot(auth);
      return;
    }
    if (user.isAnonymous) return;

    // Damos ao fluxo principal a primeira chance. Se depois de alguns segundos a tela de
    // login ainda estiver visível, Auth funcionou e o problema está na restauração do perfil.
    setTimeout(() => {
      const authScreen = document.getElementById('auth-screen');
      const main = document.getElementById('main-content');
      const loginVisible = authScreen && !authScreen.classList.contains('hidden');
      const appVisible = main && !main.classList.contains('hidden');
      if (loginVisible && !appVisible) recoverAuthenticatedAccount(auth, db, user, {reload:true});
      else releaseBoot(auth);
    }, 3200);
  }, error => {
    console.error('[Elo] estado do Firebase Auth:', error);
    clearTimeout(hardTimeout);
    releaseBoot(auth);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
else boot();

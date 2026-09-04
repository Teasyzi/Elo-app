// Elo V36.12 RC2 · recuperação de autenticação/boot para Chrome e PWA.
// O app principal já usa signInWithPopup no Web. Este hotfix impede que a camada
// "Preparando seu Elo" bloqueie a interface caso a restauração do perfil/Firestore demore.
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const isNative = !!window.Capacitor?.isNativePlatform?.();

function releaseBoot({ authenticated = false, delayed = false } = {}) {
  const boot = document.getElementById('loading-screen');
  if (boot) {
    boot.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => boot.classList.add('hidden'), 220);
  }

  const button = document.getElementById('google-login-btn');
  if (button) button.disabled = false;

  // Se a conta já autenticou, nunca deixe uma falha secundária esconder a tela inteira.
  if (authenticated && delayed) {
    const authScreen = document.getElementById('auth-screen');
    const main = document.getElementById('main-content');
    const mainVisible = main && !main.classList.contains('hidden');
    if (authScreen && !mainVisible) authScreen.classList.remove('hidden');
  }
}

function installAuthBootGuard() {
  if (isNative || !getApps().length) return;

  const auth = getAuth(getApp());
  let resolved = false;

  // Guarda global: mesmo uma leitura do Firestore pendurada não pode manter spinner infinito.
  const hardTimeout = setTimeout(() => {
    if (!resolved) releaseBoot({ authenticated: !!auth.currentUser, delayed: true });
  }, 10000);

  onAuthStateChanged(auth, user => {
    resolved = true;
    clearTimeout(hardTimeout);

    if (!user) {
      releaseBoot();
      return;
    }

    // O callback principal ainda restaura coupleId e abre os listeners. Damos uma janela curta
    // para isso, mas liberamos a camada visual mesmo se Firestore/rede estiverem lentos.
    setTimeout(() => releaseBoot({ authenticated: true, delayed: true }), 2500);
  }, error => {
    console.warn('[Elo] Guarda de autenticação:', error);
    resolved = true;
    clearTimeout(hardTimeout);
    releaseBoot({ authenticated: !!auth.currentUser, delayed: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAuthBootGuard, { once: true });
} else {
  installAuthBootGuard();
}

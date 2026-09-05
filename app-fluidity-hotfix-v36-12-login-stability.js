// Elo V36.12 RC6 · login Google Android com diagnóstico de etapas e recuperação explícita.
(() => {
  if (window.__eloNativeGoogleLoginStability) return;
  window.__eloNativeGoogleLoginStability = true;

  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (!isNative) return;

  let installed = false;
  let busy = false;
  const timeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms))
  ]);

  const hideLoading = () => document.getElementById('loading-screen')?.classList.add('hidden');
  const setButtonBusy = active => {
    const button = document.getElementById('google-login-btn');
    if (button) button.disabled = !!active;
  };

  const ensureStageNode = () => {
    let node = document.getElementById('elo-auth-stage');
    if (node) return node;
    const button = document.getElementById('google-login-btn');
    if (!button?.parentElement) return null;
    node = document.createElement('div');
    node.id = 'elo-auth-stage';
    node.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.18);font-size:11px;line-height:1.4;color:#cbd5e1;text-align:center;';
    button.parentElement.appendChild(node);
    return node;
  };

  window.eloSetAuthStage = (text, tone='info') => {
    const node = ensureStageNode();
    if (!node) return;
    node.textContent = text || '';
    node.style.display = text ? 'block' : 'none';
    node.style.borderColor = tone === 'error' ? 'rgba(248,113,113,.45)' : tone === 'ok' ? 'rgba(52,211,153,.38)' : 'rgba(148,163,184,.18)';
    node.style.color = tone === 'error' ? '#fecaca' : tone === 'ok' ? '#a7f3d0' : '#cbd5e1';
  };

  const friendlyError = error => {
    const text = `${String(error?.code || '')} ${String(error?.message || '')}`.toLowerCase();
    if (/cancel|canceled|cancelled|12501/.test(text)) return 'Login cancelado.';
    if (/credential firebase excedeu|firebase auth excedeu/.test(text)) return 'A conta Google foi escolhida, mas o Firebase não concluiu a autenticação.';
    if (/network|timeout|timed out|unavailable|excedeu/.test(text)) return 'A conexão demorou demais nesta etapa. Tente novamente.';
    if (/10|developer_error|configuration|oauth/.test(text)) return 'O login Google precisa ser revalidado nesta versão do Elo.';
    return 'Não foi possível entrar com Google. Tente novamente.';
  };

  async function nativeGoogleLogin() {
    if (busy) return;
    busy = true;
    setButtonBusy(true);
    hideLoading();
    window.eloSetAuthStage('Abrindo o seletor de contas do Google…');

    try {
      const nativeAuth = window.Capacitor?.Plugins?.FirebaseAuthentication;
      if (!nativeAuth?.signInWithGoogle) throw Object.assign(new Error('Plugin de autenticação Android indisponível.'), { code:'elo/native-auth-plugin-missing' });

      const result = await timeout(nativeAuth.signInWithGoogle({
        skipNativeAuth: true,
        useCredentialManager: false
      }), 15000, 'Google Sign-In');

      const idToken = result?.credential?.idToken || '';
      const accessToken = result?.credential?.accessToken || '';
      if (!idToken && !accessToken) throw new Error('O Google não devolveu uma credencial utilizável.');

      window.eloSetAuthStage('Conta escolhida. Conectando ao Firebase…');
      const [appApi, authApi] = await timeout(Promise.all([
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
      ]), 8000, 'Carregamento do Firebase Auth');
      if (!appApi.getApps().length) throw new Error('Firebase ainda não foi inicializado.');

      const firebaseAuth = authApi.getAuth(appApi.getApp());
      const credential = authApi.GoogleAuthProvider.credential(idToken || null, accessToken || null);
      const authResult = await timeout(authApi.signInWithCredential(firebaseAuth, credential), 10000, 'Firebase Auth');
      const user = authResult?.user || firebaseAuth.currentUser;
      if (!user?.uid) throw new Error('Firebase autenticou sem usuário válido.');

      window.eloSetAuthStage('Google autenticado. Restaurando seu Elo…', 'ok');
      try {
        await timeout(Promise.resolve(window.eloRecoverAuthenticatedSession?.(user, {immediate:true})), 12000, 'Restauração do Elo');
      } catch (restoreError) {
        console.warn('[Elo] Recuperação explícita após login:', restoreError);
      }

      setTimeout(() => {
        const main = document.getElementById('main-content');
        const visible = !!main && !main.classList.contains('hidden');
        if (!visible) {
          hideLoading();
          window.eloSetAuthStage('Conta Google autenticada. Ainda estamos tentando localizar seu Elo…');
          window.eloRecoverAuthenticatedSession?.(firebaseAuth.currentUser, {immediate:true, force:true}).catch?.(()=>{});
        }
      }, 4500);
    } catch (error) {
      console.error('[Elo] Login Google Android:', error);
      hideLoading();
      const message = friendlyError(error);
      window.eloSetAuthStage(message, 'error');
      try { window.showToast?.(message, /cancel/.test(message.toLowerCase()) ? 'info' : 'error'); } catch (_) {}
    } finally {
      busy = false;
      setButtonBusy(false);
    }
  }

  function installOverride() {
    if (installed) return true;
    if (typeof window.signInWithGoogle !== 'function') return false;
    const webLogin = window.signInWithGoogle;
    window.signInWithGoogle = () => window.Capacitor?.isNativePlatform?.() ? nativeGoogleLogin() : webLogin();
    installed = true;
    return true;
  }

  if (!installOverride()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (installOverride() || attempts >= 80) clearInterval(timer);
    }, 100);
  }
})();

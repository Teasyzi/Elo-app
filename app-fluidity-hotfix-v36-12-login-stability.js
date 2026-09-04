// Elo V36.12 RC6 · estabiliza o login Google no Android.
// O Credential Manager é o padrão do plugin, mas em alguns aparelhos pode demorar ou falhar.
// No APK usamos o fluxo legado do Google Sign-In (useCredentialManager:false), mantendo
// o Firebase Web SDK como fonte única de autenticação do app.
(() => {
  if (window.__eloNativeGoogleLoginStability) return;
  window.__eloNativeGoogleLoginStability = true;

  const isNative = !!window.Capacitor?.isNativePlatform?.();
  if (!isNative) return;

  let installed = false;
  let busy = false;

  const hideLoading = () => document.getElementById('loading-screen')?.classList.add('hidden');
  const showLoading = () => document.getElementById('loading-screen')?.classList.remove('hidden');
  const setButtonBusy = active => {
    const button = document.getElementById('google-login-btn');
    if (button) button.disabled = !!active;
  };

  const friendlyError = error => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    if (/cancel|canceled|cancelled|12501/.test(`${code} ${message}`)) return 'Login cancelado.';
    if (/network|timeout|timed out|unavailable/.test(`${code} ${message}`)) return 'O Google demorou para responder. Verifique a internet e tente novamente.';
    if (/10|developer_error|configuration|oauth/.test(`${code} ${message}`)) return 'O login Google precisa ser revalidado nesta versão do Elo.';
    return 'Não foi possível entrar com Google. Tente novamente.';
  };

  async function nativeGoogleLogin() {
    if (busy) return;
    busy = true;
    setButtonBusy(true);
    hideLoading();

    try {
      const nativeAuth = window.Capacitor?.Plugins?.FirebaseAuthentication;
      if (!nativeAuth?.signInWithGoogle) throw Object.assign(new Error('Plugin de autenticação Android indisponível.'), { code:'elo/native-auth-plugin-missing' });

      // Importante: false usa a implementação anterior do Google Sign-In e evita a
      // lentidão/intermitência observada com Credential Manager em alguns aparelhos.
      const result = await nativeAuth.signInWithGoogle({
        skipNativeAuth: true,
        useCredentialManager: false
      });

      const idToken = result?.credential?.idToken || '';
      const accessToken = result?.credential?.accessToken || '';
      if (!idToken && !accessToken) {
        throw Object.assign(new Error('O Google não devolveu uma credencial utilizável.'), { code:'elo/native-google-credential-missing' });
      }

      // Só mostramos o loading depois que o usuário já escolheu a conta. Assim a tela
      // não parece travada enquanto o seletor nativo do Google está abrindo.
      showLoading();

      const [appApi, authApi] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
      ]);
      if (!appApi.getApps().length) throw new Error('Firebase ainda não foi inicializado.');

      const firebaseAuth = authApi.getAuth(appApi.getApp());
      const credential = authApi.GoogleAuthProvider.credential(idToken || null, accessToken || null);
      await authApi.signInWithCredential(firebaseAuth, credential);

      // O onAuthStateChanged original continua responsável por restaurar o Elo e abrir a HOME.
      setTimeout(() => {
        const mainVisible = !document.getElementById('main-content')?.classList.contains('hidden');
        if (!mainVisible) hideLoading();
      }, 3500);
    } catch (error) {
      console.error('[Elo] Login Google Android:', error);
      hideLoading();
      try { window.showToast?.(friendlyError(error), /cancel/.test(String(error?.message||'').toLowerCase()) ? 'info' : 'error'); } catch (_) {}
    } finally {
      busy = false;
      setButtonBusy(false);
    }
  }

  function installOverride() {
    if (installed) return true;
    if (typeof window.signInWithGoogle !== 'function') return false;
    const webLogin = window.signInWithGoogle;
    window.signInWithGoogle = () => {
      if (!window.Capacitor?.isNativePlatform?.()) return webLogin();
      return nativeGoogleLogin();
    };
    installed = true;
    console.info('[Elo] Login Google Android estabilizado com Google Sign-In legado.');
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

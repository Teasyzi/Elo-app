// Elo V36.12 RC2 · impede o comparador legado (app.js ainda usa versionCode 34) de gerar falso positivo.
if (window.Capacitor?.isNativePlatform?.()) {
  localStorage.removeItem('elo_android_manifest_url');
}

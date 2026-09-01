# Elo APK 0.2 — correção do login Google

## O que mudou
- Android usa Google Sign-In nativo via `@capacitor-firebase/authentication`.
- A credencial nativa é convertida em sessão do Firebase Web SDK com `signInWithCredential`, preservando toda a lógica atual de Firestore/R2.
- PWA continua usando `signInWithPopup` como antes.
- `createElo` agora bloqueia com mensagem clara se não houver sessão autenticada.
- versão dos assets: `36.2.1`.
- CACHE do Service Worker também foi alterado.

## Antes de compilar
Mantenha seu arquivo real `android/app/google-services.json` no projeto. Ele não está incluído neste pacote.

Na raiz do Elo:
```powershell
npm.cmd install
npm.cmd run android:sync
```

Depois:
```powershell
cd android
.\gradlew.bat assembleDebug
```

O APK de debug ficará em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Firebase
O app Android deve estar cadastrado como `br.com.eloapp` e o SHA-1/SHA-256 do keystore usado no build devem estar registrados no Firebase. Após mudar SHAs, baixe novamente `google-services.json`.

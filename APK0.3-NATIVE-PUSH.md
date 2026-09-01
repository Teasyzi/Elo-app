# APK 0.3 — Push nativo Android

- Instala `@capacitor/push-notifications` v8.
- Android registra token FCM nativo no Firestore com `platform: android`.
- PWA continua registrando token Web com `platform: web`.
- Canais Android: `elo_messages`, `elo_gifts`, `elo_streak`, `elo_general`.
- Cloudflare Worker envia payload Android com prioridade alta e `channel_id`; Web permanece data-only.
- Toque em notificações roteia para Chat, Missões, Amigos ou Home/Chama.
- Android 13+ solicita permissão pelo plugin nativo.

## Depois de copiar os arquivos

```powershell
npm.cmd install
npm.cmd run android:sync
cd android
.\gradlew.bat assembleDebug
```

Publique também `cloudflare-worker/src/index.js` no Worker antes do teste completo entre dois aparelhos.

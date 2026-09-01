# Elo Android — preparação da V36.2

A V36.2 prepara a base para Capacitor 8, mas ainda não inclui a pasta `android/` gerada.

## Primeira vez neste PC

```powershell
npm install
npm run android:add
```

O segundo comando compila o Tailwind, prepara a pasta `www/` e cria o projeto Android.

Depois:

```powershell
npm run android:open
```

Isso abre o projeto no Android Studio.

## Nas próximas versões

```powershell
npm run android:open
```

O script recompila o CSS, copia os arquivos web para `www/`, sincroniza o projeto Android e abre o Android Studio.

## Atualizações do APK

`android-version.json` começa com `available:false`. Quando existir um APK assinado e hospedado, mudaremos para `true`, preencheremos `downloadUrl` e o app Android passará a comparar `versionCode`.

A chave de assinatura (`.keystore`) nunca deve ser enviada ao GitHub.

# Notificações do Elo

## 1. VAPID
No Firebase Console: Configurações do projeto > Cloud Messaging > Configuração da Web > Certificados de push da Web > Gerar par de chaves.

Copie a **chave pública** e substitua `COLE_SUA_CHAVE_PUBLICA_VAPID_AQUI` em `index.html`.

## 2. Ativar permissão
Depois de publicar em HTTPS, entre com Google e abra o sino > "Ativar notificações no aparelho".

## 3. Push em segundo plano
O arquivo `sw.js` já possui Firebase Messaging. Para enviar automaticamente notificações quando o app estiver em segundo plano/fechado, publique a Cloud Function em `functions/`.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:sendEloNotification
```

O envio automático por Cloud Functions exige o plano/billing compatível com Cloud Functions no projeto Firebase.

## 4. O que já gera notificações
- pedido de aprovação de missão;
- missão aprovada;
- check-in do parceiro;
- nova mensagem de chat;
- nova foto no chat.

As notificações também ficam salvas no Firestore e aparecem dentro do Elo, mesmo antes do push ser configurado.

## V11 - Preferências e VAPID

A chave pública VAPID do projeto foi configurada no `index.html`. O usuário pode abrir a Central de Notificações e tocar em **Configurar notificações** para ativar/desativar categorias: mensagens, missões, Chama, vouchers, momentos, conquistas, pergunta do dia e sistema.

A permissão do navegador só é solicitada quando o usuário toca em **Ativar notificações no aparelho**. Recusar não impede o uso do Elo; apenas desativa o push daquele navegador/dispositivo. As preferências são salvas em `userProfiles/{uid}.notificationPrefs`.

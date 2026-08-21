# Elo Push Worker — sem Firebase Blaze

Este Worker envia notificações FCM usando o plano gratuito do Cloudflare Workers. Nenhuma chave privada fica no `index.html`.

## 1. Criar uma conta gratuita no Cloudflare
Acesse Workers & Pages e crie/ative o plano Free.

## 2. Criar uma Service Account do Firebase/Google
No Google Cloud Console do projeto `elo-app-82e6e`, crie/baixe uma chave JSON de Service Account com acesso ao Firestore e Firebase Cloud Messaging.

NÃO coloque esse JSON dentro do site ou deste ZIP público.

## 3. Instalar e publicar
No terminal, dentro desta pasta:

```bash
npm install
npx wrangler login
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

Quando o comando pedir o valor do Secret, cole TODO o conteúdo JSON da Service Account em uma única entrada.

Depois publique:

```bash
npm run deploy
```

O terminal mostrará uma URL parecida com:

`https://elo-push.SEUSUBDOMINIO.workers.dev`

## 4. Ligar o Elo ao Worker
Abra o `index.html` da raiz e procure por:

`const ELO_PUSH_ENDPOINT = "COLE_AQUI_A_URL_DO_WORKER/push";`

Troque por, por exemplo:

`const ELO_PUSH_ENDPOINT = "https://elo-push.SEUSUBDOMINIO.workers.dev/push";`

Publique novamente os arquivos do PWA.

## Segurança
O Worker:
- exige o Firebase ID Token do usuário que está enviando;
- valida a assinatura e o projeto do token;
- confirma no Firestore que a notificação foi criada pelo mesmo usuário;
- confirma que remetente e destinatário pertencem ao mesmo Elo;
- lê os tokens FCM do destinatário no servidor;
- respeita as preferências de notificação;
- marca a notificação para reduzir disparos duplicados;
- mantém a Service Account como Secret do Cloudflare.

## Teste
1. Nos dois aparelhos, instale/abra o Elo via HTTPS.
2. Em cada aparelho: Central de Notificações > Ativar notificações no aparelho.
3. Feche o Elo no aparelho B.
4. Envie uma mensagem pelo aparelho A.
5. O aparelho B deve receber a notificação do sistema.

Observação: em iPhone/iPad, push para PWA exige o app adicionado à Tela de Início e uma versão compatível do iOS/iPadOS.

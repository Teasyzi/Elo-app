# Elo V17 — Mobile PWA

## Novidades

- Mantém o chat com envio contínuo e foco automático do V16.
- Mantém imagens no chat e Nossos Momentos sem Firebase Storage.
- Substitui Firebase Cloud Functions por Cloudflare Workers para push em segundo plano sem exigir Firebase Blaze.
- O FCM continua sendo usado para entregar a notificação ao aparelho/PWA.
- O disparador externo usa autenticação Firebase e Service Account guardada como Secret no Worker.

## Para ativar notificações com o app fechado

1. Entre em `cloudflare-worker/`.
2. Siga `cloudflare-worker/README.md` para publicar o Worker no plano gratuito.
3. Copie a URL final do Worker.
4. No `index.html`, procure `ELO_PUSH_ENDPOINT` e substitua o placeholder pela URL terminando em `/push`.
5. Publique o PWA por HTTPS.
6. Em cada aparelho, abra a Central de Notificações e toque em **Ativar notificações no aparelho**.

Não é necessário fazer deploy de Firebase Functions e não há pasta `functions/` nesta versão.

## Firebase

Projeto configurado no frontend: `elo-app-82e6e`.
O VAPID público já está configurado no app. A chave privada da Service Account nunca deve ser colocada no frontend.

## PWA

No iPhone/iPad, instale pelo Safari usando **Compartilhar → Adicionar à Tela de Início**. Push web em iOS depende do PWA instalado e de uma versão compatível do sistema.


## Elo V18 — Conexão

Novidades desta versão:
- Data oficial de início do relacionamento, independente da data de criação do Elo.
- Contador correto de dias juntos e uso da data em retrospectivas.
- Pergunta do Dia com respostas ocultas até os dois responderem.
- Check-in diário de humor.
- Cápsula do Tempo com mensagens que só abrem na data escolhida.
- Reações em Nossos Momentos.
- Jogo Rápido com 3 modos: Isso ou Aquilo, Quem é mais provável? e Você me conhece?.
- Retrospectiva dos últimos 7 dias.
- Opção para ocultar conteúdo sensível das notificações push.
- Ao encerrar o Elo, a subcoleção `capsules` também é apagada.

### Data do relacionamento
O campo `relationshipStartDate` é salvo no documento do relacionamento no formato `YYYY-MM-DD`. O campo `createdAt` continua existindo apenas como data técnica de criação do Elo e não é usado no cálculo de dias juntos.

## Elo V19 — Chat Refresh

Melhorias do chat desta versão:
- Novo layout de conversa otimizado para celular e desktop.
- Bolhas com largura e espaçamento consistentes para mensagens curtas e longas.
- Fotos com tamanho previsível e melhor encaixe dentro da conversa.
- Cabeçalho do chat com foto do parceiro e estado online/digitando.
- Separadores automáticos de data: Hoje, Ontem e data da conversa.
- Campo de mensagem em textarea expansível, com Enter para enviar e Shift+Enter para quebrar linha no desktop.
- Preservação do rascunho e foco quando o Firestore atualiza a conversa.
- Ações de mensagem acessíveis no celular por botão de opções.
- Reações, responder, favoritar, fixar, editar e excluir continuam disponíveis.
- Indicador visual de enviado/lido mantido.


## Elo V20 — Messenger Chat

- Remove completamente os botões de ações da lateral das mensagens no celular.
- Segure uma mensagem para abrir Responder, Reagir, Favoritar, Fixar, Editar ou Excluir.
- Deslize a mensagem para a direita para responder rapidamente.
- Bolhas menores e mais naturais para textos curtos; sem largura mínima artificial.
- Agrupamento visual de mensagens consecutivas do mesmo remetente.
- Fotos com tamanho responsivo e horário sobreposto à mídia.
- Composer mais compacto e semelhante a apps de mensagens.
- Cabeçalho do chat mais leve, preservando foto e status online/digitando.
- Service Worker atualizado para `elo-v20-mobile` e navegação network-first, evitando que versões antigas do HTML fiquem presas no cache do PWA.

## V21 — correção de estabilidade do chat
- O listener em tempo real do Firestore não recria mais o campo de digitação.
- Mensagens, leitura e reações atualizam somente a lista de mensagens.
- O rascunho, foco, teclado e posição do cursor são preservados durante sincronizações.
- Atualizações do documento principal do Elo não desmontam o chat enquanto ele está aberto.


## V22 Stability
- Chat: botão Enviar não rouba foco; push e Sinergia não bloqueiam envio; visualViewport corrige teclado móvel.
- Notificações: Central agora inclui Diagnóstico (HTTPS, permissão, Service Worker, FCM token, Firestore e Worker).
- Ainda é necessário configurar a URL real em ELO_PUSH_ENDPOINT após publicar o Cloudflare Worker.

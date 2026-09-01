import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, increment, runTransaction, writeBatch, collection, getDocs, addDoc, query, where, orderBy, limit, startAfter, serverTimestamp, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
        import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAExc0XnqS2MjL3bTmvNNx2CnBbziiyJds",
            authDomain: "elo-app-82e6e.firebaseapp.com",
            projectId: "elo-app-82e6e",
            storageBucket: "elo-app-82e6e.firebasestorage.app",
            messagingSenderId: "107299510923",
            appId: "1:107299510923:web:eb9c8b550ba4ecb3bc528e"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        const isNativeApp = !!window.Capacitor?.isNativePlatform?.();
        const nativePlatform = isNativeApp ? (window.Capacitor.getPlatform?.() || 'native') : 'web';
        window.eloRuntime = { isNativeApp, platform: nativePlatform, isPWA: !isNativeApp && (window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true) };
        const messaging = isNativeApp ? null : getMessaging(app);
        // Gere a chave pública VAPID em Firebase Console > Configurações do projeto > Cloud Messaging > Configuração da Web.
        const FCM_VAPID_KEY = "BApsBO4ttWBy3UNlw-slGfsOejxggS41iSv3W54XFtA6UlbV60bdW1q9htRGKRlif3iNZMYNlnctdwo-ltRMQq4";
        // V17: endpoint gratuito do Cloudflare Worker que dispara o FCM sem Firebase Functions/Blaze.
        // Após publicar cloudflare-worker/, cole aqui a URL https://SEU-WORKER.workers.dev/push
        const ELO_PUSH_ENDPOINT = "https://elo-push.luisinfosu.workers.dev/push";
        const ELO_MEDIA_ENDPOINT = ELO_PUSH_ENDPOINT.replace(/\/push\/?$/, '');
        const messagingSupported = !isNativeApp && typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
        const DEFAULT_NOTIFICATION_PREFS = {
            messages: true,
            quests: true,
            streak: true,
            vouchers: true,
            moments: true,
            achievements: true,
            daily: true,
            system: true,
            hideContent: false
        };
        window.notificationPrefs = {...DEFAULT_NOTIFICATION_PREFS};

        const appId = "elo-app-v2"; 

        // Estados Globais
        window.currentUser = null;
        window.coupleId = localStorage.getItem('elo_coupleId') || null;
        window.coupleData = null;
        let activeTab = 'home';
        window.activeTab = activeTab;
        window.storeCategoryFilter = 'todos';
        window.storeSearchQuery = '';
        
        let unsubscribeSnapshot = null;
        let unsubscribeMessages = null;
        let chatMessages = [];
        let chatRecentInitialized = false;
        let chatHistoryCursor = null;
        let chatHasMoreHistory = true;
        let chatLoadingOlder = false;
        const CHAT_INITIAL_LIMIT = 40;
        const CHAT_HISTORY_PAGE = 30;
        const chatMediaObjectUrls = new Map();
        let chatAudioRecorder = null;
        let chatAudioStream = null;
        let chatAudioChunks = [];
        let chatAudioStartedAt = 0;
        let chatAudioTimer = null;
        let chatAudioMimeType = '';
        let chatInitialized = false;
        let chatForceBottomOnOpen = false;
        let chatUserAwayFromBottom = false;
        let chatNewMessagesWhileAway = 0;
        let chatRenderedMessageIds = new Set();
        let quickGameCreating = false;
        let chatUnreadCount = 0;
        // V36.2.2: páginas antigas carregadas ao subir não são mensagens novas.
        let chatSuppressNewMessageCounter = false;
        let chatLastSeenAt = Number(localStorage.getItem('elo_chat_last_seen') || 0);
        let chatReplyTo = null;
        let chatEditingId = null;
        let chatDraft = '';
        let chatShouldKeepFocus = false;
        let chatWasNearBottom = true;
        let typingTimer = null;
        let presenceTimer = null;
        let lastRelationshipRenderSignature = '';
        let unsubscribeNotifications = null;
        let unsubscribeMoments = null;

        // V35: Momentos deixam de baixar a galeria inteira de uma vez.
        const MOMENTS_PAGE_SIZE = 18;
        let momentsCache = [];
        let momentsLoadedCoupleId = '';
        let momentsOldestCursor = null;
        let momentsHasMore = true;
        let momentsHistoryLoaded = false;
        let momentsLoadingOlder = false;

        // V34/V35 · Amizades entre Elos
        const SOCIAL_CHAT_INITIAL_LIMIT = 40;
        const SOCIAL_CHAT_HISTORY_PAGE = 30;
        let socialView = 'list';
        let socialChatFriendId = '';
        let socialChatMessages = [];
        let unsubscribeSocialChat = null;
        let socialChatReady = false;
        let socialChatHistoryCursor = null;
        let socialChatHasMore = true;
        let socialChatLoadingOlder = false;
        let socialScrollRestore = null;

        let pushInitialized = false;
        let foregroundPushInitialized = false;
        let googlePhotoSyncedForCouple = '';
        // V36.2 · Ponte PWA → Android. Quando o primeiro APK existir, basta publicar
        // android-version.json no mesmo site com available=true e a URL do APK.
        const ELO_ANDROID_VERSION = { versionName:'0.0.0-web', versionCode:0 };
        const getAndroidVersionManifestUrl = () => {
            if (!isNativeApp) return new URL('./android-version.json', window.location.href).href;
            // Será definido no primeiro build Android real. Mantido centralizado para não espalhar URL pelo app.
            return localStorage.getItem('elo_android_manifest_url') || '';
        };
        const compareAndroidVersion = async ({silent=true}={}) => {
            const manifestUrl=getAndroidVersionManifestUrl(); if(!manifestUrl)return null;
            try{const sep=manifestUrl.includes('?')?'&':'?';const r=await fetch(`${manifestUrl}${sep}t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return null;const info=await r.json();if(!info?.available)return info;
                if(isNativeApp&&Number(info.versionCode||0)>Number(ELO_ANDROID_VERSION.versionCode||0)){
                    const required=Number(ELO_ANDROID_VERSION.versionCode||0)<Number(info.minimumVersionCode||0);
                    openGenericModal(`<div class="space-y-4"><div class="text-4xl">📲</div><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">Atualização do Elo</p><h3 class="text-xl font-black text-white">Versão ${escapeHTML(info.versionName||'nova')} disponível</h3></div>${Array.isArray(info.changes)&&info.changes.length?`<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-1">${info.changes.map(x=>`<p>• ${escapeHTML(x)}</p>`).join('')}</div>`:''}<a href="${escapeHTML(info.downloadUrl||'#')}" target="_blank" rel="noopener" class="block text-center w-full py-3.5 rounded-2xl bg-pink-600 text-white font-black">Baixar atualização</a>${required?'':'<button onclick="closeGenericModal()" class="w-full py-3 rounded-xl text-slate-400 text-xs font-black">Agora não</button>'}</div>`);
                }
                return info;
            }catch(e){if(!silent)showToast('Não foi possível verificar atualizações.','error');return null}
        };
        window.compareAndroidVersion=compareAndroidVersion;
        const chatReadWritePending = new Set();
        window.currentAvatarSeed = ''; // Seed global para a interface DiceBear

        // Formato: ID|Categoria|Título|Descrição|Preço
        const rawStoreItems = `
1|tarefas|Pular a Louça|O parceiro lava a louça hoje.|50
2|tarefas|Pular o Lixo|O parceiro tira o lixo hoje.|40
3|tarefas|Pular a Cama|O parceiro arruma a cama hoje.|40
4|tarefas|Pular a Varrição|O parceiro varre a casa hoje.|60
5|tarefas|Pular a Limpeza|Escolha uma pequena tarefa doméstica.|100
6|mimos|Café na Cama|Prepara e leva seu café na cama.|300
7|mimos|Água na Mão|O parceiro deve buscar sua bebida.|50
8|mimos|Lanchinho|Prepara ou compra um lanche para você.|150
9|mimos|Docinho|Ganhe seu doce favorito.|200
10|mimos|Chocolate|O parceiro deve aparecer com chocolate.|150
11|mimos|Sobremesa|Você escolhe a sobremesa de hoje.|200
12|mimos|Última Mordida|Direito à última mordida da sobremesa.|100
13|mimos|Última Batata|Ganha a última batata frita.|75
14|experiencias|Escolha do Jantar|Você decide o jantar.|150
15|experiencias|Delivery|O parceiro paga o próximo delivery.|500
16|experiencias|Pizza|Providenciar uma pizza.|500
17|experiencias|Hambúrguer|O parceiro paga um hambúrguer.|400
18|experiencias|Açaí|O parceiro paga seu próximo açaí.|300
19|mimos|Sorvete|Ganhe um sorvete escolhido por você.|250
20|mimos|Café Especial|O parceiro compra seu café favorito.|250
21|tarefas|Padaria|Busca café da manhã na padaria.|200
22|mimos|Lanchinho da Noite|Ganhe um lanche noturno.|250
23|mimos|Mimo Surpresa|Um pequeno mimo surpresa.|300
24|mimos|Flor|Ganhe uma flor.|200
25|mimos|Buquê|Ganhe um pequeno buquê.|600
26|lembrancas|Cartinha|O parceiro escreve uma carta.|400
27|lembrancas|Bilhetinho|Bilhete romântico à mão.|150
28|mimos|Elogio Extra|5 elogios sinceros.|100
29|lembrancas|Declaração|Uma declaração romântica.|200
30|mimos|Beijo Extra|Direito a 10 beijos extras.|100
31|mimos|Abraço Premium|Abraço de pelo menos 1 minuto.|150
32|mimos|Chamego|30 min de carinho e atenção.|300
33|mimos|Colinho|Direito a um período de colo.|250
34|mimos|Dengo|Um mimo escolhido por você.|300
35|mimos|Boa Noite VIP|Despedida especial antes de dormir.|150
36|mimos|Bom Dia VIP|Gesto romântico logo cedo.|150
37|mimos|Massagem Rápida|Massagem de 10 minutos.|300
38|mimos|Massagem Premium|Massagem de 30 minutos.|700
39|mimos|Massagem nos Pés|Massagem nos seus pés.|400
40|mimos|Cabeça nas Nuvens|Massagem relaxante na cabeça.|300
41|controle|Cobertor|O parceiro cuida do cobertor.|50
42|controle|Travesseiro VIP|Escolhe o melhor travesseiro.|75
43|controle|Lugar Favorito|Seu lugar favorito no sofá.|50
44|controle|Controle Absoluto|Você controla a TV.|200
45|controle|DJ do Carro|Você controla a música no carro.|75
46|controle|DJ da Casa|Você escolhe a playlist da casa.|100
47|controle|Filme à Escolha|Escolhe o filme sem discussão.|150
48|controle|Série à Escolha|Escolhe a série da noite.|150
49|controle|Jogo à Escolha|Escolhe o jogo do casal.|150
50|tarefas|Cama Garantida|O parceiro arruma a cama.|50
51|tarefas|Roupa Separada|O parceiro separa sua roupa.|100
52|mimos|Toalha Quentinha|Deixa sua toalha pronta.|150
53|tarefas|Chinelo Express|Busca seu chinelo.|50
54|tarefas|Celular Carregado|Deixa seu celular carregando.|50
55|mimos|Água Gelada|Bebida gelada na mão.|50
56|mimos|Cobertura VIP|Cuidar de você durante a noite.|500
57|tarefas|Dia de Preguiça|Passe livre de 1 tarefa.|150
58|tarefas|Domingo Preguiçoso|Sem tarefas no domingo.|400
59|tarefas|Passe Livre|1 tarefa para o parceiro.|200
60|tarefas|Passe Duplo|2 tarefas para o parceiro.|350
61|tarefas|Passe Triplo|3 tarefas para o parceiro.|500
62|tarefas|Folga Doméstica|Livre de tarefas por 1 dia.|600
63|tarefas|Folga Premium|Livre no fim de semana.|1200
64|controle|Rei/Rainha do Sofá|Atende pedidos no filme.|300
65|controle|Mordomo 1h|Pequenos pedidos por 1 hora.|800
66|mimos|Mimo Livre|Escolhe e realiza um mimo.|250
67|controle|Do Jeitinho|Escolhe como receber o mimo.|300
68|controle|Pedido Especial|Faz um pedido especial razoável.|500
69|mimos|Vale-Carinho|Sessão de carinho sem distrações.|300
70|mimos|Vale-Colinho|30 min de colo e carinho.|400
71|mimos|Vale-Beijo|Escolhe quando receber 10 beijos.|150
72|mimos|Vale-Abraço|5 abraços durante o dia.|200
73|lembrancas|Vale-Elogio|10 coisas que ama em você.|250
74|mimos|Vale-Mimo|Compra um pequeno presente.|500
75|mimos|Vale-Presente|Presente de valor combinado.|1000
76|experiencias|Jantar Delivery|Paga o delivery de hoje.|500
77|experiencias|Café na Rua|Paga um café para o casal.|500
78|experiencias|Sorvete a Dois|Passeio para tomar sorvete.|500
79|experiencias|Açaí a Dois|Paga saída para açaí.|500
80|experiencias|Hambúrguer a Dois|Jantar de hambúrguer.|700
81|experiencias|Pizza a Dois|Paga pizza para o casal.|700
82|experiencias|Pastelzinho|Passeio para comer pastel.|400
83|experiencias|Café da Manhã|Paga um café da manhã fora.|800
84|experiencias|Almoço Fora|Paga o próximo almoço.|1000
85|experiencias|Jantar Fora|Paga o próximo jantar.|1200
86|experiencias|Cinema|Paga uma sessão de cinema.|1000
87|experiencias|Cinema Premium|Cinema, pipoca e bebida.|1500
88|experiencias|Filme em Casa VIP|Noite de cinema em casa.|600
89|experiencias|Piquenique|Organiza um piquenique.|1200
90|experiencias|Passeio Surpresa|Passeio sem revelar destino.|1500
91|experiencias|Encontro Surpresa|Organiza um encontro completo.|2000
92|experiencias|Jantar Romântico|Organiza jantar romântico.|2000
93|experiencias|Jantar Luz Velas|Decoração e velas.|2500
94|experiencias|Noite Temática|Noite com tema escolhido.|2000
95|experiencias|Noite do Pijama|Pijama e filmes.|1000
96|experiencias|Acampamento na Sala|Monta cabana na sala.|1000
97|experiencias|Noite Sem Celular|Noite sem usar o celular.|1500
98|mimos|Dia de Spa|Dia de autocuidado em casa.|2000
99|experiencias|Spa Premium|Spa para o casal.|4000
100|mimos|Massagem Pro|Massagem profissional.|3000
101|mimos|Dia de Beleza|Cuidados pessoais.|2000
102|mimos|Príncipe/Princesa|Dia inteiro de mimos.|3000
103|epicos|Dia Perfeito|Dia baseado no que você gosta.|5000
104|experiencias|Passeio no Parque|Organiza ida ao parque.|500
105|experiencias|Pôr do Sol|Passeio para ver o pôr do sol.|600
106|experiencias|Nascer do Sol|Passeio ver nascer do sol.|800
107|experiencias|Praia|Dia de praia.|1500
108|experiencias|Praia VIP|Dia de praia com tudo organizado.|3000
109|experiencias|Piscina|Ganhe um dia de piscina.|1000
110|experiencias|Trilha|Organiza uma trilha.|1500
111|experiencias|Bicicleta|Passeio de bicicleta.|1000
112|experiencias|Boliche|Paga partida de boliche.|1500
113|experiencias|Karaokê|Paga noite de karaokê.|2000
114|experiencias|Fliperama|Paga sessão de jogos.|1500
115|experiencias|Kart|Paga corrida de kart.|2500
116|experiencias|Escape Room|Paga experiência escape room.|2500
117|experiencias|Parque Diversões|Dia de parque.|3000
118|experiencias|Roda-Gigante|Passeio na roda-gigante.|1500
119|experiencias|Teatro|Paga uma ida ao teatro.|2500
120|experiencias|Show|Ingresso para um show.|4000
121|experiencias|Museu|Visita cultural.|1000
122|experiencias|Dia de Turista|Ponto turístico para visitar.|1500
123|experiencias|Cidade Vizinha|Passeio para outra cidade.|2000
124|experiencias|Bate-Volta|Viagem de um dia.|3000
125|epicos|Viagem Curta|Um bate-volta ou fim de semana simples planejado pelo casal.|8000
126|epicos|Hotel|Uma noite em hotel.|5000
127|epicos|Hotel Premium|Noite em hotel especial.|10000
128|epicos|Pousada Romântica|Uma noite em pousada.|7500
129|epicos|Chalé|Escapada para um chalé.|8000
130|epicos|Cabana Sonhos|Noite romântica na cabana.|12000
131|epicos|Fim de Semana|Fim de semana completo.|7500
132|epicos|FDS Premium|Hospedagem + refeições + passeio.|15000
133|epicos|Road Trip|Viagem de carro.|10000
134|epicos|Road Trip Pro|Viagem maior de carro.|20000
135|epicos|Viagem Surpresa|Quem resgatar escolhe ou combina um destino e o parceiro ajuda a organizar.|15000
136|epicos|Viagem dos Sonhos|Começar a planejar grande viagem.|25000
137|epicos|Passaporte do Amor|Viagem internacional.|50000
138|epicos|Férias dos Sonhos|Férias completa.|100000
139|epicos|Lua de Mel 2.0|Viagem romântica especial.|75000
140|epicos|Experiência Inédita|Escolham uma atividade que nenhum dos dois tenha feito antes.|10000
141|buffs|Proteção Seq|Protege sua sequência por 1 dia.|300
142|buffs|Escudo Seq|Protege a sequência por 3 dias.|800
143|buffs|Escudo Supremo|Protege a sequência por 7 dias.|2000
144|buffs|Congelar Seq|Congela sua sequência por 24h.|500
145|buffs|Dobro de Moedas|Duplica moedas de uma recompensa.|500
146|buffs|Moeda Extra|Ganhe um bônus de moedas.|200
147|buffs|Bônus Surpresa|Receba um bônus aleatório.|300
148|buffs|Reroll|Troca missão diária por outra.|150
149|buffs|Reroll Premium|Troca qualquer desafio.|400
150|buffs|Pular Desafio|Pula sem perder sequência.|300
151|buffs|Pular Premium|Pula um desafio difícil.|700
152|buffs|Segunda Chance|Tente novamente missão falhada.|250
153|buffs|Perdão|Remove uma penalidade.|500
154|buffs|Anistia|Remove todas as penalidades.|1500
155|buffs|Moeda Protegida|Evita perder moedas na penalidade.|400
156|buffs|Imunidade|Proteção contra uma penalidade.|600
157|buffs|Imunidade 24h|Nenhuma penalidade em 24h.|800
158|buffs|Imunidade 7D|Proteção por uma semana.|3000
159|coringas|Roubo Permitido|Rouba pequenas moedas do parceiro.|500
160|coringas|Roubo Premium|Rouba grande quantia de moedas.|1000
161|coringas|Transferência Livre|Receba moedas do parceiro.|300
162|coringas|Presente Moedas|Parceiro transfere para você.|500
163|buffs|Taxa Zero|Transferência sem custo.|200
164|buffs|Bônus Casal|Bônus de moedas para os dois.|800
165|buffs|Modo Dobrado|Próxima recompensa do casal dobra.|1000
166|buffs|Combo Amor|Três recompensas com bônus.|1500
167|buffs|XP Extra|Ganhe XP adicional.|300
168|buffs|XP Dobrado|Dobre o XP de uma atividade.|600
169|buffs|Level Up|Grande bônus de experiência.|1500
170|coringas|Caixa Misteriosa|Recompensa aleatória.|500
171|coringas|Caixa Rara|Chance de recompensa rara.|1000
172|coringas|Caixa Épica|Chance de recompensa épica.|3000
173|coringas|Caixa Lendária|Chance de recompensa lendária.|10000
174|coringas|Escolha da Caixa|Escolhe entre 3 recompensas.|800
175|coringas|Roleta do Amor|Gire a roleta de recompensas.|300
176|coringas|Roleta Premium|Roleta com recompensas melhores.|1000
177|buffs|Passe Diário|Vantagem especial por 24h.|500
178|buffs|Passe Semanal|Vantagem durante uma semana.|2000
179|buffs|Passe VIP|Vantagens premium.|5000
180|buffs|VIP do Amor|Benefícios premium por 7 dias.|10000
181|controle|Eu Escolho|Você escolhe o próximo programa.|150
182|controle|Você Decide Depois|O parceiro perde o direito de escolha.|200
183|controle|Minha Vez|Você escolhe a próxima atividade.|150
184|controle|Sem Reclamar|Parceiro não pode reclamar da escolha.|300
185|controle|Escolha Absoluta|Escolhe entre 2 e o parceiro aceita.|400
186|controle|Última Palavra|Decide a próxima atividade.|500
187|controle|Chef da Noite|Você decide o jantar.|200
188|controle|Rainha do Controle|Você controla a TV.|200
189|controle|DJ Supremo|Controla músicas do próximo passeio.|250
190|controle|Diretor Filme|Escolhe filme, pipoca e bebida.|300
191|controle|Diretor Noite|Escolhe toda a programação da noite.|600
192|controle|Comandante Domingo|Escolhe o programa do domingo.|500
193|controle|Comandante FDS|Decide o roteiro do fim de semana.|1000
194|controle|Passeio Obrigatório|Parceiro deve aceitar o passeio.|700
195|controle|Encontro Obrigatório|Parceiro organiza encontro.|1500
196|controle|Mimo Obrigatório|Parceiro escolhe mimo.|500
197|controle|Carinho Obrigatório|30 min de atenção exclusiva.|500
198|controle|Telefone Proibido|Parceiro sem celular no encontro.|300
199|controle|Modo Casal|1h sem celular para os dois.|400
200|controle|Olho no Olho|10 min de dedicação exclusiva.|300
201|controle|Sem Não Sei|Parceiro escolhe opções que der.|200
202|controle|Você Escolhe|Aceita sua escolha entre três.|250
203|controle|Hoje Eu Mando|Escolhe a programação da noite.|500
204|controle|Hoje Você Cuida|Parceiro cuida dos detalhes.|600
205|controle|Dia do Mimado|Parceiro faz três mimos.|1500
206|epicos|Dia da Rainha|Um dia especial para você.|3000
207|epicos|Dia do Rei|Um dia especial para você.|3000
208|controle|Vale-Pedido|Faça um pedido razoável.|700
209|controle|Pedido Premium|Dois pedidos razoáveis.|1200
210|controle|Vale-Vontade|Experiência simples do parceiro.|1000
211|experiencias|Vale-Surpresa|Parceiro prepara surpresa.|1500
212|experiencias|Surpresa Premium|Surpresa maior do parceiro.|3000
213|experiencias|Vale-Encontro|Marcar um encontro.|1500
214|experiencias|Vale-Jantar|Organizar um jantar.|1500
215|experiencias|Vale-Passeio|Organizar um passeio.|1000
216|experiencias|Vale-Cinema|Levar ao cinema.|1500
217|experiencias|Vale-Sorvete|Levar para tomar sorvete.|500
218|experiencias|Vale-Café|Levar para tomar café.|600
219|experiencias|Vale-Praia|Organizar dia de praia.|2000
220|experiencias|Vale-Piquenique|Organizar um piquenique.|1500
221|coringas|Coringa|Troca por vantagem comum.|1000
222|coringas|Coringa Raro|Vantagem de até 3k moedas.|3000
223|coringas|Coringa Épico|Vantagem de até 10k moedas.|10000
224|coringas|Coringa Lendário|Vantagem especial.|25000
225|coringas|Vale Tudo|Qualquer voucher inferior.|2000
226|coringas|Compra em Dobro|Dois vouchers pagando menos.|1500
227|coringas|Desconto Amor|50% de desconto no próximo.|500
228|coringas|Desconto VIP|75% de desconto no próximo.|1500
229|coringas|Compra Grátis|Próximo comum é gratuito.|2000
230|coringas|Roubo Voucher|Escolhe voucher do parceiro.|2500
231|coringas|Troca Justa|Troca seu voucher pelo dele.|500
232|coringas|Troca Secreta|Troca sem revelar qual escolheu.|1000
233|coringas|Bloqueio|Bloqueia vantagem por 24h.|500
234|coringas|Contra-Ataque|Cancela voucher do parceiro.|1500
235|coringas|Escudo Voucher|Protege voucher contra cancelamento.|700
236|coringas|Espelho|Copie último usado pelo parceiro.|1000
237|coringas|Duplicador|Duplica um voucher seu.|2000
238|coringas|Multiplicador|Voucher comum para premium.|3000
239|coringas|Upgrade|Aumente a potência do próximo.|1500
240|coringas|Upgrade Supremo|Transforma vantagem em máxima.|5000
241|coringas|Presente Mist.|Dê voucher aleatório ao parceiro.|500
242|coringas|Presente Escolhido|Dê qualquer voucher ao parceiro.|300
243|coringas|Presente Premium|Dê voucher de até 5k.|1000
244|coringas|Presente Épico|Dê voucher de até 15k.|3000
245|coringas|Presente Lendário|Dê voucher de até 50k.|10000
246|coringas|Vale Amor|Cria vantagem para o parceiro.|1500
247|coringas|Vale Custom|Cria seu próprio voucher.|2000
248|coringas|Vale Especial|Vale flexível para um mimo ou pedido razoável combinado entre vocês.|3000
249|coringas|Vale Secreto|Parceiro descobre só ao usar.|5000
250|coringas|Vale dos Sonhos|Desejo do parceiro em voucher.|10000
251|lembrancas|Carta de Amor|Escreve uma carta para você.|500
252|lembrancas|Dec. Particular|Declaração exclusiva.|300
253|lembrancas|Dec. Pública|Declaração pública de carinho.|1000
254|lembrancas|Playlist|Cria uma playlist para você.|500
255|lembrancas|Foto Favorita|Revela foto favorita de vocês.|300
256|lembrancas|Álbum do Casal|Organiza um pequeno álbum.|1000
257|lembrancas|Vídeo do Amor|Vídeo com memórias.|2000
258|lembrancas|Recriar Encontro|Recria encontro especial.|2500
259|lembrancas|Foto Recriada|Refaz foto antiga juntos.|800
260|lembrancas|Memória Fav.|Conta uma lembrança especial.|200
261|lembrancas|5 Motivos|5 motivos porque ama você.|250
262|lembrancas|10 Motivos|10 motivos porque é especial.|400
263|lembrancas|20 Motivos|20 motivos porque ama você.|700
264|lembrancas|Apelido VIP|Escolhe apelido por um dia.|150
265|mimos|Beijo Surpresa|Surpresa com um beijo.|150
266|mimos|Abraço Surpresa|Abraço inesperado no dia.|150
267|mimos|Mão Dada|De mãos dadas no passeio.|200
268|mimos|Dança a Dois|Dançar música com você.|400
269|experiencias|Noite Romântica|Organiza noite romântica.|2500
270|experiencias|Noite Inesquecível|Experiência romântica completa.|5000
271|epicos|Rainha do Dia|Faz o possível para o seu dia.|5000
272|epicos|FDS VIP|Planeja todo o fim de semana.|7500
273|epicos|FDS dos Sonhos|Organiza experiência completa.|15000
274|epicos|Jantar 5 Estrelas|Restaurante especial.|10000
275|epicos|Hotel 5 Estrelas|Noite em hotel alto padrão.|15000
276|epicos|Dia de Luxo|Dia de experiências especiais.|12000
277|epicos|Spa dos Sonhos|Dia completo de relaxamento.|10000
278|epicos|Passeio Premium|Experiência especial.|8000
279|epicos|Fim de Semana Completo|Fim de semana com roteiro, atividades e organização combinados previamente.|25000
280|epicos|Bate-Volta VIP|Dia planejado.|8000
281|epicos|Road Trip Rom.|Viagem de carro.|20000
282|epicos|Viagem Surpresa Premium|Uma viagem surpresa mais completa, com roteiro e detalhes combinados pelo casal.|30000
283|epicos|Viagem Sonhos|Organizar viagem desejada.|40000
284|epicos|Férias Sonhos|Grande viagem de férias.|100000
285|epicos|Lua de Mel 2.0|Viagem romântica especial.|75000
286|epicos|Sonho Antigo|Ajuda a realizar sonho seu.|50000
287|epicos|Grande Surpresa|Prepara surpresa memorável.|20000
288|epicos|Experiência Inédita Premium|Uma experiência inédita mais elaborada, planejada especialmente para o casal.|15000
289|epicos|Dia Perfeito Premium|Um dia inteiro planejado com base nas preferências de quem usar.|20000
290|epicos|Vale Experiência Especial|Vale para uma experiência especial de maior porte, definida em comum acordo.|10000
291|epicos|Vale Premium|Experiência de alto nível.|20000
292|epicos|Vale Épico|Experiência memorável.|30000
293|epicos|Vale Lendário|Grande experiência para o casal.|50000
294|epicos|Desejo Supremo|Realiza um desejo razoável.|50000
295|epicos|Coringa Supremo|Troca por qualquer voucher.|50000
296|epicos|Passe Livre Sup.|Até três vantagens disponíveis.|25000
297|epicos|Dia dos Sonhos|Organiza tudo para você.|25000
298|epicos|Exp. Lendária|Marcada na história do casal.|50000
299|epicos|O Grande Prêmio|Recompensa previamente combinada.|75000
300|epicos|Férias Supremo|Viagem de férias planejada.|100000`;

        // Catálogo da loja. Remove apenas duplicatas realmente idênticas.
        const parsedStoreItems = rawStoreItems.trim().split('\n').map(line => {
            const [id, category, title, desc, price] = line.split('|');
            return { id, category, title, desc, price: parseInt(price) };
        });
        const storeSeen = new Set();
        const baseStoreItems = parsedStoreItems.filter(item => {
            const key = `${item.title.trim().toLowerCase()}|${item.desc.trim().toLowerCase()}|${item.price}`;
            if (storeSeen.has(key)) return false;
            storeSeen.add(key);
            return true;
        });
        // V36.2 · Presentes virtuais são enviados imediatamente pelo Chat e não entram na Bolsa.
        const VIRTUAL_GIFTS = [
            {id:'301',category:'presentes',title:'Rosa Virtual',desc:'Envie uma rosa com uma mensagem personalizada.',price:100,delivery:'chat_gift',emoji:'🌹',giftKind:'rose'},
            {id:'302',category:'presentes',title:'Carta Digital',desc:'Uma carta de amor que chega em um envelope especial no Chat.',price:250,delivery:'chat_gift',emoji:'💌',giftKind:'letter'},
            {id:'303',category:'presentes',title:'Chocolate Virtual',desc:'Um chocolate virtual acompanhado da sua mensagem.',price:300,delivery:'chat_gift',emoji:'🍫',giftKind:'chocolate'},
            {id:'304',category:'presentes',title:'Buquê Virtual',desc:'Um buquê animado para marcar um momento especial.',price:500,delivery:'chat_gift',emoji:'💐',giftKind:'bouquet'},
            {id:'305',category:'presentes',title:'Ursinho Virtual',desc:'Um ursinho carinhoso enviado diretamente no Chat.',price:750,delivery:'chat_gift',emoji:'🧸',giftKind:'teddy'},
            {id:'306',category:'presentes',title:'Coração Especial',desc:'Um coração especial com destaque maior no Chat.',price:1000,delivery:'chat_gift',emoji:'💖',giftKind:'heart'},
            {id:'307',category:'presentes',title:'Chuva de Corações',desc:'Um presente premium com uma chuva de corações no Chat.',price:1500,delivery:'chat_gift',emoji:'💕',giftKind:'heart_rain'}
        ];
        const STORE_ITEMS = [...VIRTUAL_GIFTS, ...baseStoreItems];
        const STORE_CATEGORY_INFO = {
            presentes:{name:'Presentes', icon:'heart', purpose:'um presente virtual enviado imediatamente ao parceiro pelo Chat com uma mensagem personalizada'},
            tarefas:{name:'Tarefas', icon:'broom', purpose:'um combinado prático para aliviar ou trocar uma tarefa do dia a dia'},
            mimos:{name:'Mimos', icon:'gift', purpose:'um gesto de carinho que o parceiro realiza depois que o voucher é ativado'},
            experiencias:{name:'Rolês', icon:'ticket', purpose:'uma experiência ou programa para vocês realizarem juntos'},
            buffs:{name:'Buffs', icon:'sparkle', purpose:'uma vantagem temporária dentro da dinâmica do Elo'},
            controle:{name:'Controle', icon:'game-controller', purpose:'o direito de escolher uma decisão leve e específica dentro do combinado descrito'},
            coringas:{name:'Coringas', icon:'magic-wand', purpose:'um voucher flexível que altera ou substitui uma escolha dentro das regras descritas'},
            lembrancas:{name:'Recordar', icon:'camera', purpose:'uma ação voltada a criar, registrar ou revisitar uma memória do casal'},
            epicos:{name:'Épicos', icon:'crown', purpose:'uma recompensa de maior porte que exige planejamento e acordo entre os dois'}
        };
        // V36.3 · Venda apenas do que o Elo realmente executa hoje.
        // Buffs/Coringas antigos continuam reconhecidos na Bolsa para compatibilidade,
        // mas saem da vitrine até seus efeitos sistêmicos existirem de verdade.
        const STORE_LIVE_CATEGORIES = new Set(['presentes','tarefas','mimos','experiencias','controle','lembrancas','epicos']);
        const STORE_RECOMMENDED_ORDER = {presentes:0,mimos:1,tarefas:2,lembrancas:3,experiencias:4,controle:5,epicos:6};
        const isStoreItemLive = item => !!item && STORE_LIVE_CATEGORIES.has(item.category);
        const getStoreItem = id => STORE_ITEMS.find(item => String(item.id) === String(id));
        const getStoreItemGuide = item => {
            const cat = STORE_CATEGORY_INFO[item.category] || {name:'Item', purpose:'uma recompensa para a dinâmica do casal'};
            const activation = item.delivery === 'chat_gift'
                ? 'Ao comprar, você escreve uma mensagem. O presente é entregue imediatamente no Chat do casal e as Coins são descontadas no envio.'
                : item.category === 'buffs'
                ? 'Depois da compra, o item vai para sua Bolsa. Ative-o quando quiser usar a vantagem; o parceiro será avisado.'
                : item.category === 'experiencias' || item.category === 'epicos'
                    ? 'Depois da compra, o voucher fica na sua Bolsa. Ao ativá-lo, vocês combinam data, limites, orçamento e detalhes antes de realizar.'
                    : 'Depois da compra, o voucher fica na sua Bolsa. Quando você ativar, o parceiro será avisado e o efeito passa a valer conforme o combinado.';
            const rules = item.delivery === 'chat_gift'
                ? 'Presente virtual de uso imediato. Ele não cria dívida, não vai para a Bolsa e não precisa de confirmação.'
                : item.category === 'controle' || item.category === 'coringas'
                ? 'Vale para uma situação razoável e consensual. Não obriga ninguém a fazer algo desconfortável, perigoso, caro ou fora dos limites do casal.'
                : item.category === 'epicos' || item.category === 'experiencias'
                    ? 'Custos externos, datas e disponibilidade devem ser combinados entre vocês. O Elo registra o voucher, mas não realiza compras ou reservas.'
                    : 'O voucher é de uso único. Depois de usado, ele sai da lista de itens disponíveis.';
            const note = item.delivery === 'chat_gift'
                ? 'A mensagem fica registrada junto ao presente no Chat. Capriche: esta é a parte que o parceiro vai guardar.'
                : ['buffs','controle','coringas'].includes(item.category)
                ? 'O efeito é um combinado entre vocês: o Elo registra a compra/uso e avisa o parceiro, mas não força nem executa a ação automaticamente.'
                : 'Ao usar o voucher, ele fica registrado como utilizado na sua Bolsa.';
            return {categoryName:cat.name,purpose:`Este item representa ${cat.purpose}.`,activation,rules,result:`Na prática: ${item.desc}`,note};
        };

        window.showToast = (msg, type = 'info') => {
            const c = document.getElementById('toast-container');
            const t = document.createElement('div');
            const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600', reward: 'bg-pink-600' };
            const icons = { success: 'check-circle', error: 'warning', info: 'info', reward: 'star' };
            
            t.className = `flex items-center gap-3 p-4 rounded-2xl shadow-2xl text-white ${colors[type]} animate-bounce-short border border-white/20`;
            t.innerHTML = `<i class="ph-fill ph-${icons[type]} text-xl"></i><span class="font-bold text-sm">${msg}</span>`;
            c.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
        };

        const getGameDateKey = (date = new Date()) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        // V36.1 · Catálogo de missões diárias.
        // REGRA DE PRODUTO: toda missão abaixo precisa ser totalmente executável e verificável
        // antes do reset diário. Não colocar aqui tarefas cuja conclusão real dependa de outro dia.
        // Cada pessoa recebe 4 missões secretas e diferentes por dia.
                const DAILY_QUEST_POOL = [
            { id: 'q1', title: 'Dizer "eu te amo" em um momento inesperado hoje', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 15 },
            { id: 'q2', title: 'Mandar uma mensagem carinhosa sem motivo específico', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 20 },
            { id: 'q3', title: 'Fazer um elogio sincero sobre a personalidade do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 10 },
            { id: 'q4', title: 'Dar um abraço de 20 segundos ou enviar uma mensagem de abraço se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 15 },
            { id: 'q5', title: 'Perguntar como foi o dia e ouvir a resposta com atenção', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 20 },
            { id: 'q6', title: 'Enviar uma música que lembre vocês dois e dizer por quê', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 10 },
            { id: 'q7', title: 'Agradecer por uma atitude específica do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 15 },
            { id: 'q8', title: 'Dar um beijo inesperado ou mandar um beijo virtual se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 20 },
            { id: 'q9', title: 'Perguntar qual foi a melhor parte do dia do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 10 },
            { id: 'q10', title: 'Fazer seu amor rir de propósito', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 15 },
            { id: 'q11', title: 'Mandar um áudio curto dizendo algo que admira no seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 20 },
            { id: 'q12', title: 'Compartilhar uma foto simples mostrando um pedacinho do seu dia', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 10 },
            { id: 'q13', title: 'Dar bom dia de um jeito diferente do habitual', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 15 },
            { id: 'q14', title: 'Dar boa noite com uma mensagem carinhosa e específica', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 20 },
            { id: 'q15', title: 'Fazer 5 minutos de carinho ou dedicar 5 minutos de atenção total à distância', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 10 },
            { id: 'q16', title: 'Oferecer ajuda em uma pequena tarefa de hoje sem esperar que peçam', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 15 },
            { id: 'q17', title: 'Levar uma bebida para seu amor ou lembrá-lo com carinho de se hidratar se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 20 },
            { id: 'q18', title: 'Contar uma lembrança engraçada de vocês', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 10 },
            { id: 'q19', title: 'Dizer três coisas que você gosta no seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 15 },
            { id: 'q20', title: 'Perguntar se existe alguma pequena coisa que você pode fazer para melhorar o dia dele', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 20 },
            { id: 'q21', title: 'Inventar um apelido carinhoso novo e explicar por que ele combina com seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 10 },
            { id: 'q22', title: 'Escolher um emoji para representar o relacionamento hoje e explicar a escolha', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 15 },
            { id: 'q23', title: 'Dar as mãos por alguns minutos ou fazer uma chamada curta de companhia se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 20 },
            { id: 'q24', title: 'Elogiar algo no seu amor que não seja aparência', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 10 },
            { id: 'q25', title: 'Perguntar o que deixaria o dia do seu amor um pouco melhor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 15 },
            { id: 'q26', title: 'Compartilhar uma pequena conquista ou coisa boa que aconteceu no seu dia', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 20 },
            { id: 'q27', title: 'Mandar uma mensagem dizendo que sentiu saudade em algum momento de hoje', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 10 },
            { id: 'q28', title: 'Relembrar como vocês se conheceram e citar um detalhe daquele começo', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 15 },
            { id: 'q29', title: 'Escolher uma foto favorita de vocês e dizer o que gosta nela', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 20 },
            { id: 'q30', title: 'Preparar uma bebida para seu amor ou combinar uma pausa para beber algo juntos à distância', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 10 },
            { id: 'q31', title: 'Deixar um bilhete carinhoso físico ou digital para seu amor encontrar hoje', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 15 },
            { id: 'q32', title: 'Perguntar qual música seu amor mais ouviu nos últimos dias', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 20 },
            { id: 'q33', title: 'Contar uma coisa de hoje que fez você lembrar do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 10 },
            { id: 'q34', title: 'Dar uma sequência de carinho ou mandar cinco beijos virtuais se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 15 },
            { id: 'q35', title: 'Fazer um elogio sincero sobre o sorriso do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 20 },
            { id: 'q36', title: 'Perguntar qual comida seu amor escolheria se pudesse pedir qualquer coisa agora', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 10 },
            { id: 'q37', title: 'Enviar um meme ou vídeo curto que tenha a cara de vocês', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 15 },
            { id: 'q38', title: 'Falar uma qualidade do seu amor que você aprendeu a admirar com o tempo', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 20 },
            { id: 'q39', title: 'Arrumar uma pequena coisa para facilitar o dia do seu amor ou ajudá-lo remotamente com algo simples', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 10 },
            { id: 'q40', title: 'Dizer qual momento recente com seu amor você mais gostou e por quê', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 15 },
            { id: 'q41', title: 'Perguntar qual lugar seu amor gostaria de conhecer com você', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 20 },
            { id: 'q42', title: 'Mandar uma mensagem só com emojis e deixar seu amor adivinhar o significado', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 10 },
            { id: 'q43', title: 'Escolher uma música para ser a trilha sonora de vocês hoje', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 15 },
            { id: 'q44', title: 'Contar uma coisa pela qual você é grato no relacionamento', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 20 },
            { id: 'q45', title: 'Fazer um cafuné por 3 minutos ou mandar um áudio relaxante se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 10 },
            { id: 'q46', title: 'Surpreender com um abraço ou com uma mensagem inesperada se estiverem longe', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 15 },
            { id: 'q47', title: 'Perguntar qual sobremesa seu amor escolheria agora', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 30, xp: 20 },
            { id: 'q48', title: 'Mostrar que você lembra de um detalhe que seu amor contou recentemente', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 15, xp: 10 },
            { id: 'q49', title: 'Elogiar uma escolha ou decisão recente do seu amor', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 20, xp: 15 },
            { id: 'q50', title: 'Passar 10 minutos sem distrações dando atenção total ao seu amor, presencialmente ou em chamada', difficulty: 'easy', difficultyLabel: 'Fácil', reward: 25, xp: 20 },
            { id: 'q51', title: 'Preparar uma pequena surpresa usando algo que você já tem ou uma mensagem criativa', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 30 },
            { id: 'q52', title: 'Criar um mini encontro de 20 minutos para acontecer ainda hoje, presencialmente ou em chamada', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 40 },
            { id: 'q53', title: 'Escrever uma mensagem com cinco motivos específicos pelos quais ama seu parceiro', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 50 },
            { id: 'q54', title: 'Resolver uma pequena tarefa para aliviar o dia do seu amor', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 30 },
            { id: 'q55', title: 'Preparar um lanche simples ou escolher algo que vocês possam comer juntos em chamada', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 40 },
            { id: 'q56', title: 'Criar uma playlist de pelo menos 5 músicas para vocês e enviar hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 50 },
            { id: 'q57', title: 'Escolher uma foto antiga e recriar hoje algum detalhe dela, presencialmente ou à distância', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 30 },
            { id: 'q58', title: 'Separar 30 minutos sem distrações só para conversar', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 40 },
            { id: 'q59', title: 'Perguntar sobre um sonho do seu amor e conversar hoje sobre uma forma de apoiá-lo', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 50 },
            { id: 'q60', title: 'Escrever um bilhete curto, físico ou digital, e entregar hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 30 },
            { id: 'q61', title: 'Escolher um filme ou episódio pensando no gosto do seu amor e assistir pelo menos parte juntos hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 40 },
            { id: 'q62', title: 'Preparar um café da manhã, lanche ou pequena refeição especial ainda hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 50 },
            { id: 'q63', title: 'Fazer 10 minutos de massagem ou conduzir um momento de relaxamento à distância', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 30 },
            { id: 'q64', title: 'Fazer uma caminhada curta juntos hoje ou uma chamada enquanto cada um caminha', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 40 },
            { id: 'q65', title: 'Contar três lembranças do relacionamento que você nunca quer esquecer', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 50 },
            { id: 'q66', title: 'Preparar juntos uma receita simples hoje ou fazer cada um algo parecido em chamada', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 30 },
            { id: 'q67', title: 'Fazer uma lista de 10 coisas que admira no seu amor e mostrar hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 40 },
            { id: 'q68', title: 'Criar uma brincadeira com três pistas e uma mensagem carinhosa no final', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 50 },
            { id: 'q69', title: 'Passar 45 minutos sem redes sociais focando um no outro, presencialmente ou em chamada', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 30 },
            { id: 'q70', title: 'Preparar um cantinho confortável ou organizar um momento tranquilo para vocês hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 40 },
            { id: 'q71', title: 'Surpreender com um snack que já tenham ou com uma escolha simbólica à distância', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 50 },
            { id: 'q72', title: 'Gravar um vídeo curto contando por que seu amor é importante para você', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 30 },
            { id: 'q73', title: 'Criar uma mini noite temática que aconteça ainda hoje e caiba na rotina', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 40 },
            { id: 'q74', title: 'Fazer uma pergunta profunda e conversar sobre a resposta por pelo menos 15 minutos', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 50 },
            { id: 'q75', title: 'Rever fotos antigas juntos por pelo menos 20 minutos, presencialmente ou compartilhando a tela', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 30 },
            { id: 'q76', title: 'Escolher cinco lugares que gostariam de conhecer e cada um apontar seu favorito hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 40 },
            { id: 'q77', title: 'Fazer hoje uma pequena coisa que seu amor comentou que precisava', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 50 },
            { id: 'q78', title: 'Preparar uma sobremesa, mimo caseiro ou alternativa simples usando o que já tiverem', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 30 },
            { id: 'q79', title: 'Experimentar hoje uma atividade pequena que vocês nunca fizeram juntos', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 40 },
            { id: 'q80', title: 'Escrever como imagina vocês dois no futuro e compartilhar o texto hoje', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 50 },
            { id: 'q81', title: 'Fazer um mini piquenique hoje com o que já têm, até mesmo dentro de casa ou em chamada', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 30 },
            { id: 'q82', title: 'Montar hoje uma surpresa usando apenas coisas que já têm disponíveis', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 40 },
            { id: 'q83', title: 'Passar 20 minutos conversando sobre algo que gostariam de viver juntos', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 50 },
            { id: 'q84', title: 'Criar hoje uma lista compartilhada com pelo menos cinco sonhos do casal', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 30 },
            { id: 'q85', title: 'Escolher uma lembrança e contar detalhes dela que seu amor talvez não saiba', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 40 },
            { id: 'q86', title: 'Fazer uma noite de jogo curta hoje, presencialmente ou usando um jogo que funcione à distância', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 50 },
            { id: 'q87', title: 'Fazer 15 minutos de cuidado: massagem, cafuné ou conversa relaxante', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 30 },
            { id: 'q88', title: 'Preparar ou providenciar hoje uma refeição simples pensando no gosto do seu amor', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 40 },
            { id: 'q89', title: 'Escolher três fotos do casal e escrever uma legenda especial para cada uma', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 50 },
            { id: 'q90', title: 'Perguntar uma coisa que você poderia melhorar no relacionamento e ouvir sem se defender', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 30 },
            { id: 'q91', title: 'Fazer uma ligação ou chamada surpresa só para conversar alguns minutos', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 40 },
            { id: 'q92', title: 'Escolher e fazer hoje uma atividade gratuita de pelo menos 20 minutos juntos', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 50 },
            { id: 'q93', title: 'Criar um vale-mimo personalizado e entregar hoje ao seu amor', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 30 },
            { id: 'q94', title: 'Passar 30 minutos fazendo hoje uma atividade que seu amor gosta', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 40 },
            { id: 'q95', title: 'Compartilhar algo vulnerável que você gostaria que seu amor entendesse melhor', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 50 },
            { id: 'q96', title: 'Montar hoje uma retrospectiva curta com três momentos marcantes do último mês', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 30 },
            { id: 'q97', title: 'Aprender hoje uma coisa pequena sobre algo que seu amor gosta e contar o que descobriu', difficulty: 'medium', difficultyLabel: 'Média', reward: 55, xp: 40 },
            { id: 'q98', title: 'Escolher juntos três coisas que querem melhorar na relação e registrar uma ação simples para cada', difficulty: 'medium', difficultyLabel: 'Média', reward: 65, xp: 50 },
            { id: 'q99', title: 'Organizar hoje um momento de relaxamento para seu amor, presencialmente ou à distância', difficulty: 'medium', difficultyLabel: 'Média', reward: 35, xp: 30 },
            { id: 'q100', title: 'Criar e realizar hoje um encontro surpresa simples de pelo menos 20 minutos', difficulty: 'medium', difficultyLabel: 'Média', reward: 45, xp: 40 },
            { id: 'q101', title: 'Criar hoje um encontro surpresa de pelo menos 45 minutos usando o que estiver disponível', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 70 },
            { id: 'q102', title: 'Escrever uma carta de amor detalhada e entregar hoje, fisicamente ou em formato digital', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 90 },
            { id: 'q103', title: 'Preparar três pequenos momentos carinhosos e realizar todos eles ao longo de hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 110 },
            { id: 'q104', title: 'Relembrar o primeiro encontro e recriar hoje pelo menos dois detalhes dele', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 130 },
            { id: 'q105', title: 'Criar hoje um álbum digital com pelo menos 15 momentos do casal e mostrar ao seu amor', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 70 },
            { id: 'q106', title: 'Preparar hoje uma refeição especial para os dois ou fazer uma experiência equivalente em chamada', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 90 },
            { id: 'q107', title: 'Pesquisar três lugares que gostariam de conhecer e escolher juntos um favorito hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 110 },
            { id: 'q108', title: 'Ficar pelo menos 90 minutos sem redes sociais para focar um no outro', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 130 },
            { id: 'q109', title: 'Criar hoje uma cápsula do tempo digital ou física com pelo menos cinco itens ou mensagens', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 70 },
            { id: 'q110', title: 'Escrever 20 motivos específicos pelos quais escolheria seu amor novamente e compartilhar hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 90 },
            { id: 'q111', title: 'Criar hoje uma surpresa inspirada em uma lembrança importante do relacionamento', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 110 },
            { id: 'q112', title: 'Experimentar hoje uma experiência nova e simples que nenhum dos dois costuma fazer', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 130 },
            { id: 'q113', title: 'Criar hoje um vídeo curto com fotos, música e mensagens sobre a história de vocês', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 70 },
            { id: 'q114', title: 'Ter hoje uma conversa de uma hora sobre sonhos, medos e planos sem distrações', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 90 },
            { id: 'q115', title: 'Fazer três pequenas gentilezas diferentes para seu amor ao longo de hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 110 },
            { id: 'q116', title: 'Criar hoje um mapa digital ou desenhado com pelo menos cinco lugares importantes da história de vocês', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 130 },
            { id: 'q117', title: 'Montar hoje uma caixa ou pasta digital com pelo menos cinco lembranças do relacionamento', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 70 },
            { id: 'q118', title: 'Escrever hoje duas cartas, uma de cada um para o futuro, e guardá-las em algum lugar combinado', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 90 },
            { id: 'q119', title: 'Escolher hoje uma meta do casal e definir três primeiros passos concretos que podem começar agora', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 110 },
            { id: 'q120', title: 'Escolher um lugar que gostariam de conhecer e criar hoje uma refeição, playlist ou chamada inspirada nele', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 130 },
            { id: 'q121', title: 'Criar hoje um passeio diferente usando um lugar próximo ou uma exploração virtual compartilhada', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 70 },
            { id: 'q122', title: 'Escrever hoje uma história curta do relacionamento dividida em pelo menos quatro capítulos', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 90 },
            { id: 'q123', title: 'Dedicar pelo menos uma hora hoje a uma atividade escolhida pelo seu amor', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 110 },
            { id: 'q124', title: 'Comemorar hoje uma pequena conquista do seu amor de um jeito especial e personalizado', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 130 },
            { id: 'q125', title: 'Criar hoje 12 ideias de encontros e escolher juntos as três favoritas', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 70 },
            { id: 'q126', title: 'Fazer hoje uma entrevista divertida com seu amor com pelo menos 10 perguntas e guardar as respostas', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 90 },
            { id: 'q127', title: 'Criar hoje um momento de memórias com fotos, músicas e uma história marcante', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 110 },
            { id: 'q128', title: 'Escolher juntos três metas do casal e registrar hoje um primeiro passo simples para cada uma', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 130 },
            { id: 'q129', title: 'Inventar hoje uma tradição nova do casal e realizar a primeira versão dela', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 70 },
            { id: 'q130', title: 'Fazer hoje uma surpresa baseada em algo que seu amor comentou recentemente', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 90 },
            { id: 'q131', title: 'Assistir juntos ao pôr do sol, nascer do sol ou outro momento tranquilo do dia, presencialmente ou em chamada', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 110 },
            { id: 'q132', title: 'Criar hoje uma playlist com pelo menos 20 músicas que contem a história do relacionamento', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 130 },
            { id: 'q133', title: 'Preparar hoje uma refeição caprichada com pelo menos duas etapas ou versões equivalentes à distância', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 70 },
            { id: 'q134', title: 'Montar hoje um mural físico ou digital com pelo menos oito sonhos do casal', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 90 },
            { id: 'q135', title: 'Dedicar pelo menos uma hora hoje a aprender ou praticar um hobby que seu amor gosta', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 110 },
            { id: 'q136', title: 'Criar hoje uma tarde ou noite especial com pelo menos três atividades simples em sequência', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 130 },
            { id: 'q137', title: 'Escrever uma carta sobre como o relacionamento mudou você e compartilhar hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 70 },
            { id: 'q138', title: 'Criar hoje um quiz personalizado com pelo menos 10 perguntas sobre a história de vocês e jogar juntos', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 90 },
            { id: 'q139', title: 'Fazer hoje uma sessão de fotos de vocês ou uma sessão à distância com tema combinado', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 110 },
            { id: 'q140', title: 'Preparar três pequenas surpresas e entregar as três ainda hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 130 },
            { id: 'q141', title: 'Criar e viver hoje uma experiência romântica sem gastar dinheiro, com pelo menos três etapas', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 70 },
            { id: 'q142', title: 'Criar hoje uma lista de 30 coisas que ainda querem viver juntos e escolher as cinco favoritas', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 90 },
            { id: 'q143', title: 'Cuidar hoje de todos os detalhes de uma hora tranquila para seu amor descansar', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 110 },
            { id: 'q144', title: 'Aprender juntos hoje alguma coisa nova por pelo menos 45 minutos', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 130 },
            { id: 'q145', title: 'Criar hoje uma retrospectiva com cinco momentos importantes e apresentar ao seu amor', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 70 },
            { id: 'q146', title: 'Fazer hoje uma surpresa simples inspirada em um lugar ou atividade favorita do seu amor', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 80, xp: 90 },
            { id: 'q147', title: 'Criar hoje uma lista visual com 10 ideias de momentos a dois e escolher juntos as três melhores', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 100, xp: 110 },
            { id: 'q148', title: 'Ter hoje uma conversa estruturada sobre o futuro e registrar três decisões ou acordos do casal', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 120, xp: 130 },
            { id: 'q149', title: 'Criar hoje um presente artesanal ou digital personalizado e entregar ao seu amor', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 140, xp: 70 },
            { id: 'q150', title: 'Escolher hoje uma experiência da lista de desejos e realizar uma pequena versão dela ainda hoje', difficulty: 'hard', difficultyLabel: 'Difícil', reward: 160, xp: 90 },
        ];

        const hashDailySeed = str => {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
            return h >>> 0;
        };
        const seededShuffle = (items, seedText) => {
            const arr = items.slice(); let state = hashDailySeed(seedText) || 1;
            const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
            for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
            return arr;
        };
        const dateKeyOffset = (dateKey, delta) => {
            const [y,m,d] = dateKey.split('-').map(Number); const dt = new Date(y, m-1, d + delta, 12, 0, 0);
            return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        };
        const getCoupleUserIds = () => Object.keys(coupleData?.users || {}).sort();
        const dailyQuestSelectionCache = new Map();
        const baseUserSelection = (uid, dayKey) => seededShuffle(DAILY_QUEST_POOL, `${coupleId || 'elo'}|${uid}|${dayKey}|missions`).slice(0, 4);
        const getDailyQuestsForUser = (uid, dayKey = getGameDateKey()) => {
            if (!uid) return [];
            const userIds = getCoupleUserIds();
            const cacheKey = `${coupleId||'elo'}|${dayKey}|${userIds.join(',')}|${uid}`;
            if (dailyQuestSelectionCache.has(cacheKey)) return dailyQuestSelectionCache.get(cacheKey);

            const assignedToday = new Set();
            let result = [];
            for (const userId of (userIds.length ? userIds : [uid])) {
                const previousIds = new Set(baseUserSelection(userId, dateKeyOffset(dayKey, -1)).map(q => q.id));
                let candidates = DAILY_QUEST_POOL.filter(q => !previousIds.has(q.id) && !assignedToday.has(q.id));
                let selected = seededShuffle(candidates, `${coupleId || 'elo'}|${userId}|${dayKey}|missions`).slice(0, 4);
                if (selected.length < 4) {
                    const used = new Set(selected.map(q => q.id));
                    const fallback = seededShuffle(DAILY_QUEST_POOL.filter(q => !used.has(q.id) && !assignedToday.has(q.id)), `${coupleId || 'elo'}|${userId}|${dayKey}|fallback`);
                    selected = selected.concat(fallback.slice(0, 4 - selected.length));
                }
                selected.forEach(q => assignedToday.add(q.id));
                if (userId === uid) result = selected;
            }
            if (!result.length) result = baseUserSelection(uid, dayKey);

            const mapped = result.map(q => ({ ...q, instanceId: `${dayKey}_${uid}_${q.id}`, dayKey, ownerUid: uid }));
            if (dailyQuestSelectionCache.size > 24) dailyQuestSelectionCache.clear();
            dailyQuestSelectionCache.set(cacheKey,mapped);
            return mapped;
        };
        let DAILY_QUESTS = [];
        const refreshDailyQuests = () => {
            DAILY_QUESTS = getDailyQuestsForUser(currentUser?.uid);
            window.ALL_QUESTS = DAILY_QUESTS;
            return DAILY_QUESTS;
        };
        refreshDailyQuests();

        let dailyQuestTimerInterval = null;
        let dailyQuestTimerDay = null;
        const getTimeUntilNextDay = () => {
            const now = new Date(); const next = new Date(now); next.setHours(24,0,0,0);
            return Math.max(0, next.getTime() - now.getTime());
        };
        const formatDailyQuestCountdown = ms => {
            const total = Math.max(0, Math.floor(ms / 1000));
            const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const sec = total % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        };
        const updateDailyQuestTimer = () => {
            const el = document.getElementById('daily-quest-timer');
            const currentDay = getGameDateKey();
            if (dailyQuestTimerDay && dailyQuestTimerDay !== currentDay) { dailyQuestTimerDay = currentDay; refreshDailyQuests(); if (window.activeTab === 'quests') updateUI(); return; }
            dailyQuestTimerDay = currentDay;
            if (el) el.textContent = formatDailyQuestCountdown(getTimeUntilNextDay());
        };
        const stopDailyQuestTimer = () => {
            if (dailyQuestTimerInterval) {
                clearInterval(dailyQuestTimerInterval);
                dailyQuestTimerInterval = null;
            }
        };
        const startDailyQuestTimer = () => {
            if (window.activeTab !== 'quests' || document.hidden) return;
            updateDailyQuestTimer();
            if (!dailyQuestTimerInterval) dailyQuestTimerInterval = setInterval(updateDailyQuestTimer, 1000);
        };

        let streakCountdownInterval = null;
        const updateHomeStreakCountdown = () => {
            const el = document.getElementById('home-streak-countdown');
            if (!el) return;
            const remaining = getTimeUntilNextDay();
            const streakNow = getStreakData(coupleData);
            if (streakNow.bothChecked) {
                el.textContent = 'SEGURA 🔥';
            } else {
                el.textContent = formatDailyQuestCountdown(remaining);
            }
            const box = el.closest('.elo-streak-countdown');
            if (box) box.classList.toggle('urgent', !streakNow.bothChecked && remaining <= 3*60*60*1000);
        };
        const stopHomeStreakCountdown = () => {
            if (streakCountdownInterval) {
                clearInterval(streakCountdownInterval);
                streakCountdownInterval = null;
            }
        };
        const startHomeStreakCountdown = () => {
            if (window.activeTab !== 'home' || document.hidden) return;
            updateHomeStreakCountdown();
            if (!streakCountdownInterval) streakCountdownInterval = setInterval(updateHomeStreakCountdown,1000);
        };
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopDailyQuestTimer();
                stopHomeStreakCountdown();
            } else {
                if (window.activeTab === 'quests') startDailyQuestTimer();
                if (window.activeTab === 'home') startHomeStreakCountdown();
            }
        });

        // --- SISTEMA LEGADO (SVG MANUAL) MANTIDO PARA RETROCOMPATIBILIDADE ---
        const renderCharacterSVG = (config) => {
            const c = config || {};
            const skin = c.skin || 'fcd34d';
            const face = c.face || 'round';
            const hair = c.hair || 'spiky';
            const hairColor = c.hairColor || '0f172a';
            const eyes = c.eyes || 'normal';
            const mouth = c.mouth || 'smile';
            const shirt = c.shirt || 'tshirt';
            const shirtColor = c.shirtColor || '3b82f6';
            const pants = c.pants || 'jeans';
            const pantsColor = c.pantsColor || '1e293b';
            const accessory = c.accessory || 'none';

            const faceShape = {
                round: 'M50 8 C34 8 25 18 25 32 C25 47 35 54 50 54 C65 54 75 47 75 32 C75 18 66 8 50 8 Z',
                oval: 'M50 7 C35 7 28 18 28 33 C28 47 37 55 50 55 C63 55 72 47 72 33 C72 18 65 7 50 7 Z',
                soft: 'M50 9 C36 9 27 18 27 32 C27 46 37 53 50 54 C63 53 73 46 73 32 C73 18 64 9 50 9 Z'
            }[face];

            const head = `<path d="${faceShape}" fill="#${skin}"/>`;
            const neck = `<rect x="44" y="49" width="12" height="14" rx="5" fill="#${skin}"/>`;
            const torso = `<rect x="28" y="58" width="44" height="42" rx="11" fill="#${skin}"/>`;
            const arms = `<rect x="15" y="61" width="14" height="43" rx="7" fill="#${skin}"/><rect x="71" y="61" width="14" height="43" rx="7" fill="#${skin}"/>`;
            const legs = `<rect x="33" y="93" width="15" height="43" rx="7" fill="#${skin}"/><rect x="52" y="93" width="15" height="43" rx="7" fill="#${skin}"/>`;

            let shirtSVG = '';
            if (shirt === 'tshirt') shirtSVG = `<path d="M29 58 L17 63 L13 78 L27 81 L30 74 L30 98 L70 98 L70 74 L73 81 L87 78 L83 63 L71 58 Z" fill="#${shirtColor}"/>`;
            else if (shirt === 'tank') shirtSVG = `<path d="M33 57 L39 54 L43 64 L50 67 L57 64 L61 54 L67 57 L72 98 L28 98 Z" fill="#${shirtColor}"/>`;
            else if (shirt === 'longsleeve') shirtSVG = `<path d="M29 58 L17 62 L13 103 L29 103 L31 77 L31 98 L69 98 L69 77 L71 103 L87 103 L83 62 L71 58 Z" fill="#${shirtColor}"/>`;
            else if (shirt === 'hoodie') shirtSVG = `<path d="M28 58 Q50 48 72 58 L81 65 L85 102 L15 102 L19 65 Z" fill="#${shirtColor}"/><path d="M39 56 Q50 69 61 56" fill="none" stroke="#${skin}" stroke-width="5"/><path d="M45 72 L55 72 L53 93 L47 93 Z" fill="#1e293b" opacity=".25"/>`;
            else if (shirt === 'jacket') shirtSVG = `<path d="M27 58 L17 64 L14 101 L32 101 L33 73 L50 65 L67 73 L68 101 L86 101 L83 64 L73 58 Z" fill="#${shirtColor}"/><path d="M50 65 L50 99" stroke="#e2e8f0" stroke-width="2" opacity=".7"/>`;
            else if (shirt === 'dress') shirtSVG = `<path d="M35 56 Q50 62 65 56 L82 115 L18 115 Z" fill="#${shirtColor}"/><path d="M37 57 Q50 67 63 57" fill="none" stroke="#ffffff" stroke-width="2" opacity=".35"/>`;

            let pantsSVG = '';
            if (pants === 'shorts') pantsSVG = `<path d="M30 91 H70 V113 H52 V103 H48 V113 H30 Z" fill="#${pantsColor}"/>`;
            else if (pants === 'jeans') pantsSVG = `<path d="M30 91 H70 V102 L67 139 H52 V107 H48 V139 H33 L30 102 Z" fill="#${pantsColor}"/>`;
            else if (pants === 'skirt') pantsSVG = `<path d="M30 91 H70 L81 116 H19 Z" fill="#${pantsColor}"/>`;
            else if (pants === 'jogger') pantsSVG = `<path d="M30 91 H70 L67 138 H53 V105 H47 V138 H33 Z" fill="#${pantsColor}"/><path d="M33 108 H47 M53 108 H67" stroke="#ffffff" stroke-width="2" opacity=".18"/>`;

            let eyeSVG = '';
            if (eyes === 'happy') eyeSVG = `<path d="M37 29 Q42 24 47 29" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/><path d="M53 29 Q58 24 63 29" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>`;
            else if (eyes === 'big') eyeSVG = `<circle cx="41" cy="30" r="4.5" fill="#fff"/><circle cx="59" cy="30" r="4.5" fill="#fff"/><circle cx="41" cy="30" r="2.4" fill="#1e293b"/><circle cx="59" cy="30" r="2.4" fill="#1e293b"/>`;
            else eyeSVG = `<circle cx="41" cy="30" r="3.2" fill="#1e293b"/><circle cx="59" cy="30" r="3.2" fill="#1e293b"/>`;

            let mouthSVG = '';
            if (mouth === 'small') mouthSVG = `<path d="M46 39 Q50 41 54 39" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>`;
            else if (mouth === 'open') mouthSVG = `<path d="M44 38 Q50 48 56 38 Q54 47 50 47 Q46 47 44 38 Z" fill="#7f1d1d"/>`;
            else mouthSVG = `<path d="M44 37 Q50 45 56 37" fill="none" stroke="#1e293b" stroke-width="2.3" stroke-linecap="round"/>`;

            const cheeks = `<circle cx="34" cy="38" r="3.5" fill="#ef4444" opacity=".18"/><circle cx="66" cy="38" r="3.5" fill="#ef4444" opacity=".18"/>`;

            let backHair = '';
            if (hair === 'long') backHair = `<path d="M20 29 Q50 -2 80 29 L84 77 Q50 88 16 77 Z" fill="#${hairColor}"/>`;
            else if (hair === 'ponytail') backHair = `<path d="M66 20 Q92 22 83 62 Q76 69 68 58 Z" fill="#${hairColor}"/>`;
            else if (hair === 'braids') backHair = `<path d="M27 22 Q17 39 20 80 L29 80 L31 45 Z M73 22 Q83 39 80 80 L71 80 L69 45 Z" fill="#${hairColor}"/>`;

            let frontHair = '';
            if (hair === 'spiky') frontHair = `<path d="M22 25 Q28 1 41 12 L50 0 L58 12 Q72 2 78 25 Q66 16 50 18 Q34 16 22 25 Z" fill="#${hairColor}"/>`;
            else if (hair === 'short') frontHair = `<path d="M25 24 Q26 3 50 8 Q74 3 75 24 Q68 17 62 17 Q50 13 38 17 Q32 17 25 24 Z" fill="#${hairColor}"/>`;
            else if (hair === 'long') frontHair = `<path d="M22 25 Q26 0 50 7 Q74 0 78 25 L72 52 L65 52 L65 27 Q50 18 35 27 L35 52 L28 52 Z" fill="#${hairColor}"/>`;
            else if (hair === 'bangs') frontHair = `<path d="M23 23 Q28 2 50 7 Q72 2 77 23 Q68 19 61 28 L55 18 L49 30 L42 18 L35 28 Q30 22 23 23 Z" fill="#${hairColor}"/>`;
            else if (hair === 'curly') frontHair = `<g fill="#${hairColor}"><circle cx="30" cy="20" r="12"/><circle cx="42" cy="12" r="13"/><circle cx="55" cy="10" r="14"/><circle cx="68" cy="18" r="12"/><circle cx="25" cy="28" r="9"/><circle cx="75" cy="28" r="9"/></g>`;
            else if (hair === 'afro') frontHair = `<circle cx="50" cy="18" r="28" fill="#${hairColor}"/><circle cx="27" cy="25" r="10" fill="#${hairColor}"/><circle cx="73" cy="25" r="10" fill="#${hairColor}"/>`;
            else if (hair === 'braids') frontHair = `<path d="M24 25 Q29 6 50 9 Q71 6 76 25 Q70 16 62 17 Q50 12 38 17 Q30 16 24 25 Z" fill="#${hairColor}"/>`;
            else if (hair === 'mohawk') frontHair = `<path d="M35 21 L42 2 L49 17 L56 0 L64 21 Z" fill="#${hairColor}"/>`;

            let accessorySVG = '';
            if (accessory === 'glasses') accessorySVG = `<rect x="34" y="25" width="14" height="10" rx="3" fill="none" stroke="#1e293b" stroke-width="2"/><rect x="52" y="25" width="14" height="10" rx="3" fill="none" stroke="#1e293b" stroke-width="2"/><line x1="48" y1="30" x2="52" y2="30" stroke="#1e293b" stroke-width="2"/>`;
            else if (accessory === 'sunglasses') accessorySVG = `<rect x="34" y="25" width="14" height="10" rx="3" fill="#111827"/><rect x="52" y="25" width="14" height="10" rx="3" fill="#111827"/><line x1="48" y1="30" x2="52" y2="30" stroke="#111827" stroke-width="2"/>`;
            else if (accessory === 'beard') accessorySVG = `<path d="M33 40 Q50 56 67 40 Q64 50 50 52 Q36 50 33 40 Z" fill="#${hairColor}"/>`;
            else if (accessory === 'mustache') accessorySVG = `<path d="M43 39 Q48 35 50 40 Q52 35 57 39 Q55 44 50 42 Q45 44 43 39 Z" fill="#${hairColor}"/>`;
            else if (accessory === 'earrings') accessorySVG = `<circle cx="24" cy="39" r="3" fill="#fbbf24"/><circle cx="76" cy="39" r="3" fill="#fbbf24"/>`;
            else if (accessory === 'cap') accessorySVG = `<path d="M21 22 Q50 3 79 22 L79 28 L21 28 Z" fill="#7c3aed"/><path d="M70 27 Q84 26 88 31" fill="none" stroke="#7c3aed" stroke-width="5" stroke-linecap="round"/>`;
            else if (accessory === 'crown') accessorySVG = `<path d="M31 13 L38 24 L50 11 L62 24 L69 13 L66 29 L34 29 Z" fill="#fbbf24"/><path d="M35 28 H65" stroke="#f59e0b" stroke-width="3"/>`;
            else if (accessory === 'necklace') accessorySVG = `<path d="M36 54 Q50 70 64 54" fill="none" stroke="#fbbf24" stroke-width="2"/><circle cx="50" cy="66" r="3" fill="#fbbf24"/>`;

            const shoes = `<path d="M31 136 H48 Q51 142 45 146 H30 Q27 142 31 136 Z" fill="#111827"/><path d="M52 136 H69 Q73 142 68 146 H53 Q49 142 52 136 Z" fill="#111827"/>`;

            return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">${backHair}${arms}${legs}${neck}${torso}${pantsSVG}${shirtSVG}${shoes}${head}${eyeSVG}${cheeks}${mouthSVG}${frontHair}${accessorySVG}</svg>`;
        };

        // --- SISTEMA DE AVATARES DICEBEAR ---
        // DiceBear 10.x usa nomes como topVariant, clothesVariant,
        // eyesVariant, mouthVariant, hairVariant etc.
        // A seed permanece a mesma quando o usuário altera manualmente
        // uma característica; ela só muda no botão "Aleatório".

        window.renderAvatar = (charConfig, seedStr) => {
            if (charConfig && charConfig.provider === 'dicebear') {
                const style = charConfig.style || 'avataaars';
                const seed = charConfig.seed || seedStr || currentUser?.uid || 'elo-seed';
                const params = new URLSearchParams();

                params.set('seed', seed);

                Object.entries(charConfig.options || {}).forEach(([key, value]) => {
                    if (value === undefined || value === null || value === '') return;
                    if ((key === 'accessoriesVariant' || key === 'facialHairVariant') && value === 'none') return;

                    // DiceBear 10.x aceita valores de lista separados por vírgula.
                    const finalValue = Array.isArray(value) ? value.join(',') : value;
                    if (finalValue !== '') params.set(key, finalValue);
                });

                // Evita cache do navegador durante a edição do avatar.
                return `<img src="https://api.dicebear.com/10.x/${encodeURIComponent(style)}/svg?${params.toString()}" class="w-full h-full drop-shadow-md object-cover" alt="Avatar"/>`;
            }

            return renderCharacterSVG(charConfig);
        };

        const avatarStyleNames = {
            'avataaars':'Avataaars — clássico', 'adventurer':'Adventurer — expressivo',
            'adventurer-neutral':'Adventurer Neutral — suave', 'big-ears':'Big Ears — divertido',
            'big-smile':'Big Smile — sorridente', 'bottts':'Bottts — robô', 'croodles':'Croodles — desenhado',
            'fun-emoji':'Fun Emoji — emoji', 'lorelei':'Lorelei — ilustrado', 'micah':'Micah — moderno',
            'notionists':'Notionists — casual', 'open-peeps':'Open Peeps — desenhado', 'personas':'Personas — moderno',
            'pixel-art':'Pixel Art — pixelado', 'toon-head':'Toon Head — cartoon'
        };

        // Editor simplificado: somente as opções que realmente fazem sentido
        // para um criador de personagem no app.
        const avatarLabelMap = {
            topVariant:'Cabelo',
            eyesVariant:'Olhos',
            eyebrowsVariant:'Sobrancelhas',
            mouthVariant:'Boca',
            facialHairVariant:'Barba e bigode',
            clothesVariant:'Roupa',
            clothesGraphicVariant:'Estampa da roupa',
            accessoriesVariant:'Acessórios',
            skinColor:'Tom de pele',
            hairColor:'Cor do cabelo',
            facialHairColor:'Cor da barba / bigode',
            clothesColor:'Cor da roupa',
            accessoriesColor:'Cor dos acessórios'
        };

        const avatarValueMap = {
            none:'Nenhum',
            bigHair:'Cabelo grande', bob:'Chanel', bun:'Coque', curly:'Cacheado', curvy:'Volumoso',
            dreads:'Dreads', dreads01:'Dreads', dreads02:'Dreads', frida:'Tranças', frizzle:'Cacheado volumoso',
            fro:'Black power', froBand:'Black power com faixa', hat:'Chapéu', hijab:'Hijab', longButNotTooLong:'Longo',
            miaWallace:'Mia Wallace', shaggy:'Desfiado', shaggyMullet:'Mullet', shavedSides:'Laterais raspadas',
            shortCurly:'Curto cacheado', shortFlat:'Curto liso', shortRound:'Curto arredondado', shortWaved:'Curto ondulado',
            sides:'Repartido de lado', straight01:'Liso 1', straight02:'Liso 2', straightAndStrand:'Liso com mecha',
            theCaesar:'César', theCaesarAndSidePart:'César com repartido', turban:'Turbante', winterHat02:'Gorro 1',
            winterHat03:'Gorro 2', winterHat04:'Gorro 3', winterHat1:'Gorro',
            closed:'Fechados', cry:'Chorando', default:'Normal', eyeRoll:'Revirando', happy:'Felizes', hearts:'Corações',
            side:'Olhando de lado', squint:'Semicerrados', surprised:'Surpresos', wink:'Piscando', winkWacky:'Piscando divertido', xDizzy:'X',
            angry:'Bravos', angryNatural:'Bravos naturais', defaultNatural:'Naturais', flatNatural:'Retas', frownNatural:'Franzidas',
            raisedExcited:'Levantadas', raisedExcitedNatural:'Levantadas naturais', sadConcerned:'Preocupadas', sadConcernedNatural:'Preocupadas naturais',
            unibrowNatural:'Unidas', upDown:'Assimétricas', upDownNatural:'Assimétricas naturais',
            concerned:'Preocupada', disbelief:'Desconfiada', eating:'Comendo', grimace:'Careta', sad:'Triste', screamOpen:'Aberta',
            serious:'Séria', smile:'Sorrindo', tongue:'Língua para fora', twinkle:'Sorriso brilhante', vomit:'Engraçada',
            beardLight:'Barba leve', beardMajestic:'Barba cheia', beardMedium:'Barba média', moustacheFancy:'Bigode fino', moustacheMagnum:'Bigode cheio',
            blazerAndShirt:'Blazer e camisa', blazerAndSweater:'Blazer e suéter', collarAndSweater:'Suéter', graphicShirt:'Camiseta estampada',
            hoodie:'Moletom', overall:'Macacão', shirtCrewNeck:'Camiseta gola redonda', shirtScoopNeck:'Camiseta gola aberta', shirtVNeck:'Camiseta gola V',
            bat:'Morcego', bear:'Urso', cumbia:'Cumbia', deer:'Cervo', diamond:'Diamante', hola:'Olá', pizza:'Pizza', resist:'Resist', skull:'Caveira', skullOutline:'Caveira contorno',
            eyepatch:'Tapa-olho', kurt:'Kurt', prescription01:'Óculos 1', prescription02:'Óculos 2', round:'Óculos redondos', sunglasses:'Óculos escuros', wayfarers:'Wayfarer'
        };

        const avatarOptionLabel = key => avatarLabelMap[key] || key;
        const avatarValueLabel = value => avatarValueMap[value] || String(value).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ');
        const avatarOptionId = key => `db-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

        const avatarColorPresets = [
            '#111827','#374151','#6b7280','#f8fafc','#ef4444','#f97316','#f59e0b','#eab308',
            '#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
            '#be123c','#7c2d12','#78350f','#92400e','#d08b5b','#edb98a','#ffdbb4','#f8cfae'
        ];

        // Apenas estes controles aparecem no criador.
        const AVATAARS_SIMPLE_OPTIONS = new Set([
            // Componentes visuais
            'topVariant','eyesVariant','eyebrowsVariant','mouthVariant','facialHairVariant',
            'clothesVariant','clothesGraphicVariant','accessoriesVariant',

            // Cores
            'skinColor','hairColor','facialHairColor','clothesColor','accessoriesColor',

            // Probabilidades internas usadas para garantir que uma escolha
            // manual de barba/acessório/estampa realmente apareça.
            'facialHairProbability','accessoriesProbability','clothesGraphicProbability'
        ]);

        window.avatarEditorTab = 'appearance';
        window.setAvatarEditorTab = tab => {
            window.avatarEditorTab = tab;
            document.querySelectorAll('.avatar-editor-tab').forEach(btn => {
                const active = btn.dataset.avatarTab === tab;
                btn.className = `avatar-editor-tab rounded-lg px-2 py-2 text-[9px] font-black flex items-center justify-center gap-1 transition-all ${active ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-200'}`;
            });
            document.querySelectorAll('[data-avatar-section]').forEach(section => {
                section.classList.toggle('hidden', section.dataset.avatarSection !== tab);
            });
        };

        // Mapeamento que conecta a parte do corpo/roupa à sua respectiva cor
        const avatarColorMap = {
            'topVariant': 'hairColor',
            'facialHairVariant': 'facialHairColor',
            'clothesVariant': 'clothesColor',
            'accessoriesVariant': 'accessoriesColor'
        };

        const AVATAARS_SCHEMA_CACHE_KEY = 'elo_avataaars_options_v10';
        const AVATAARS_SCHEMA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
        let avataaarsSchemaMemory = null;

        const getAvataaarsSchema = async () => {
            if (avataaarsSchemaMemory) return avataaarsSchemaMemory;

            try {
                const cached = JSON.parse(localStorage.getItem(AVATAARS_SCHEMA_CACHE_KEY) || 'null');
                if (cached?.data && Date.now() - Number(cached.savedAt || 0) < AVATAARS_SCHEMA_CACHE_TTL) {
                    avataaarsSchemaMemory = cached.data;
                    return avataaarsSchemaMemory;
                }
            } catch (_) {}

            const response = await fetch(
                'https://api.dicebear.com/10.x/avataaars/options.json',
                { cache: 'force-cache' }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            avataaarsSchemaMemory = await response.json();
            try {
                localStorage.setItem(AVATAARS_SCHEMA_CACHE_KEY, JSON.stringify({
                    savedAt: Date.now(),
                    data: avataaarsSchemaMemory
                }));
            } catch (_) {}
            return avataaarsSchemaMemory;
        };

        window.updateAvatarFields = async (savedOptions = null) => {
            const styleEl = document.getElementById('db-style');
            const container = document.getElementById('dynamic-avatar-fields');
            if (!styleEl || !container) return;

            const style = 'avataaars';
            styleEl.value = style;

            container.innerHTML = `
                <div class="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-center">
                    <i class="ph-bold ph-spinner animate-spin text-pink-500 text-xl"></i>
                    <p class="text-[10px] font-bold text-slate-500 mt-2">Preparando seu personagem...</p>
                </div>`;

            try {
                const schema = await getAvataaarsSchema();

                // As probabilidades são usadas internamente e não precisam
                // aparecer como controles para o usuário.
                const hiddenProbabilityKeys = new Set([
                    'facialHairProbability',
                    'accessoriesProbability',
                    'clothesGraphicProbability'
                ]);

                const entries = Object.entries(schema || {})
                    .filter(([key]) => AVATAARS_SIMPLE_OPTIONS.has(key));

                const colorKeys = new Set([
                    'skinColor',
                    'hairColor',
                    'facialHairColor',
                    'clothesColor',
                    'accessoriesColor'
                ]);

                const probabilityKeys = new Set([
                    'facialHairProbability',
                    'accessoriesProbability',
                    'clothesGraphicProbability'
                ]);

                const mainItems = entries.filter(([key]) =>
                    !colorKeys.has(key) && !probabilityKeys.has(key)
                );

                const normalizeColor = value => {
                    if (typeof value !== 'string' || !value) {
                        return '#6366f1';
                    }

                    return value.startsWith('#')
                        ? value
                        : `#${value}`;
                };

                const getSavedValue = key => {
                    const saved = savedOptions?.[key];
                    return Array.isArray(saved) ? saved[0] : saved;
                };

                const renderColorPicker = colorKey => {
                    const meta = schema[colorKey];
                    if (!meta) return '';

                    const id = avatarOptionId(colorKey);
                    const savedValue = getSavedValue(colorKey);

                    return `
                        <div class="flex items-center gap-1.5 shrink-0" title="Escolher cor">
                            <input
                                id="${id}"
                                data-avatar-option="${colorKey}"
                                type="color"
                                value="${normalizeColor(savedValue)}"
                                onchange="updateCharacterPreview()"
                                class="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer p-0.5 shadow-inner"
                            />
                        </div>`;
                };

                const renderField = ([key, meta]) => {
                    const id = avatarOptionId(key);
                    const label = avatarOptionLabel(key);
                    const savedValue = getSavedValue(key);

                    // Campos de cor ficam ao lado do componente correspondente.
                    if (colorKeys.has(key)) {
                        return '';
                    }

                    if (
                        meta?.type === 'enum' &&
                        Array.isArray(meta.values)
                    ) {
                        const associatedColorKey = avatarColorMap[key];
                        const colorPickerHTML = associatedColorKey
                            ? renderColorPicker(associatedColorKey)
                            : '';

                        return `
                            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                                <span class="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1.5">
                                    ${label}
                                </span>

                                <div class="flex items-center gap-2">
                                    <select
                                        id="${id}"
                                        data-avatar-option="${key}"
                                        onchange="${key === 'facialHairVariant' ? "handleFacialHairChange()" : key === 'accessoriesVariant' ? "handleAccessoriesChange()" : 'updateCharacterPreview()'}"
                                        class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-[11px] font-bold outline-none focus:border-pink-500 shadow-inner"
                                    >
                                        ${key === 'facialHairVariant' ? `<option value="none" ${(!savedValue || savedValue === 'none') ? 'selected' : ''}>Nenhum</option>` : ''}
                                        ${key === 'accessoriesVariant' ? `<option value="none" ${(!savedValue || savedValue === 'none') ? 'selected' : ''}>Sem óculos / acessório</option>` : ''}
                                        ${meta.values.map(v => `
                                            <option
                                                value="${String(v).replace(/"/g, '&quot;')}"
                                                ${String(savedValue ?? '') === String(v) ? 'selected' : ''}
                                            >
                                                ${avatarValueLabel(v)}
                                            </option>
                                        `).join('')}
                                    </select>

                                    ${colorPickerHTML}
                                </div>
                            </div>`;
                    }

                    return '';
                };

                // Tom de pele não possui um componente associado,
                // então ele recebe seu próprio controle de cor.
                const skinColorHTML = renderColorPicker('skinColor');

                container.innerHTML = `
                    <div class="space-y-3">
                        <div class="flex items-center gap-2 mb-1">
                            <div class="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                                <i class="ph-fill ph-palette"></i>
                            </div>

                            <div>
                                <h5 class="text-xs font-black text-white">
                                    Customização
                                </h5>

                                <p class="text-[9px] text-slate-500">
                                    Altere a peça e ajuste a cor logo ao lado.
                                </p>
                            </div>
                        </div>

                        <div class="character-options-list space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            ${mainItems.map(renderField).join('')}

                            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                                <span class="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1.5">
                                    Tom de pele
                                </span>

                                <div class="flex items-center gap-2">
                                    ${skinColorHTML}
                                </div>
                            </div>
                        </div>
                    </div>`;

                // Restaura as probabilidades internas, sem mostrar controles extras.
                const facialHairProbability = document.createElement('input');
                facialHairProbability.type = 'hidden';
                facialHairProbability.id = 'db-facialHairProbability';
                facialHairProbability.dataset.avatarOption = 'facialHairProbability';
                facialHairProbability.value =
                    getSavedValue('facialHairProbability') ?? (getSavedValue('facialHairVariant') === 'none' ? '0' : '100');
                container.appendChild(facialHairProbability);

                const accessoriesProbability = document.createElement('input');
                accessoriesProbability.type = 'hidden';
                accessoriesProbability.id = 'db-accessoriesProbability';
                accessoriesProbability.dataset.avatarOption = 'accessoriesProbability';
                accessoriesProbability.value =
                    getSavedValue('accessoriesProbability') ??
                    ((!getSavedValue('accessoriesVariant') || getSavedValue('accessoriesVariant') === 'none') ? '0' : '100');
                container.appendChild(accessoriesProbability);

                const clothesGraphicProbability = document.createElement('input');
                clothesGraphicProbability.type = 'hidden';
                clothesGraphicProbability.id = 'db-clothesGraphicProbability';
                clothesGraphicProbability.dataset.avatarOption = 'clothesGraphicProbability';
                clothesGraphicProbability.value =
                    getSavedValue('clothesGraphicProbability') ?? '100';
                container.appendChild(clothesGraphicProbability);

                updateCharacterPreview();

            } catch (error) {
                console.error('Erro ao carregar opções do Avataaars:', error);

                container.innerHTML = `
                    <div class="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
                        <i class="ph-fill ph-warning text-red-400 text-xl"></i>
                        <p class="text-[10px] font-bold text-red-300 mt-2">
                            Não foi possível carregar o criador.
                        </p>
                    </div>`;
            }
        };

        window.setAvatarColor=(id,color)=>{const input=document.getElementById(id), label=document.getElementById(`${id}-text-label`); if(input)input.value=color; if(label)label.textContent=color; updateCharacterPreview();};

        window.getCharacterConfigFromUI = () => {
            const styleEl = document.getElementById('db-style');

            if (!styleEl) {
                return defaultCharacter();
            }

            const options = {};

            document
                .querySelectorAll('#dynamic-avatar-fields [data-avatar-option]')
                .forEach(field => {
                    const key = field.dataset.avatarOption;

                    let value;

                    if (field.type === 'checkbox') {
                        value = field.checked;
                    } else {
                        value = field.value;
                    }

                    if (
                        value === '' ||
                        value === undefined ||
                        value === null
                    ) {
                        return;
                    }

                    // DiceBear aceita cores hexadecimais sem o '#'
                    // nos parâmetros da HTTP API.
                    if (
                        field.type === 'color' &&
                        typeof value === 'string'
                    ) {
                        value = value.replace(/^#/, '');
                    }

                    if (key === 'accessoriesVariant' && value === 'none') {
                        options.accessoriesProbability = '0';
                        return;
                    }

                    options[key] = value;
                });

            const accessoriesSelect = document.getElementById('db-accessoriesVariant');
            if (accessoriesSelect?.value === 'none') {
                delete options.accessoriesVariant;
                options.accessoriesProbability = '0';
            }

            const facialHairSelect = document.getElementById('db-facialHairVariant');
            if (facialHairSelect?.value === 'none') {
                delete options.facialHairVariant;
                options.facialHairProbability = '0';
            }

            if (!window.currentAvatarSeed) {
                window.currentAvatarSeed =
                    currentUser?.uid || 'elo-preview';
            }

            return {
                provider: 'dicebear',
                style: styleEl.value || 'avataaars',
                seed: window.currentAvatarSeed,
                options
            };
        };

        window.handleFacialHairChange = () => {
            const select = document.getElementById('db-facialHairVariant');
            const probability = document.getElementById('db-facialHairProbability');
            if (select && probability) probability.value = select.value === 'none' ? '0' : '100';
            updateCharacterPreview();
        };

        window.handleAccessoriesChange = () => {
            const select = document.getElementById('db-accessoriesVariant');
            const probability = document.getElementById('db-accessoriesProbability');
            if (select && probability) probability.value = select.value === 'none' ? '0' : '100';
            updateCharacterPreview();
        };

        window.updateCharacterPreview = () => {
            const container =
                document.getElementById('character-preview');

            if (!container) return;

            const config = getCharacterConfigFromUI();

            if (config.provider !== 'dicebear') {
                container.innerHTML =
                    renderAvatar(config, currentUser?.uid);
                return;
            }

            const params = new URLSearchParams();

            params.set(
                'seed',
                config.seed || currentUser?.uid || 'elo-preview'
            );

            Object.entries(config.options || {}).forEach(([key, value]) => {
                if (
                    value === undefined ||
                    value === null ||
                    value === ''
                ) {
                    return;
                }

                if (Array.isArray(value)) {
                    params.set(key, value.join(','));
                    return;
                }

                if (typeof value === 'boolean') {
                    params.set(key, value ? 'true' : 'false');
                    return;
                }

                // A API HTTP do DiceBear usa hexadecimal sem '#'
                // para as opções de cor.
                if (
                    typeof value === 'string' &&
                    key.toLowerCase().includes('color')
                ) {
                    params.set(key, value.replace(/^#/, ''));
                    return;
                }

                params.set(key, String(value));
            });

            /*
             * Se o usuário escolheu uma barba, acessório ou estampa,
             * precisamos garantir que o componente esteja habilitado.
             *
             * No Avataaars:
             * - barba: default 10%
             * - acessórios: default 10%
             * - estampa: default 100%
             */
            const facialHair = config.options.facialHairVariant;

            if (!facialHair || facialHair === 'none') {
                params.delete('facialHairVariant');
                params.set('facialHairProbability', '0');
            } else {
                params.set('facialHairProbability', '100');
            }

            const accessories =
                config.options.accessoriesVariant;

            if (!accessories || accessories === 'none') {
                params.delete('accessoriesVariant');
                params.set('accessoriesProbability', '0');
            } else {
                params.set('accessoriesProbability', '100');
            }

            const graphic =
                config.options.clothesGraphicVariant;

            if (graphic) {
                params.set('clothesGraphicProbability', '100');
            } else {
                params.set('clothesGraphicProbability', '0');
            }

            // Evita cache do navegador durante a edição.
            // Mantém o cache do navegador para evitar uma nova requisição a cada toque.
            // O preview é atualizado pela própria URL das opções selecionadas.

            const img = document.createElement('img');

            img.className =
                'w-full h-full drop-shadow-md object-contain';

            img.alt = 'Seu personagem';
            img.decoding = 'async';

            img.onload = () => {
                container.replaceChildren(img);
            };

            img.onerror = () => {
                console.error(
                    'Erro ao carregar avatar DiceBear:',
                    img.src
                );
            };

            img.src =
                `https://api.dicebear.com/10.x/avataaars/svg?${params.toString()}`;
        };

        window.randomizeCharacter = () => {
            // O seed só muda quando o usuário pede um novo personagem aleatório.
            window.currentAvatarSeed =
                'random-' +
                Date.now() +
                '-' +
                Math.random()
                    .toString(36)
                    .substring(2, 10);

            document
                .querySelectorAll(
                    '#dynamic-avatar-fields [data-avatar-option]'
                )
                .forEach(field => {

                    if (field.type === 'checkbox') {
                        field.checked = Math.random() > 0.5;
                        return;
                    }

                    if (field.type === 'color') {
                        field.value =
                            avatarColorPresets[
                                Math.floor(
                                    Math.random() *
                                    avatarColorPresets.length
                                )
                            ];
                        return;
                    }

                    if (
                        field.tagName === 'SELECT' &&
                        field.options.length
                    ) {
                        field.value =
                            field.options[
                                Math.floor(
                                    Math.random() *
                                    field.options.length
                                )
                            ].value;
                    }
                });

            // O aleatório pode escolher "nenhum". Nesse caso a probabilidade também
            // precisa ficar em zero para o DiceBear não inserir óculos/barba sozinho.
            const facialHairProbability = document.getElementById('db-facialHairProbability');
            const facialHairVariant = document.getElementById('db-facialHairVariant');
            if (facialHairProbability) {
                facialHairProbability.value = facialHairVariant?.value === 'none' ? '0' : '100';
            }

            const accessoriesProbability = document.getElementById('db-accessoriesProbability');
            const accessoriesVariant = document.getElementById('db-accessoriesVariant');
            if (accessoriesProbability) {
                accessoriesProbability.value = accessoriesVariant?.value === 'none' ? '0' : '100';
            }

            const clothesGraphicProbability =
                document.getElementById(
                    'db-clothesGraphicProbability'
                );

            if (clothesGraphicProbability) {
                clothesGraphicProbability.value = '100';
            }

            updateCharacterPreview();
        };

        window.resetCharacter = () => {
            const styleEl = document.getElementById('db-style');

            if (styleEl) {
                styleEl.value = 'avataaars';
            }

            window.currentAvatarSeed =
                currentUser?.uid || 'elo-seed';

            window.avatarEditorTab = 'appearance';

            updateAvatarFields();
        };

        window.handlePhotoUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > height) { if (width > 150) { height *= 150/width; width = 150; } } 
                    else { if (height > 150) { width *= 150/height; height = 150; } }
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const b64 = canvas.toDataURL('image/jpeg', 0.6);
                    const imgEl = document.getElementById('profile-photo-img');
                    imgEl.src = b64; imgEl.dataset.base64 = b64;
                    imgEl.classList.remove('hidden');
                    document.getElementById('profile-photo-placeholder').classList.add('hidden');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };

        // Código do Elo: o fluxo principal não depende mais do link.
        // Também aceitamos um link inteiro colado no campo por compatibilidade.
        const normalizeEloJoinCode = (value = '') => {
            let raw = String(value || '').trim();

            try {
                if (/^https?:\/\//i.test(raw)) {
                    const parsed = new URL(raw);
                    raw = parsed.searchParams.get('join') || '';
                }
            } catch (_) {}

            // Os Elos atuais usam exatamente 4 dígitos.
            return raw.replace(/\D/g, '').slice(0, 4);
        };

        window.normalizeEloCodeInput = input => {
            if (!input) return;
            const normalized = normalizeEloJoinCode(input.value);
            if (input.value !== normalized) input.value = normalized;
        };

        const inviteCode = normalizeEloJoinCode(
            new URLSearchParams(window.location.search).get('join') || ''
        );
        let inviteAutoJoinInProgress = false;

        const getInviteUrl = (code = coupleId) => {
            if (!code) return window.location.href;
            const url = new URL(window.location.href);
            url.search = '';
            url.hash = '';
            url.searchParams.set('join', code);
            return url.toString();
        };

        const updateInviteUI = () => {
            const banner = document.getElementById('invite-banner');
            const text = document.getElementById('invite-banner-text');
            if (!banner) return;
            if (inviteCode) {
                banner.classList.remove('hidden');
                if (text) text.textContent = `Código ${inviteCode}. Entre com Google e, se o Elo estiver disponível, você será conectado automaticamente.`;
                const codeInput = document.getElementById('elo-code');
                if (codeInput) codeInput.value = inviteCode;
            } else {
                banner.classList.add('hidden');
            }
        };
        updateInviteUI();

        const getYesterdayDateKey = () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return getGameDateKey(d);
        };

        const defaultCharacter = () => ({
            skin: 'fcd34d', face: 'round', eyes: 'normal', mouth: 'smile',
            hair: 'spiky', hairColor: '0f172a', shirt: 'tshirt', shirtColor: '3b82f6', facialHairVariant: 'none', facialHairProbability: '0',
            pants: 'jeans', pantsColor: '1e293b', accessory: 'none'
        });

        const createEmptyStreak = () => ({
            current: 0, longest: 0, lastCompletedDate: '', status: 'waiting', today: {}
        });

        const getStreakData = (data) => {
            const users = data?.users || {};
            const streak = { ...createEmptyStreak(), ...(data?.streak || {}) };
            const today = getGameDateKey();
            const todayChecks = { ...(streak.today || {}) };
            Object.keys(todayChecks).forEach(uid => {
                if (todayChecks[uid] !== today) delete todayChecks[uid];
            });
            const ids = Object.keys(users);
            const checkedUsers = ids.filter(uid => todayChecks[uid] === today);
            const hasPartner = ids.length >= 2;
            const bothChecked = hasPartner && ids.every(uid => todayChecks[uid] === today);
            let status = 'waiting';
            if (!hasPartner) status = 'waiting_partner';
            else if (bothChecked) status = 'completed';
            else if (checkedUsers.length) status = 'at_risk';
            return { ...streak, today: todayChecks, status, checkedUsers, bothChecked, hasPartner, today };
        };

        const getNewEloCode = async () => {
            for (let attempt = 0; attempt < 12; attempt++) {
                const code = Math.floor(1000 + Math.random() * 9000).toString();
                const snap = await getDoc(doc(db, 'relationships', code));
                if (!snap.exists()) return code;
            }
            throw new Error('Não foi possível gerar um código único. Tente novamente.');
        };

        const saveUserProfile = async (uid, code, name, extra = {}) => {
            if (!uid || !code) return;
            try {
                await setDoc(doc(db, 'userProfiles', uid), {
                    uid, coupleId: code, name: name || 'Eu', updatedAt: Date.now(),
                    displayName: extra.displayName || currentUser?.displayName || '',
                    email: extra.email || currentUser?.email || '',
                    photoUrl: extra.photoUrl || currentUser?.photoURL || ''
                }, { merge: true });
            } catch (e) { console.warn('Não foi possível salvar o perfil do usuário:', e); }
        };

        const restoreCoupleFromProfile = async (uid) => {
            if (!uid || uid === 'anonymous') return false;
            try {
                const profile = await getDoc(doc(db, 'userProfiles', uid));
                if (!profile.exists()) return false;

                const data = profile.data();
                if (!data.coupleId) return false;

                // V35: não fazemos um GET do relacionamento aqui e outro logo depois no onSnapshot.
                // O listener principal valida a existência/participação e economiza uma viagem de rede no login.
                localStorage.setItem('elo_coupleId', data.coupleId);
                coupleId = data.coupleId;

                const input = document.getElementById('user-name');
                if (input && data.name) input.value = data.name;
                return true;
            } catch (e) {
                console.warn('Não foi possível restaurar o Elo da conta:', e);
                return false;
            }
        };

        const updateGoogleAccountUI = (user) => {
            const status = document.getElementById('google-account-status');
            const btn = document.getElementById('google-login-btn');
            const label = document.getElementById('google-login-label');
            if (!status || !btn || !label) return;
            if (user && !user.isAnonymous) {
                status.classList.remove('hidden');
                document.getElementById('google-account-name').textContent = user.displayName || 'Conta Google';
                document.getElementById('google-account-email').textContent = user.email || '';
                const photo = document.getElementById('google-account-photo');
                if (user.photoURL) { photo.src = user.photoURL; photo.classList.remove('hidden'); } else photo.classList.add('hidden');
                label.textContent = 'Conta Google conectada';
                btn.classList.add('opacity-70');
            } else {
                status.classList.add('hidden');
                label.textContent = 'Continuar com Google';
                btn.classList.remove('opacity-70');
            }
        };

        const getNativeFirebaseAuth = () => {
            if (!isNativeApp) return null;
            const plugin = window.Capacitor?.Plugins?.FirebaseAuthentication;
            if (!plugin) {
                console.error('FirebaseAuthentication não foi carregado pelo bridge do Capacitor.');
                return null;
            }
            return plugin;
        };

        window.signInWithGoogle = async () => {
            const button = document.getElementById('google-login-btn');
            if (button) button.disabled = true;
            document.getElementById('loading-screen')?.classList.remove('hidden');
            try {
                if (isNativeApp) {
                    // APK: o Google Sign-In acontece na camada nativa. O plugin devolve a
                    // credencial Google e nós a entregamos ao Firebase Web SDK, que continua
                    // sendo a fonte única de auth para Firestore/R2 e para onAuthStateChanged.
                    const nativeAuth = getNativeFirebaseAuth();
                    if (!nativeAuth) throw Object.assign(new Error('Plugin de autenticação Android indisponível.'), { code: 'elo/native-auth-plugin-missing' });

                    const result = await nativeAuth.signInWithGoogle({
                        skipNativeAuth: true,
                        useCredentialManager: true
                    });
                    const idToken = result?.credential?.idToken || '';
                    const accessToken = result?.credential?.accessToken || '';
                    if (!idToken && !accessToken) {
                        throw Object.assign(new Error('O Google não devolveu uma credencial utilizável.'), { code: 'elo/native-google-credential-missing' });
                    }

                    const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
                    await signInWithCredential(auth, credential);
                } else {
                    const provider = new GoogleAuthProvider();
                    provider.setCustomParameters({ prompt: 'select_account' });
                    await signInWithPopup(auth, provider);
                }
            } catch (err) {
                console.error('Login Google:', err);
                let message = 'Não foi possível entrar com Google.';
                const code = String(err?.code || '');
                const detail = String(err?.message || '');
                if (code === 'auth/popup-closed-by-user' || /cancel/i.test(detail)) message = 'Login cancelado.';
                if (code === 'auth/unauthorized-domain') message = 'Este domínio ainda não está autorizado no Firebase Authentication.';
                if (code === 'auth/operation-not-allowed') message = 'Ative o provedor Google no Firebase Authentication.';
                if (code === 'elo/native-auth-plugin-missing') message = 'O login Android ainda não foi sincronizado. Rode npm install e npm run android:sync.';
                if (code === 'elo/native-google-credential-missing') message = 'O Android não conseguiu concluir a credencial Google. Confira SHA-1/SHA-256 e google-services.json.';
                if (/10:|developer_error|DEVELOPER_ERROR/i.test(detail)) message = 'Configuração Google do APK não confere. Revise o SHA e baixe novamente o google-services.json.';
                document.getElementById('loading-screen')?.classList.add('hidden');
                showToast(message, 'error');
            } finally {
                if (button) button.disabled = false;
            }
        };

        window.createElo = async () => {
            if (!currentUser || currentUser.isAnonymous) {
                return showToast('Entre com sua conta Google antes de criar um Elo.', 'error');
            }
            const name = document.getElementById('user-name').value.trim() || currentUser.displayName || 'Eu';
            document.getElementById('loading-screen').classList.remove('hidden');
            try {
                const code = await getNewEloCode();
                await setDoc(doc(db, 'relationships', code), {
                    createdAt: Date.now(),
                    users: { [currentUser.uid]: {
                        name, photoUrl: currentUser?.photoURL || '', character: defaultCharacter(),
                        checkedInToday: false, lastCheckInDate: '', typing: false, lastSeen: Date.now(),
                        coins: 50, xp: 0
                    }},
                    streak: { current: 0, longest: 0, lastCompletedDate: '', status: 'waiting_partner', today: {} },
                    stats: { synergy: 50, streak: 0, lives: 0, lastStreakDate: '', checkedInToday: false, streakVersion: 2 },
                    inventory: [], quests: [], messages: []
                });
                localStorage.setItem('elo_coupleId', code);
                coupleId = code;
                await saveUserProfile(currentUser.uid, code, name);
                setupSync();
                setTimeout(openProfileModal, 700);
            } catch (err) {
                console.error(err); showToast('Não foi possível criar o Elo.', 'error');
            } finally { document.getElementById('loading-screen').classList.add('hidden'); }
        };

        window.joinElo = async (directCode = '') => {
            if (!currentUser || currentUser.isAnonymous) return showToast('Entre com sua conta Google primeiro.', 'error');

            const name = document.getElementById('user-name')?.value.trim() || currentUser.displayName || 'Eu';
            const source = directCode || document.getElementById('elo-code')?.value || '';
            const code = normalizeEloJoinCode(source);

            if (code.length !== 4) {
                const input = document.getElementById('elo-code');
                if (input) {
                    input.value = code;
                    input.focus({preventScroll:true});
                }
                return showToast('Digite os 4 dígitos do código do Elo.', 'info');
            }

            document.getElementById('loading-screen').classList.remove('hidden');
            try {
                const docRef = doc(db, 'relationships', code);
                const snap = await getDoc(docRef);
                if (!snap.exists()) return showToast('Não encontramos um Elo com esse código. Confira os 4 dígitos.', 'error');
                const data = snap.data();
                const users = data.users || {};
                const ids = Object.keys(users);
                if (ids.includes(currentUser.uid)) {
                    localStorage.setItem('elo_coupleId', code); coupleId = code; await saveUserProfile(currentUser.uid, code, name); setupSync(); return;
                }
                if (ids.length >= 2) return showToast('Este Elo já está completo. Um casal pode ter apenas 2 pessoas.', 'error');
                await updateDoc(docRef, {
                    [`users.${currentUser.uid}`]: { name, photoUrl: currentUser?.photoURL || '', character: defaultCharacter(), checkedInToday: false, lastCheckInDate: '', typing: false, lastSeen: Date.now(), coins: 50, xp: 0 },
                    'streak.status': 'waiting'
                });
                localStorage.setItem('elo_coupleId', code); coupleId = code; await saveUserProfile(currentUser.uid, code, name); setupSync(); setTimeout(openProfileModal, 700);
            } catch (err) {
                console.error(err); showToast('Não foi possível entrar no Elo.', 'error');
            } finally { document.getElementById('loading-screen').classList.add('hidden'); }
        };
        const STREAK_REWARDS = {7:100,14:200,30:500,50:800,100:2000,180:5000,365:10000};
        const getNextStreakReward = current => {
            const next = Object.keys(STREAK_REWARDS).map(Number).sort((a,b)=>a-b).find(v=>v>Number(current||0));
            return next ? {days:next,reward:STREAK_REWARDS[next]} : null;
        };
        const grantStreakMilestone = async (streakValue) => {
            const reward = STREAK_REWARDS[streakValue];
            if (!reward) return;
            try {
                const ref = doc(db, 'relationships', coupleId);
                let granted = false;
                await runTransaction(db, async transaction => {
                    const snap = await transaction.get(ref);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (data?.streak?.rewards?.[streakValue]) return;
                    const ids = Object.keys(data?.users || {});
                    const updates = {
                        [`streak.rewards.${streakValue}`]: true
                    };
                    ids.forEach(uid => updates[`users.${uid}.coins`] = increment(reward));
                    transaction.update(ref, updates);
                    granted = true;
                });
                if (granted) showToast(`🔥 ${streakValue} dias! +${reward} Coins para cada um`,'reward');
            } catch(e) { console.warn('Marco da chama:', e); }
        };

window.checkInToday = async (buttonEl = null) => {
            if (!coupleData || !currentUser) return;
            const today = getGameDateKey();
            const beforeCheckInData = coupleData;
            const localStreak = getStreakData(coupleData);
            if (localStreak.today?.[currentUser.uid] === today) return showToast('Você já fez seu check-in de hoje! 🔥', 'info');

            // Feedback otimista: a chama responde no toque, sem esperar a transação remota.
            if (buttonEl) {
                if (buttonEl.dataset.busy === '1') return;
                buttonEl.dataset.busy = '1';
                buttonEl.disabled = true;
                buttonEl.classList.remove('opacity-70');
                buttonEl.classList.add('bg-emerald-600');
                buttonEl.innerHTML = '<i class="ph-fill ph-check-circle text-xl"></i> Sua parte está feita!';
            }
            coupleData = {
                ...coupleData,
                streak: {...localStreak, today:{...(localStreak.today||{}), [currentUser.uid]:today}, status:'at_risk'},
                users:{...(coupleData.users||{}), [currentUser.uid]:{...(coupleData.users?.[currentUser.uid]||{}), checkedInToday:true, lastCheckInDate:today}}
            };
            updateUI();
            showToast('Check-in registrado no seu aparelho ❤️', 'success');

            const docRef = doc(db, 'relationships', coupleId);
            let result = null;
            try {
                await runTransaction(db, async transaction => {
                    const snap = await transaction.get(docRef);
                    if (!snap.exists()) throw new Error('Elo não encontrado.');
                    const data = snap.data();
                    const users = data.users || {};
                    if (!users[currentUser.uid]) throw new Error('Usuário não pertence a este Elo.');
                    const ids = Object.keys(users);
                    const old = { ...createEmptyStreak(), ...(data.streak || {}) };
                    const todayChecks = { ...(old.today || {}) };
                    Object.keys(todayChecks).forEach(uid => { if (todayChecks[uid] !== today) delete todayChecks[uid]; });
                    if (todayChecks[currentUser.uid] === today) {
                        result = { already: true, streak: Number(old.current || data.stats?.streak || 0) }; return;
                    }
                    todayChecks[currentUser.uid] = today;
                    const everyoneChecked = ids.length === 2 && ids.every(uid => todayChecks[uid] === today);
                    let nextStreak = Number(old.current || data.stats?.streak || 0);
                    let longest = Number(old.longest || nextStreak);
                    let lastCompletedDate = old.lastCompletedDate || data.stats?.lastStreakDate || '';
                    let reward = 0, completedNow = false;
                    if (everyoneChecked && lastCompletedDate !== today) {
                        nextStreak = lastCompletedDate === getYesterdayDateKey() ? nextStreak + 1 : Math.max(1, nextStreak);
                        longest = Math.max(longest, nextStreak);
                        lastCompletedDate = today;
                        reward = nextStreak === 1 ? 20 : 50;
                        completedNow = true;
                    }
                    transaction.update(docRef, {
                        [`users.${currentUser.uid}.checkedInToday`]: true,
                        [`users.${currentUser.uid}.lastCheckInDate`]: today,
                        streak: { current: nextStreak, longest, lastCompletedDate, status: everyoneChecked ? 'completed' : 'at_risk', today: todayChecks },
                        'stats.streak': nextStreak,
                        'stats.lastStreakDate': lastCompletedDate,
                        'stats.checkedInToday': everyoneChecked,
                        ...(reward ? Object.fromEntries(ids.map(uid => [`users.${uid}.coins`, increment(reward)])) : {})
                    });
                    result = { already: false, completed: completedNow, both: everyoneChecked, streak: nextStreak, reward };
                });
                if (!result?.already) backgroundChatTask(createPartnerNotification({ title: '🔥 Check-in do casal', body: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} fez o check-in de hoje.`, type: 'checkin' }), 'Push da chama');
                if (result?.completed) {
                    showToast(`🔥 Chama ${result.streak}! +${result.reward} Elo Coins`, 'success');
                    backgroundChatTask(grantStreakMilestone(result.streak),'Marco da chama');
                }
            } catch (err) {
                console.error(err);
                showToast(err.message || 'Erro ao registrar check-in.', 'error');
                coupleData = beforeCheckInData;
                updateUI();
                if (buttonEl) { buttonEl.dataset.busy='0'; buttonEl.disabled=false; }
            }
        };

        window.useGoogleProfilePhoto = () => {
            const photoUrl = currentUser?.photoURL || '';
            if (!photoUrl) return showToast('Sua conta Google não possui uma foto de perfil.', 'error');
            const imgEl = document.getElementById('profile-photo-img');
            const placeholder = document.getElementById('profile-photo-placeholder');
            imgEl.src = photoUrl;
            imgEl.dataset.base64 = photoUrl;
            imgEl.dataset.source = 'google';
            imgEl.classList.remove('hidden');
            placeholder.classList.add('hidden');
            showToast('Foto do Google aplicada ao seu perfil! 📸', 'success');
        };

        window.openProfileModal = () => {
            if (!coupleData || !coupleData.users[currentUser.uid]) return;
            const myData = coupleData.users[currentUser.uid];
            const levelInfo = getUserLevelInfo(coupleData, currentUser.uid);
            document.getElementById('edit-name').value = myData.name || 'Eu';
            const profileContent = document.querySelector('#profile-modal .overflow-y-auto') || document.querySelector('#profile-modal > div > div');
            if (profileContent) {
                let levelCard = document.getElementById('profile-level-card');
                if (!levelCard) {
                    levelCard = document.createElement('div');
                    levelCard.id = 'profile-level-card';
                    levelCard.className = 'mx-5 mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4';
                    profileContent.prepend(levelCard);
                }
                levelCard.innerHTML = `<div class="flex items-center justify-between"><div><p class="text-[9px] uppercase tracking-widest font-black text-purple-300">Sua progressão</p><p class="font-black text-white mt-1">Nível ${levelInfo.level} · ${levelInfo.title}</p></div><div class="text-right"><p class="text-xs font-black text-cyan-300">${levelInfo.xp.toLocaleString('pt-BR')} XP</p><p class="text-[9px] text-slate-400">${levelInfo.next ? `${levelInfo.remaining} para o próximo` : 'Nível máximo'}</p></div></div><div class="h-2 bg-slate-950 rounded-full overflow-hidden mt-3"><div class="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full" style="width:${levelInfo.progress}%"></div></div>`;
            }

            const imgEl = document.getElementById('profile-photo-img');
            const placeholder = document.getElementById('profile-photo-placeholder');

            const googlePhotoUrl = currentUser?.photoURL || '';
            const profilePhotoUrl = myData.photoUrl || googlePhotoUrl;
            if (profilePhotoUrl) {
                imgEl.src = profilePhotoUrl;
                imgEl.dataset.base64 = profilePhotoUrl;
                imgEl.dataset.source = myData.photoUrl ? 'profile' : 'google';
                imgEl.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                imgEl.src = '';
                imgEl.dataset.base64 = '';
                imgEl.dataset.source = '';
                imgEl.classList.add('hidden');
                placeholder.classList.remove('hidden');
                placeholder.textContent = (myData.name || 'E').charAt(0).toUpperCase();
            }

            const char = myData.character;
            if (char && char.provider === 'dicebear') {
                const styleEl = document.getElementById('db-style');
                if(styleEl) styleEl.value = char.style || 'avataaars';
                
                window.currentAvatarSeed = char.seed || currentUser?.uid || 'elo-seed';
                
                updateAvatarFields(char.options); 
            } else {
                window.currentAvatarSeed = currentUser?.uid || 'elo-seed';
                updateAvatarFields();
            }

            document.getElementById('profile-modal').classList.remove('hidden');
        };

        window.closeProfileModal = () => document.getElementById('profile-modal').classList.add('hidden');
        window.saveProfile = async () => {
            const name = document.getElementById('edit-name').value.trim() || 'Eu';
            const config = getCharacterConfigFromUI();

            try {
                await updateDoc(doc(db, 'relationships', coupleId), {
                    [`users.${currentUser.uid}.name`]: name,
                    [`users.${currentUser.uid}.character`]: config,
                    [`users.${currentUser.uid}.photoUrl`]: document.getElementById('profile-photo-img').dataset.base64 || currentUser?.photoURL || ''
                });
                closeProfileModal();
                showToast("Seu personagem foi atualizado! ✨", "success");
            } catch (err) {
                console.error(err);
                showToast("Não foi possível salvar o personagem.", "error");
            }
        };

        let eloConfirmAction = null;
        window.openEloConfirm = ({title='Confirmar ação',message='',confirmLabel='Confirmar',danger=false,onConfirm=null}={}) => {
            eloConfirmAction = typeof onConfirm === 'function' ? onConfirm : null;
            openGenericModal(`<div class="space-y-4"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black ${danger?'text-red-400':'text-pink-400'}">Confirmação</p><h3 class="text-xl font-black text-white mt-1">${escapeHTML(title)}</h3></div><button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-900 text-slate-400">✕</button></div><p class="text-sm text-slate-300 leading-relaxed">${escapeHTML(message)}</p><div class="grid grid-cols-2 gap-2"><button onclick="closeGenericModal()" class="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-black text-xs">Cancelar</button><button onclick="runEloConfirmAction()" class="py-3 rounded-xl ${danger?'bg-red-600':'bg-pink-600'} text-white font-black text-xs">${escapeHTML(confirmLabel)}</button></div></div>`);
        };
        window.runEloConfirmAction = async () => { const action=eloConfirmAction; eloConfirmAction=null; closeGenericModal(); if(action) await action(); };
        window.openSynergyInfo = () => openGenericModal(`<div class="space-y-4"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black text-rose-400">❤️ Sinergia</p><h3 class="text-xl font-black text-white mt-1">A conexão de vocês no Elo</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><p class="text-sm text-slate-300 leading-relaxed">A Sinergia cresce com interações dentro do Elo, como conversar e compartilhar mídia no Chat. Ela é um indicador leve de participação, não uma nota do relacionamento.</p><div class="rounded-2xl bg-slate-900 border border-slate-800 p-4"><p class="text-[10px] uppercase tracking-widest font-black text-slate-500">Importante</p><p class="text-xs text-slate-400 mt-1">Não existe “relacionamento melhor” por ter um número maior. É só uma brincadeira de progresso do app.</p></div></div>`);

        // --- SISTEMA DE JOGO (LOJA, INVENTÁRIO, MISSÕES, CHAT) ---
        const getProfileName = uid => coupleData?.users?.[uid]?.name || (uid === currentUser?.uid ? currentUser?.displayName : '') || 'Amor';
        const getPartnerProfile = () => { const uid=partnerUidOf(); return {uid,name:uid?getProfileName(uid):'Seu amor'}; };

        const showPurchaseCelebration = (item, subtitle='Agora é seu!') => {
            if (!item) return;
            document.getElementById('elo-purchase-celebration')?.remove();
            const el=document.createElement('div');
            el.id='elo-purchase-celebration';
            el.className='elo-purchase-celebration';
            const icon=item.emoji || (item.delivery==='chat_gift'?'💝':'🎟️');
            el.innerHTML=`<div class="elo-purchase-burst">${Array.from({length:10},(_,i)=>`<i style="--i:${i}">✦</i>`).join('')}</div><div class="elo-purchase-card"><div class="elo-purchase-icon">${icon}</div><p class="elo-purchase-kicker">CONQUISTADO!</p><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(subtitle)}</p></div>`;
            document.body.appendChild(el);
            try { if (navigator.vibrate) navigator.vibrate([25,35,45]); } catch(_){}
            requestAnimationFrame(()=>el.classList.add('is-visible'));
            setTimeout(()=>{el.classList.remove('is-visible');setTimeout(()=>el.remove(),350)},1800);
        };

        window.buyStoreItem = async (id, price, title) => {
            if (!coupleData || !currentUser) return;
            const item=getStoreItem(id) || {id,title,price};
            if (item.delivery === 'chat_gift') return openVirtualGiftComposer(item.id);
            const balance = getUserCoins(coupleData, currentUser.uid);
            if (balance < price) return showToast("Moedas insuficientes!", "error");
            try {
                const inventoryId=`inv_${Date.now()}_${currentUser.uid.slice(0,6)}`;
                await runTransaction(db, async tx => {
                    const ref=doc(db,'relationships',coupleId); const snap=await tx.get(ref);
                    if(!snap.exists()) throw new Error('Elo não encontrado.');
                    const data=snap.data(); const coins=Number(data?.users?.[currentUser.uid]?.coins||0);
                    if(coins < Number(price||0)) throw new Error('Moedas insuficientes!');
                    const inventory=Array.isArray(data.inventory)?data.inventory.slice():[];
                    inventory.push({id:inventoryId,itemId:String(id),title,owner:currentUser.uid,status:'available',purchasedAt:Date.now(),price:Number(price||0)});
                    tx.update(ref,{[`users.${currentUser.uid}.coins`]:coins-Number(price||0),inventory});
                });
                showPurchaseCelebration(item,'Guardado na sua Bolsa');
                showToast("Item comprado! Olhe na sua Bolsa.", "success");
            } catch(e){ console.error(e); showToast(e.message||'Não foi possível comprar.','error'); }
        };

        window.openVirtualGiftComposer = id => {
            const item=getStoreItem(id); if(!item||item.delivery!=='chat_gift')return;
            const partner=getPartnerProfile(); const balance=getUserCoins(coupleData,currentUser.uid);
            openGenericModal(`<div class="space-y-4 elo-gift-compose"><div class="flex justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">Presente para ${escapeHTML(partner.name)}</p><h3 class="text-2xl font-black text-white">${item.emoji||'💝'} ${escapeHTML(item.title)}</h3></div><button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-900 text-slate-400"><i class="ph-bold ph-x"></i></button></div><div class="elo-gift-preview"><span>${item.emoji||'💝'}</span><p>${escapeHTML(item.desc)}</p></div><textarea id="virtual-gift-message" maxlength="500" class="w-full h-28 bg-slate-900 border border-slate-800 rounded-2xl p-3 text-white text-sm outline-none focus:border-pink-500" placeholder="Escreva uma mensagem para acompanhar o presente..."></textarea><div class="flex items-center justify-between text-xs"><span class="text-slate-500">Seu saldo: <b class="text-yellow-400">${balance.toLocaleString('pt-BR')} Coins</b></span><span class="font-black text-pink-300">${item.price.toLocaleString('pt-BR')} Coins</span></div><button ${balance<item.price?'disabled':''} onclick="sendVirtualGift('${item.id}')" class="w-full py-3.5 rounded-2xl font-black ${balance>=item.price?'bg-pink-600 text-white active:scale-[.98]':'bg-slate-800 text-slate-500'}">${balance>=item.price?'Enviar presente ❤️':'Coins insuficientes'}</button></div>`);
            setTimeout(()=>document.getElementById('virtual-gift-message')?.focus(),120);
        };

        window.sendVirtualGift = async id => {
            const item=getStoreItem(id); const partner=getPartnerProfile();
            if(!item||item.delivery!=='chat_gift'||!partner.uid)return;
            const typedNote=(document.getElementById('virtual-gift-message')?.value||'').trim();
            const note=typedNote || 'Um carinho para você ❤️';
            const msgRef=doc(chatCollection()); const now=Date.now();
            try{
                await runTransaction(db,async tx=>{
                    const relRef=doc(db,'relationships',coupleId); const snap=await tx.get(relRef);
                    if(!snap.exists())throw new Error('Elo não encontrado.');
                    const coins=Number(snap.data()?.users?.[currentUser.uid]?.coins||0);
                    if(coins<item.price)throw new Error('Moedas insuficientes!');
                    tx.update(relRef,{[`users.${currentUser.uid}.coins`]:coins-item.price});
                    tx.set(msgRef,{id:msgRef.id,senderId:currentUser.uid,recipientUid:partner.uid,type:'gift',text:note,timestamp:now,reactions:{},readBy:{[currentUser.uid]:true},gift:{itemId:item.id,title:item.title,emoji:item.emoji||'💝',kind:item.giftKind||'gift',price:item.price,message:note}});
                });
                closeGenericModal();
                chatMessages=mergeChatMessages(chatMessages,[normalizeMessage({id:msgRef.id,senderId:currentUser.uid,recipientUid:partner.uid,type:'gift',text:note,timestamp:now,gift:{itemId:item.id,title:item.title,emoji:item.emoji||'💝',kind:item.giftKind||'gift',price:item.price,message:note},readBy:{[currentUser.uid]:true}})]);
                showPurchaseCelebration(item,`Enviado para ${partner.name}`);
                createPartnerNotification({title:`${item.emoji||'💝'} Você recebeu ${item.title}`,body:note,type:'vouchers',data:{chatMessageId:msgRef.id,gift:true}});
                if(window.activeTab==='chat')renderChatOnly();
            }catch(e){console.error(e);showToast(e.message||'Não foi possível enviar o presente.','error')}
        };

        window.useInventoryItem = async (invId, title = '') => {
            if (!coupleData || !currentUser || !coupleData.inventory) return;
            const partner=getPartnerProfile(); if(!partner.uid)return showToast('Seu Elo ainda não tem parceiro.','error');
            const item=coupleData.inventory.find(i=>i.id===invId&&i.owner===currentUser.uid);
            if(!item||item.status!=='available')return showToast('Este voucher não está mais disponível.','error');
            title=item.title||title||'Voucher do Elo';
            const msgRef=doc(chatCollection()); const now=Date.now();
            try{
                await runTransaction(db,async tx=>{
                    const relRef=doc(db,'relationships',coupleId); const snap=await tx.get(relRef);
                    if(!snap.exists())throw new Error('Elo não encontrado.');
                    const inventory=(snap.data().inventory||[]).map(i=>i.id===invId?{...i,status:'pending',activatedAt:now,voucherMessageId:msgRef.id,beneficiaryUid:currentUser.uid,debtorUid:partner.uid}:i);
                    tx.update(relRef,{inventory});
                    tx.set(msgRef,{id:msgRef.id,senderId:currentUser.uid,type:'voucher',text:title,timestamp:now,reactions:{},readBy:{[currentUser.uid]:true},voucher:{invId,itemId:item.itemId||'',title,status:'pending',beneficiaryUid:currentUser.uid,debtorUid:partner.uid,activatedAt:now}});
                });
                showPurchaseCelebration(getStoreItem(item.itemId)||{title},`${partner.name} recebeu a pendência`);
                createPartnerNotification({title:'🎟️ Novo voucher usado',body:`Você está devendo: ${title}`,type:'vouchers',data:{chatMessageId:msgRef.id,voucher:true}});
                showToast("Voucher ativado e enviado ao Chat!", "reward");
            }catch(e){console.error(e);showToast(e.message||'Não foi possível ativar o voucher.','error')}
        };

        window.markVoucherCompleted = async messageId => {
            try{
                const ref=messageDoc(messageId); await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('Voucher não encontrado.');const m=snap.data();if(m?.voucher?.debtorUid!==currentUser.uid||m?.voucher?.status!=='pending')throw new Error('Esta pendência mudou.');tx.update(ref,{'voucher.status':'awaiting_confirmation','voucher.claimedCompletedAt':Date.now()});});
                createPartnerNotification({title:'✅ Voucher marcado como realizado',body:`${getProfileName(currentUser.uid)} informou que cumpriu o combinado. Confirme no Chat.`,type:'vouchers',data:{chatMessageId:messageId,voucherReview:true}});
                showToast('Agora falta a confirmação do parceiro.','success');
            }catch(e){showToast(e.message||'Não foi possível atualizar.','error')}
        };

        window.reviewVoucherCompletion = async (messageId, accepted) => {
            try{
                await runTransaction(db,async tx=>{
                    const msgRef=messageDoc(messageId); const relRef=doc(db,'relationships',coupleId);
                    const [msgSnap,relSnap]=await Promise.all([tx.get(msgRef),tx.get(relRef)]);
                    if(!msgSnap.exists()||!relSnap.exists())throw new Error('Voucher não encontrado.');
                    const m=msgSnap.data(); if(m?.voucher?.beneficiaryUid!==currentUser.uid||m?.voucher?.status!=='awaiting_confirmation')throw new Error('Esta confirmação mudou.');
                    if(accepted){
                        tx.update(msgRef,{'voucher.status':'completed','voucher.completedAt':Date.now()});
                        const inventory=(relSnap.data().inventory||[]).map(i=>i.id===m.voucher.invId?{...i,status:'used',usedAt:Date.now()}:i);
                        tx.update(relRef,{inventory});
                    }else{
                        tx.update(msgRef,{'voucher.status':'pending','voucher.rejectedAt':Date.now()});
                    }
                });
                createPartnerNotification({title:accepted?'❤️ Voucher concluído':'↩️ Ainda está pendente',body:accepted?'O combinado foi confirmado.':'O parceiro informou que o combinado ainda não foi concluído.',type:'vouchers',data:{chatMessageId:messageId}});
                showToast(accepted?'Voucher concluído! ❤️':'Voltou para pendente.','reward');
            }catch(e){showToast(e.message||'Não foi possível confirmar.','error')}
        };

        const chatCollection = () => collection(db, 'relationships', coupleId, 'messages');
        const messageDoc = id => doc(db, 'relationships', coupleId, 'messages', id);

        const normalizeMessage = (m, idFallback = null) => ({
            id: m.id || idFallback || String(Date.now()),
            senderId: m.senderId || '',
            type: m.type || 'text',
            text: m.text || '',
            mediaUrl: m.mediaUrl || (m.type === 'image' && /^data:image/.test(m.text || '') ? m.text : ''),
            mediaKey: m.mediaKey || '',
            mimeType: m.mimeType || '',
            mediaSize: Number(m.mediaSize || 0),
            duration: Number(m.duration || 0),
            timestamp: Number(m.timestamp || Date.now()),
            edited: !!m.edited,
            replyTo: m.replyTo || null,
            reactions: m.reactions || {},
            readBy: m.readBy || {},
            sendState: m.sendState || 'sent',
            localMediaUrl: m.localMediaUrl || '',
            _optimistic: !!m._optimistic,
            _uploading: !!m._uploading,
            _failed: !!m._failed
        });

        const mergeChatMessages = (...groups) => {
            const byId = new Map();
            groups.flat().filter(Boolean).forEach(m => {
                const normalized = normalizeMessage(m, m?.id);
                byId.set(normalized.id, {...byId.get(normalized.id), ...normalized});
            });
            return [...byId.values()].sort((a,b) => Number(a.timestamp||0)-Number(b.timestamp||0));
        };

        const migrateLegacyMessages = async () => {
            if (!coupleData || coupleData.messagesMigrated) return;
            try {
                const existing = await getDocs(query(chatCollection(), limit(1)));
                if (existing.empty && Array.isArray(coupleData.messages) && coupleData.messages.length) {
                    for (const raw of coupleData.messages) {
                        const m = normalizeMessage(raw);
                        await setDoc(messageDoc(m.id), m);
                    }
                }
                await updateDoc(doc(db, 'relationships', coupleId), { messagesMigrated: true });
            } catch (e) {
                console.warn('Migração do chat:', e);
            }
        };

        const startChatSync = async () => {
            if (!coupleId) return;
            if (unsubscribeMessages) unsubscribeMessages();
            await migrateLegacyMessages();
            chatRecentInitialized = false;
            chatHistoryCursor = null;
            chatHasMoreHistory = true;
            chatLoadingOlder = false;
            chatMessages = [];
            chatRenderedMessageIds = new Set();
            try {
                const q = query(chatCollection(), orderBy('timestamp', 'desc'), limit(CHAT_INITIAL_LIMIT));
                unsubscribeMessages = onSnapshot(q, snap => {
                    const recent = snap.docs.map(d => normalizeMessage(d.data(), d.id)).reverse();
                    if (!chatRecentInitialized) {
                        chatMessages = recent;
                        chatHistoryCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
                        chatHasMoreHistory = snap.docs.length === CHAT_INITIAL_LIMIT;
                        chatRecentInitialized = true;
                    } else {
                        // Mantém páginas antigas já abertas e aplica em tempo real somente à janela recente.
                        chatMessages = mergeChatMessages(chatMessages, recent);
                    }
                    const latest = recent.filter(m => m.senderId !== currentUser.uid && m.timestamp > chatLastSeenAt);
                    chatUnreadCount = latest.length;
                    updateChatBadge();
                    if (window.activeTab === 'chat') {
                        markChatRead();
                        renderChatOnly();
                        if (chatForceBottomOnOpen) forceChatToLatestOnEntry();
                    }
                }, err => console.warn('Sincronização do chat:', err));
            } catch (e) { console.warn('Chat sync:', e); }
        };

        window.loadOlderChatMessages = async () => {
            if (chatLoadingOlder || !chatHasMoreHistory || !chatHistoryCursor || !coupleId) return;
            chatLoadingOlder = true;
            chatUserAwayFromBottom = true;
            renderChatOnly();
            try {
                const q = query(chatCollection(), orderBy('timestamp', 'desc'), startAfter(chatHistoryCursor), limit(CHAT_HISTORY_PAGE));
                const snap = await getDocs(q);
                const older = snap.docs.map(d => normalizeMessage(d.data(), d.id)).reverse();
                if (snap.docs.length) chatHistoryCursor = snap.docs[snap.docs.length - 1];
                if (snap.docs.length < CHAT_HISTORY_PAGE) chatHasMoreHistory = false;
                // Esta atualização veio da paginação do histórico, não do listener em tempo real.
                // Suprime apenas este render do contador de "novas mensagens".
                chatSuppressNewMessageCounter = true;
                chatMessages = mergeChatMessages(older, chatMessages);
            } catch (e) {
                console.warn('Histórico do chat:', e);
                showToast('Não foi possível carregar mensagens antigas.', 'error');
            } finally {
                chatLoadingOlder = false;
                renderChatOnly();
                chatSuppressNewMessageCounter = false;
            }
        };

        const updateChatBadge = () => {
            const nav = document.getElementById('nav-chat');
            if (!nav) return;
            let badge = nav.querySelector('.chat-unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-unread-badge absolute -top-0.5 right-0 min-w-4 h-4 px-1 rounded-full bg-pink-600 text-white text-[8px] font-black items-center justify-center';
                nav.appendChild(badge);
            }
            badge.textContent = chatUnreadCount > 99 ? '99+' : String(chatUnreadCount);
            badge.classList.toggle('hidden', !chatUnreadCount);
            badge.classList.toggle('flex', !!chatUnreadCount);
        };

        const markChatRead = () => {
            if (!currentUser) return;
            chatLastSeenAt = Date.now();
            localStorage.setItem('elo_chat_last_seen', String(chatLastSeenAt));
            chatUnreadCount = 0;
            updateChatBadge();

            const unread = chatMessages
                .filter(m =>
                    m.senderId !== currentUser.uid &&
                    !m.readBy?.[currentUser.uid] &&
                    !chatReadWritePending.has(m.id)
                )
                .slice(-30);

            if (!unread.length) return;

            const batch = writeBatch(db);
            unread.forEach(m => {
                chatReadWritePending.add(m.id);
                batch.update(messageDoc(m.id), { [`readBy.${currentUser.uid}`]: true });
            });

            batch.commit()
                .catch(()=>{})
                .finally(()=>unread.forEach(m=>chatReadWritePending.delete(m.id)));
        };

        let lastTypingState = false;
        let lastTypingWriteAt = 0;

        const setTyping = (value) => {
            if (!coupleId || !currentUser) return;

            const next = !!value;
            clearTimeout(typingTimer);

            const now = Date.now();
            const shouldWrite =
                next !== lastTypingState ||
                (next && now - lastTypingWriteAt > 12000);

            if (shouldWrite) {
                lastTypingState = next;
                lastTypingWriteAt = now;

                updateDoc(
                    doc(db,'relationships',coupleId),
                    {
                        [`users.${currentUser.uid}.typing`]: next,
                        [`users.${currentUser.uid}.lastSeen`]: now
                    }
                ).catch(()=>{});
            }

            if (next) {
                typingTimer = setTimeout(() => {
                    lastTypingState = false;
                    lastTypingWriteAt = Date.now();

                    updateDoc(
                        doc(db,'relationships',coupleId),
                        {
                            [`users.${currentUser.uid}.typing`]: false,
                            [`users.${currentUser.uid}.lastSeen`]: Date.now()
                        }
                    ).catch(()=>{});
                }, 2500);
            }
        };

        window.setChatReply = id => {
            chatReplyTo = chatMessages.find(m => m.id === id) || null;
            chatShouldKeepFocus = true;
            renderChatOnly();
            setTimeout(()=>document.getElementById('chat-input')?.focus(),50);
        };
        window.cancelChatReply = () => { chatReplyTo = null; chatEditingId = null; chatShouldKeepFocus = true; renderChatOnly(); };
        window.editChatMessage = id => {
            const m = chatMessages.find(x => x.id === id);
            if (!m || m.type !== 'text' || m.senderId !== currentUser.uid) return;
            chatEditingId = id;
            chatReplyTo = null;
            chatDraft = m.text; chatShouldKeepFocus = true; renderChatOnly();
            const input = document.getElementById('chat-input'); if (input) { input.value = m.text; window.handleChatComposerInput(input); input.focus(); input.setSelectionRange(input.value.length,input.value.length); }
        };
        window.deleteChatMessage = async id => {
            const m = chatMessages.find(x => x.id === id); if (!m || m.senderId !== currentUser.uid) return;
            openEloConfirm({title:'Excluir mensagem?',message:'Ela será removida do Chat para vocês dois. Essa ação não pode ser desfeita.',confirmLabel:'Excluir',danger:true,onConfirm:async()=>{
                try {
                    await deleteDoc(messageDoc(id));
                    chatMessages = chatMessages.filter(x => x.id !== id);
                    renderChatOnly();
                    if (m.mediaKey) backgroundChatTask(deletePrivateChatMedia(m.mediaKey), 'Exclusão de mídia R2');
                    showToast('Mensagem excluída.', 'info');
                } catch(e) { showToast('Não foi possível excluir.', 'error'); }
            }});
        };
        window.reactChatMessage = async (id, emoji) => {
            const m = chatMessages.find(x => x.id === id); if (!m) return;
            const current = m.reactions?.[currentUser.uid];
            try { await updateDoc(messageDoc(id), { [`reactions.${currentUser.uid}`]: current === emoji ? null : emoji }); } catch(e) {}
        };

        const backgroundChatTask=(p,label)=>Promise.resolve(p).catch(e=>console.warn(label,e));
        window.sendChatMessage = async () => {
            const input=document.getElementById('chat-input');
            if(!input||!coupleData)return;
            const text=input.value.trim(); if(!text)return;
            const replySnapshot=chatReplyTo?{id:chatReplyTo.id,text:chatReplyTo.text||(chatReplyTo.type==='audio'?'Áudio':'Imagem'),senderId:chatReplyTo.senderId}:null;
            const editingSnapshot=chatEditingId;
            chatDraft=''; input.value=''; input.style.height='auto';
            chatReplyTo=null; chatEditingId=null; setTyping(false);
            const replySlot=document.getElementById('elo-chat-reply-slot'); if(replySlot)replySlot.innerHTML='';

            if(editingSnapshot){
                try{await updateDoc(messageDoc(editingSnapshot),{text,edited:true});}
                catch(e){console.error(e);showToast('Não foi possível editar a mensagem.','error')}
                requestAnimationFrame(()=>input.focus({preventScroll:true}));
                return;
            }

            // UI otimista: a mensagem entra no chat no mesmo instante do toque.
            // O write do Firestore, push e sinergia não bloqueiam o próximo envio.
            const id=`${Date.now()}_${currentUser.uid}_${Math.random().toString(36).slice(2,7)}`;
            const optimistic={id,senderId:currentUser.uid,type:'text',text,timestamp:Date.now(),replyTo:replySnapshot,reactions:{},readBy:{[currentUser.uid]:true},_optimistic:true};
            chatMessages=[...chatMessages,optimistic];
            chatUserAwayFromBottom=false;
            chatNewMessagesWhileAway=0;
            renderChatOnly();
            scrollChatToBottom(false);
            requestAnimationFrame(()=>input.focus({preventScroll:true}));

            const write=setDoc(messageDoc(id),{id,senderId:currentUser.uid,type:'text',text,timestamp:optimistic.timestamp,replyTo:replySnapshot,reactions:{},readBy:{[currentUser.uid]:true}});
            backgroundChatTask(write.then(()=>{
                backgroundChatTask(createPartnerNotification({title:`${coupleData?.users?.[currentUser.uid]?.name||'Seu amor'} enviou uma mensagem`,body:text.length>100?text.slice(0,100)+'…':text,type:'chat'}),'Push do chat');
                backgroundChatTask(updateDoc(doc(db,'relationships',coupleId),{'stats.synergy':increment(0.25)}),'Sinergia');
            }).catch(e=>{
                console.error(e);
                chatMessages=chatMessages.filter(m=>m.id!==id);
                renderChatOnly();
                showToast('Não foi possível enviar a mensagem.','error');
                throw e;
            }),'Envio do chat');
        };

        // Firestore limita cada documento a ~1 MiB. Como Data URL/Base64 aumenta o
        // tamanho do arquivo em ~33%, mantemos a imagem final em uma margem segura.
        // O usuário pode selecionar uma foto original bem maior; ela é processada
        // localmente e nunca precisa passar pelo Firebase Storage.
        const CHAT_IMAGE_TARGET_BYTES = 700 * 1024; // ~700 KB de dados JPEG
        const CHAT_IMAGE_MAX_DIM = 1280;
        const CHAT_IMAGE_MIN_DIM = 640;

        const dataUrlBytes = dataUrl => {
            const base64 = dataUrl.split(',')[1] || '';
            return Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
        };

        const canvasToJpeg = (canvas, quality) => canvas.toDataURL('image/jpeg', quality);

        const compressChatImage = file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const sourceW = img.naturalWidth || img.width;
                        const sourceH = img.naturalHeight || img.height;
                        if (!sourceW || !sourceH) throw new Error('Imagem inválida.');

                        // Primeira etapa: limita a resolução sem destruir detalhes de fotos modernas.
                        const initialScale = Math.min(1, CHAT_IMAGE_MAX_DIM / Math.max(sourceW, sourceH));
                        let width = Math.max(1, Math.round(sourceW * initialScale));
                        let height = Math.max(1, Math.round(sourceH * initialScale));
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d', { alpha: false });
                        if (!ctx) throw new Error('Seu navegador não suporta processamento de imagens.');

                        const render = (w, h, quality) => {
                            canvas.width = w;
                            canvas.height = h;
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(0, 0, w, h);
                            ctx.drawImage(img, 0, 0, w, h);
                            return canvasToJpeg(canvas, quality);
                        };

                        // Procura a maior qualidade que caiba no alvo. Primeiro ajusta
                        // qualidade; só reduz resolução se necessário.
                        let best = render(width, height, 0.86);
                        if (dataUrlBytes(best) > CHAT_IMAGE_TARGET_BYTES) {
                            let low = 0.45, high = 0.86;
                            for (let i = 0; i < 7; i++) {
                                const q = (low + high) / 2;
                                const candidate = render(width, height, q);
                                if (dataUrlBytes(candidate) <= CHAT_IMAGE_TARGET_BYTES) {
                                    best = candidate;
                                    low = q;
                                } else {
                                    high = q;
                                }
                            }
                        }

                        // Se mesmo com qualidade baixa continuar grande, reduzimos a
                        // resolução gradualmente, preservando o máximo de qualidade possível.
                        let attempts = 0;
                        while (dataUrlBytes(best) > CHAT_IMAGE_TARGET_BYTES && attempts < 6) {
                            const longest = Math.max(width, height);
                            const nextLongest = Math.max(CHAT_IMAGE_MIN_DIM, Math.round(longest * 0.86));
                            if (nextLongest >= longest) break;
                            const scale = nextLongest / longest;
                            width = Math.max(1, Math.round(width * scale));
                            height = Math.max(1, Math.round(height * scale));
                            best = render(width, height, 0.78);

                            if (dataUrlBytes(best) > CHAT_IMAGE_TARGET_BYTES) {
                                let low = 0.42, high = 0.78;
                                for (let i = 0; i < 6; i++) {
                                    const q = (low + high) / 2;
                                    const candidate = render(width, height, q);
                                    if (dataUrlBytes(candidate) <= CHAT_IMAGE_TARGET_BYTES) {
                                        best = candidate;
                                        low = q;
                                    } else {
                                        high = q;
                                    }
                                }
                            }
                            attempts++;
                        }

                        if (dataUrlBytes(best) > CHAT_IMAGE_TARGET_BYTES) {
                            throw new Error('A imagem não pôde ser reduzida para um tamanho seguro.');
                        }
                        resolve(best);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'));
            reader.readAsDataURL(file);
        });

        const dataUrlToBlob = dataUrl => {
            const [meta, payload] = String(dataUrl).split(',');
            const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
            const raw = atob(payload || '');
            const bytes = new Uint8Array(raw.length);
            for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
            return new Blob([bytes], {type:mime});
        };

        const uploadChatMedia = async (blob, kind) => {
            if (!currentUser || !coupleId) throw new Error('Sessão do Elo indisponível');
            const token = await currentUser.getIdToken();
            const response = await fetch(`${ELO_MEDIA_ENDPOINT}/media/upload?coupleId=${encodeURIComponent(coupleId)}&kind=${encodeURIComponent(kind)}`, {
                method:'POST',
                headers:{'Authorization':`Bearer ${token}`,'Content-Type':blob.type || (kind==='audio'?'audio/webm':'image/jpeg')},
                body:blob
            });
            let result=null; try{result=await response.json();}catch(_){ }
            if(!response.ok || !result?.ok) throw new Error(result?.error || `Upload HTTP ${response.status}`);
            return result;
        };

        const cacheChatMediaObjectUrl = (key, objectUrl) => {
            if (!key || !objectUrl) return objectUrl;

            const existing = chatMediaObjectUrls.get(key);
            if (existing && existing !== objectUrl) {
                try { URL.revokeObjectURL(existing); } catch (_) {}
            }

            chatMediaObjectUrls.delete(key);
            chatMediaObjectUrls.set(key, objectUrl);

            // Evita manter dezenas/centenas de blobs pesados na memória após muito tempo no chat.
            while (chatMediaObjectUrls.size > 30) {
                const oldestKey = chatMediaObjectUrls.keys().next().value;
                const oldestUrl = chatMediaObjectUrls.get(oldestKey);
                chatMediaObjectUrls.delete(oldestKey);
                chatMessages = chatMessages.map(m =>
                    m.mediaKey === oldestKey && m.localMediaUrl === oldestUrl
                        ? {...m,localMediaUrl:''}
                        : m
                );
                try { URL.revokeObjectURL(oldestUrl); } catch (_) {}
            }

            return objectUrl;
        };

        const fetchPrivateChatMedia = async key => {
            if (!key) throw new Error('Mídia sem chave');
            if (chatMediaObjectUrls.has(key)) {
                const cached = chatMediaObjectUrls.get(key);
                // Atualiza posição para funcionar como um cache LRU simples.
                chatMediaObjectUrls.delete(key);
                chatMediaObjectUrls.set(key,cached);
                return cached;
            }
            const token = await currentUser.getIdToken();
            const response = await fetch(`${ELO_MEDIA_ENDPOINT}/media?key=${encodeURIComponent(key)}`, {headers:{'Authorization':`Bearer ${token}`}});
            if(!response.ok) throw new Error(`Mídia HTTP ${response.status}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            return cacheChatMediaObjectUrl(key, objectUrl);
        };

        const deletePrivateChatMedia = async key => {
            if (!key || !currentUser) return;
            const token = await currentUser.getIdToken();
            const response = await fetch(`${ELO_MEDIA_ENDPOINT}/media?key=${encodeURIComponent(key)}`, {method:'DELETE',headers:{'Authorization':`Bearer ${token}`}});
            if(!response.ok && response.status!==404) throw new Error(`Delete mídia HTTP ${response.status}`);
            const cached = chatMediaObjectUrls.get(key); if(cached){URL.revokeObjectURL(cached);chatMediaObjectUrls.delete(key);}
        };

        const formatAudioDuration = seconds => {
            const s=Math.max(0,Math.floor(Number(seconds)||0)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
        };

        let chatMediaObserver = null;

        const hydrateChatMediaElement = async el => {
            if (!el || !el.isConnected) return;
            if (el.dataset.mediaHydrated === '1' || el.dataset.mediaHydrated === 'loading') return;

            el.dataset.mediaHydrated = 'loading';
            try {
                const src = await fetchPrivateChatMedia(el.dataset.privateMediaKey);
                if (!el.isConnected) return;

                el.addEventListener('load',()=>{
                    if(!chatUserAwayFromBottom) scrollChatToBottom(false);
                },{once:true});

                el.src = src;
                el.classList.remove('opacity-0');
                const holder = el.closest('[data-media-holder]');
                holder?.querySelector('.elo-chat-media-loading')?.remove();
                el.dataset.mediaHydrated = '1';
            } catch(e) {
                console.warn('Mídia privada:',e);
                el.dataset.mediaHydrated = 'error';
                const holder = el.closest('[data-media-holder]');
                if(holder) holder.innerHTML='<div class="elo-chat-media-loading">Não foi possível carregar</div>';
            }
        };

        const hydrateChatMedia = () => {
            const images = [...document.querySelectorAll('img[data-private-media-key]')]
                .filter(el=>el.dataset.mediaHydrated!=='1' && el.dataset.mediaHydrated!=='loading');

            if (!images.length) return;

            // V35: não baixa todas as fotos da janela de chat ao mesmo tempo.
            // Só hidrata o que está perto da área visível.
            if ('IntersectionObserver' in window) {
                if (chatMediaObserver) chatMediaObserver.disconnect();
                const root = document.getElementById('chat-messages');
                chatMediaObserver = new IntersectionObserver(entries=>{
                    entries.forEach(entry=>{
                        if (!entry.isIntersecting) return;
                        chatMediaObserver?.unobserve(entry.target);
                        hydrateChatMediaElement(entry.target);
                    });
                },{
                    root,
                    rootMargin:'420px 0px',
                    threshold:0.01
                });
                images.forEach(el=>chatMediaObserver.observe(el));
                return;
            }

            images.slice(0,6).forEach(hydrateChatMediaElement);
        };

        window.toggleChatAudio = async (button, key) => {
            const player=button.closest('.elo-audio-player'); const audio=player?.querySelector('audio'); if(!audio)return;
            if(!audio.src){
                if(!key) return;
                try{audio.src=await fetchPrivateChatMedia(key);audio.load();}
                catch(e){return showToast('Não foi possível carregar o áudio.','error');}
            }
            document.querySelectorAll('.elo-audio-player audio').forEach(other=>{if(other!==audio&&!other.paused)other.pause();});
            if(audio.paused) audio.play().catch(()=>showToast('Toque novamente para reproduzir.','info')); else audio.pause();
        };
        window.seekChatAudio = (event, track) => {
            event.stopPropagation(); const player=track.closest('.elo-audio-player'); const audio=player?.querySelector('audio'); if(!audio||!Number.isFinite(audio.duration)||!audio.duration)return;
            const r=track.getBoundingClientRect(); audio.currentTime=Math.max(0,Math.min(audio.duration,((event.clientX-r.left)/r.width)*audio.duration));
        };
        window.cycleChatAudioSpeed = button => {
            const audio=button.closest('.elo-audio-player')?.querySelector('audio'); if(!audio)return;
            const speeds=[1,1.5,2]; const next=speeds[(speeds.indexOf(audio.playbackRate)+1)%speeds.length]; audio.playbackRate=next; button.textContent=`${next}x`;
        };
        const bindAudioPlayers = () => {
            document.querySelectorAll('.elo-audio-player').forEach(player=>{
                if(player.dataset.bound==='1')return; player.dataset.bound='1';
                const audio=player.querySelector('audio'),play=player.querySelector('.elo-audio-play'),progress=player.querySelector('.elo-audio-progress'),time=player.querySelector('[data-audio-time]');
                if(!audio)return;
                const sync=()=>{const dur=Number.isFinite(audio.duration)?audio.duration:Number(player.dataset.duration||0); if(progress)progress.style.width=dur?`${Math.min(100,(audio.currentTime/dur)*100)}%`:'0%';if(time)time.textContent=formatAudioDuration(audio.currentTime||dur||0);};
                audio.addEventListener('play',()=>{if(play)play.innerHTML='<i class="ph-fill ph-pause"></i>';});
                audio.addEventListener('pause',()=>{if(play)play.innerHTML='<i class="ph-fill ph-play"></i>';});
                audio.addEventListener('ended',()=>{if(play)play.innerHTML='<i class="ph-fill ph-play"></i>';audio.currentTime=0;sync();});
                audio.addEventListener('timeupdate',sync); audio.addEventListener('loadedmetadata',sync);
            });
        };

        const preferredAudioMimeType = () => {
            if(!window.MediaRecorder)return '';
            const candidates=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
            return candidates.find(type=>MediaRecorder.isTypeSupported?.(type)) || '';
        };
        const updateRecordingUI = () => {
            const normal=document.getElementById('chat-compose-normal'), rec=document.getElementById('chat-recording-panel');
            const recording=!!chatAudioRecorder && chatAudioRecorder.state==='recording';
            if(normal) normal.style.display=recording?'none':'flex';
            if(rec) rec.style.display=recording?'flex':'none';
        };
        const stopRecordingTracks = () => { chatAudioStream?.getTracks?.().forEach(track=>track.stop()); chatAudioStream=null; };
        const clearAudioTimer = () => { if(chatAudioTimer){clearInterval(chatAudioTimer);chatAudioTimer=null;} };
        window.cancelChatAudioRecording = () => {
            if(!chatAudioRecorder)return;
            chatAudioRecorder._eloSend=false;
            if(chatAudioRecorder.state!=='inactive') chatAudioRecorder.stop();
            else {stopRecordingTracks();clearAudioTimer();chatAudioRecorder=null;updateRecordingUI();}
        };
        window.startChatAudioRecording = async () => {
            if(chatAudioRecorder?.state==='recording')return;
            if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return showToast('Gravação de áudio não é suportada neste aparelho.','error');
            try{
                chatAudioStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
                chatAudioMimeType=preferredAudioMimeType(); chatAudioChunks=[]; chatAudioStartedAt=Date.now();
                const options={audioBitsPerSecond:32000}; if(chatAudioMimeType)options.mimeType=chatAudioMimeType;
                try { chatAudioRecorder=new MediaRecorder(chatAudioStream,options); }
                catch(_) { chatAudioRecorder=new MediaRecorder(chatAudioStream,chatAudioMimeType?{mimeType:chatAudioMimeType}:undefined); }
                chatAudioRecorder._eloSend=true;
                chatAudioRecorder.ondataavailable=e=>{if(e.data?.size)chatAudioChunks.push(e.data);};
                chatAudioRecorder.onerror=e=>{console.warn('Gravação:',e);showToast('Erro durante a gravação.','error');};
                chatAudioRecorder.onstop=async()=>{
                    const shouldSend=chatAudioRecorder?._eloSend!==false; const duration=Math.max(1,(Date.now()-chatAudioStartedAt)/1000); const mime=chatAudioRecorder?.mimeType||chatAudioMimeType||chatAudioChunks[0]?.type||'audio/webm';
                    const chunks=chatAudioChunks.slice(); stopRecordingTracks();clearAudioTimer();chatAudioRecorder=null;chatAudioChunks=[];updateRecordingUI();
                    if(!shouldSend||!chunks.length)return;
                    const blob=new Blob(chunks,{type:mime});
                    if(blob.size>8*1024*1024)return showToast('O áudio ficou grande demais. Grave uma mensagem menor.','error');
                    await sendRecordedChatAudio(blob,duration);
                };
                chatAudioRecorder.start(500); updateRecordingUI();
                const timeEl=document.getElementById('chat-record-time'); const tick=()=>{const seconds=Math.floor((Date.now()-chatAudioStartedAt)/1000);if(timeEl)timeEl.textContent=formatAudioDuration(seconds);if(seconds>=300)window.finishChatAudioRecording();}; tick();chatAudioTimer=setInterval(tick,500);
            }catch(e){ stopRecordingTracks();chatAudioRecorder=null;updateRecordingUI();console.warn(e);showToast(e?.name==='NotAllowedError'?'Permita o acesso ao microfone para enviar áudio.':'Não foi possível iniciar o microfone.','error'); }
        };
        window.finishChatAudioRecording = () => {
            if(!chatAudioRecorder||chatAudioRecorder.state==='inactive')return; chatAudioRecorder._eloSend=true; chatAudioRecorder.stop();
        };
        const sendRecordedChatAudio = async (blob,duration) => {
            if (!currentUser || !coupleId) return;
            const id=`${Date.now()}_${currentUser.uid}_${Math.random().toString(36).slice(2,7)}`;
            const localUrl=URL.createObjectURL(blob);
            const replySnapshot=chatReplyTo?{id:chatReplyTo.id,text:chatReplyTo.text||(chatReplyTo.type==='audio'?'Áudio':'Imagem'),senderId:chatReplyTo.senderId}:null;
            const optimistic={
                id,
                senderId:currentUser.uid,
                type:'audio',
                text:'',
                mediaKey:'',
                localMediaUrl:localUrl,
                mimeType:blob.type||'audio/webm',
                mediaSize:blob.size,
                duration:Math.round(duration*10)/10,
                timestamp:Date.now(),
                replyTo:replySnapshot,
                reactions:{},
                readBy:{[currentUser.uid]:true},
                sendState:'uploading',
                _optimistic:true,
                _uploading:true
            };

            chatMessages=mergeChatMessages(chatMessages,optimistic);
            chatReplyTo=null;
            chatUserAwayFromBottom=false;
            chatNewMessagesWhileAway=0;
            renderChatOnly();
            scrollChatToBottom(false);

            // Upload + Firestore acontecem fora do caminho crítico da interface.
            backgroundChatTask((async()=>{
                try{
                    const uploaded=await uploadChatMedia(blob,'audio');
                    // Reaproveita o blob local: se o usuário apertar Play, não baixa o mesmo áudio do R2 de novo.
                    cacheChatMediaObjectUrl(uploaded.key,localUrl);

                    const finalMsg={
                        id,
                        senderId:currentUser.uid,
                        type:'audio',
                        text:'',
                        mediaKey:uploaded.key,
                        mimeType:uploaded.contentType,
                        mediaSize:uploaded.size,
                        duration:Math.round(duration*10)/10,
                        timestamp:optimistic.timestamp,
                        replyTo:replySnapshot,
                        reactions:{},
                        readBy:{[currentUser.uid]:true},
                        sendState:'sent'
                    };

                    chatMessages=chatMessages.map(m=>m.id===id?{...finalMsg,localMediaUrl:localUrl}:m);
                    renderChatOnly();
                    await setDoc(messageDoc(id),finalMsg);

                    backgroundChatTask(createPartnerNotification({
                        title:`${coupleData?.users?.[currentUser.uid]?.name||'Seu amor'} enviou um áudio`,
                        body:`🎤 Mensagem de voz · ${formatAudioDuration(duration)}`,
                        type:'chat_audio'
                    }),'Push de áudio');
                    backgroundChatTask(updateDoc(doc(db,'relationships',coupleId),{'stats.synergy':increment(0.35)}),'Sinergia');
                }catch(e){
                    console.error('Envio de áudio:',e);
                    chatMessages=chatMessages.map(m=>m.id===id?{...m,_uploading:false,_failed:true,sendState:'failed'}:m);
                    renderChatOnly();
                    // Só avisamos se realmente falhar; não mostramos mais "Enviando áudio".
                    showToast('Não foi possível sincronizar o áudio.','error');
                }
            })(),'Envio de áudio');
        };

        window.sendChatImage = async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !coupleData || !currentUser || !coupleId) return;
            if (!file.type.startsWith('image/')) return showToast('Selecione uma imagem.', 'error');
            if (file.size > 12 * 1024 * 1024) return showToast('A imagem original deve ter até 12 MB.', 'error');

            const id=`${Date.now()}_${currentUser.uid}_${Math.random().toString(36).slice(2,7)}`;
            const localUrl=URL.createObjectURL(file);
            const replySnapshot=chatReplyTo ? {
                id:chatReplyTo.id,
                text:chatReplyTo.text || (chatReplyTo.type==='audio'?'Áudio':'Imagem'),
                senderId:chatReplyTo.senderId
            } : null;

            const optimistic={
                id,
                senderId:currentUser.uid,
                type:'image',
                mediaKey:'',
                mediaUrl:'',
                localMediaUrl:localUrl,
                mimeType:file.type,
                mediaSize:file.size,
                text:'',
                timestamp:Date.now(),
                replyTo:replySnapshot,
                reactions:{},
                readBy:{[currentUser.uid]:true},
                sendState:'uploading',
                _optimistic:true,
                _uploading:true
            };

            chatReplyTo=null;
            chatMessages=mergeChatMessages(chatMessages,optimistic);
            chatUserAwayFromBottom=false;
            renderChatOnly();
            scrollChatToBottom(false);

            backgroundChatTask((async()=>{
                try{
                    // Compressão/upload acontecem sem bloquear a sensação de envio.
                    const dataUrl=await compressChatImage(file);
                    const blob=dataUrlToBlob(dataUrl);
                    const uploaded=await uploadChatMedia(blob,'image');
                    cacheChatMediaObjectUrl(uploaded.key,localUrl);

                    const finalMsg={
                        id,
                        senderId:currentUser.uid,
                        type:'image',
                        mediaKey:uploaded.key,
                        mediaUrl:'',
                        mimeType:uploaded.contentType,
                        mediaSize:uploaded.size,
                        text:'',
                        timestamp:optimistic.timestamp,
                        replyTo:replySnapshot,
                        reactions:{},
                        readBy:{[currentUser.uid]:true},
                        sendState:'sent'
                    };

                    chatMessages=chatMessages.map(m=>m.id===id?{...finalMsg,localMediaUrl:localUrl}:m);
                    renderChatOnly();
                    await setDoc(messageDoc(id),finalMsg);

                    backgroundChatTask(createPartnerNotification({
                        title:`${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} enviou uma foto`,
                        body:'📷 Abra o Elo para ver a foto.',
                        type:'chat_image'
                    }),'Push de imagem');
                    backgroundChatTask(updateDoc(doc(db,'relationships',coupleId),{'stats.synergy':increment(0.5)}),'Sinergia');
                }catch(err){
                    console.error('Envio de imagem:',err);
                    chatMessages=chatMessages.map(m=>m.id===id?{...m,_uploading:false,_failed:true,sendState:'failed'}:m);
                    renderChatOnly();
                    showToast('Não foi possível sincronizar a foto.','error');
                }
            })(),'Envio de imagem');
        };

        window.shareChatVoucher = id => { const item=(coupleData.inventory||[]).find(x=>x.id===id); if(!item)return; window.sendSpecialChat(`🎁 ${item.title || 'Voucher'} — enviado pelo seu amor ❤️`,'voucher'); };
        window.sendSpecialChat = async (text,type='special') => { try { await addDoc(chatCollection(),{senderId:currentUser.uid,type,text,timestamp:Date.now(),reactions:{},readBy:{[currentUser.uid]:true}}); }catch(e){showToast('Não foi possível enviar.','error');} };

        const chatDateKey = ts => {
            const d = new Date(Number(ts || Date.now()));
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        };
        const chatDateLabel = ts => {
            const d = new Date(Number(ts || Date.now()));
            const today = new Date();
            const yesterday = new Date(); yesterday.setDate(today.getDate()-1);
            if (chatDateKey(d) === chatDateKey(today)) return 'Hoje';
            if (chatDateKey(d) === chatDateKey(yesterday)) return 'Ontem';
            return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:d.getFullYear()!==today.getFullYear()?'numeric':undefined}).replace('.','');
        };
        const resizeChatComposer = el => {
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight,112)}px`;
        };
        const syncChatComposerAction = () => {
            const hasText = !!String(document.getElementById('chat-input')?.value || chatDraft || '').trim();
            const mic = document.getElementById('chat-mic-action');
            const send = document.getElementById('chat-send-action');
            if (mic) mic.classList.toggle('hidden', hasText);
            if (send) send.classList.toggle('hidden', !hasText);
        };
        window.handleChatComposerInput = el => {
            chatDraft = el?.value || '';
            resizeChatComposer(el);
            syncChatComposerAction();
            setTyping(!!chatDraft.trim());
        };
        window.setChatFocusState = value => { chatShouldKeepFocus = !!value; };
        window.openChatMessageActions = id => {
            const m = chatMessages.find(x=>x.id===id); if(!m) return;
            const mine = m.senderId===currentUser.uid;
            const isFav = !!m.favorites?.[currentUser.uid];
            openGenericModal(`<div class="space-y-3"><div class="w-10 h-1 rounded-full bg-slate-700 mx-auto -mt-1 mb-2"></div><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest text-pink-400 font-black">Mensagem</p><h3 class="text-lg font-black text-white">Ações</h3></div><button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-300">✕</button></div><div class="grid grid-cols-4 gap-2"><button onclick="closeGenericModal();setChatReply('${m.id}')" class="rounded-2xl bg-slate-900 border border-slate-800 py-3 text-center"><i class="ph-bold ph-arrow-bend-up-left text-xl text-pink-400"></i><p class="text-[9px] text-slate-400 mt-1">Responder</p></button><button onclick="closeGenericModal();reactChatMessage('${m.id}','❤️')" class="rounded-2xl bg-slate-900 border border-slate-800 py-3 text-center"><span class="text-xl">❤️</span><p class="text-[9px] text-slate-400 mt-1">Reagir</p></button><button onclick="closeGenericModal();favoriteChatMessage('${m.id}')" class="rounded-2xl bg-slate-900 border border-slate-800 py-3 text-center"><i class="ph-${isFav?'fill':'bold'} ph-star text-xl text-amber-400"></i><p class="text-[9px] text-slate-400 mt-1">${isFav?'Desfavoritar':'Favoritar'}</p></button><button onclick="closeGenericModal();pinChatMessage('${m.id}')" class="rounded-2xl bg-slate-900 border border-slate-800 py-3 text-center"><i class="ph-bold ph-push-pin text-xl text-violet-400"></i><p class="text-[9px] text-slate-400 mt-1">Fixar</p></button></div><div class="flex justify-center gap-2 py-1">${['🥰','😂','😮','😢','👍'].map(e=>`<button onclick="closeGenericModal();reactChatMessage('${m.id}','${e}')" class="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-lg active:scale-90">${e}</button>`).join('')}</div>${mine && m.type==='text'?`<button onclick="closeGenericModal();editChatMessage('${m.id}')" class="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white"><i class="ph-bold ph-pencil-simple text-lg text-slate-400"></i> Editar mensagem</button>`:''}${mine?`<button onclick="closeGenericModal();deleteChatMessage('${m.id}')" class="w-full flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300"><i class="ph-bold ph-trash text-lg"></i> Excluir mensagem</button>`:''}<p class="text-[10px] text-center text-slate-600">Dica: no chat, deslize uma mensagem para a direita para responder.</p></div>`);
        };

        const bindChatMessageGestures = () => {
            document.querySelectorAll('[data-chat-message]').forEach(el => {
                const id = el.dataset.chatMessage;
                let holdTimer = null, startX = 0, startY = 0, lastX = 0, lastY = 0, held = false;
                const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
                el.addEventListener('pointerdown', e => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    startX = lastX = e.clientX; startY = lastY = e.clientY; held = false;
                    holdTimer = setTimeout(() => {
                        held = true; holdTimer = null;
                        if (navigator.vibrate) navigator.vibrate(18);
                        window.openChatMessageActions(id);
                    }, 470);
                }, {passive:true});
                el.addEventListener('pointermove', e => {
                    lastX = e.clientX; lastY = e.clientY;
                    if (Math.abs(lastX-startX) > 10 || Math.abs(lastY-startY) > 10) clearHold();
                }, {passive:true});
                el.addEventListener('pointerup', e => {
                    clearHold();
                    if (held) return;
                    const dx = (e.clientX || lastX) - startX;
                    const dy = (e.clientY || lastY) - startY;
                    if (dx > 58 && Math.abs(dy) < 38) {
                        if (navigator.vibrate) navigator.vibrate(10);
                        window.setChatReply(id);
                    }
                }, {passive:true});
                el.addEventListener('pointercancel', clearHold, {passive:true});
                el.addEventListener('contextmenu', e => { e.preventDefault(); window.openChatMessageActions(id); });
            });
        };

        const isChatNearBottom = (el, threshold = 90) => !el || (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
        const updateChatNewMessagesButton = () => {
            const btn = document.getElementById('chat-new-messages');
            if (!btn) return;
            const show = chatUserAwayFromBottom && chatNewMessagesWhileAway > 0;
            btn.classList.toggle('hidden', !show);
            btn.textContent = chatNewMessagesWhileAway > 1 ? `↓ ${chatNewMessagesWhileAway} novas mensagens` : '↓ 1 nova mensagem';
        };
        const bindChatScrollBehavior = el => {
            if (!el || el.dataset.eloScrollBound === '1') return;
            el.dataset.eloScrollBound = '1';
            el.addEventListener('scroll', () => {
                const nearBottom = isChatNearBottom(el);
                chatUserAwayFromBottom = !nearBottom;
                chatWasNearBottom = nearBottom;
                if (nearBottom) chatNewMessagesWhileAway = 0;
                if (el.scrollTop < 140 && chatHasMoreHistory && !chatLoadingOlder) window.loadOlderChatMessages();
                updateChatNewMessagesButton();
            }, {passive:true});
        };
        const scrollChatToBottom = (smooth = false) => {
            const el = document.getElementById('chat-messages');
            if (!el) return;
            chatUserAwayFromBottom = false;
            chatWasNearBottom = true;
            chatNewMessagesWhileAway = 0;
            updateChatNewMessagesButton();
            requestAnimationFrame(() => {
                if (smooth && el.scrollTo) el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});
                else el.scrollTop = el.scrollHeight;
            });
        };
        window.scrollChatToLatest = () => scrollChatToBottom(true);
        const forceChatToLatestOnEntry = () => {
            if (window.activeTab !== 'chat') return;
            chatForceBottomOnOpen = true;
            chatUserAwayFromBottom = false;
            chatNewMessagesWhileAway = 0;
            const apply = () => {
                const el = document.getElementById('chat-messages');
                if (!el || window.activeTab !== 'chat') return;
                el.scrollTop = el.scrollHeight;
                chatWasNearBottom = true;
                chatUserAwayFromBottom = false;
                chatNewMessagesWhileAway = 0;
                updateChatNewMessagesButton();
            };
            const el = document.getElementById('chat-messages');
            if (el) el.style.visibility = 'hidden';
            requestAnimationFrame(() => {
                apply();
                requestAnimationFrame(() => {
                    apply();
                    const current = document.getElementById('chat-messages');
                    if (current) current.style.visibility = 'visible';
                    chatForceBottomOnOpen = false;
                });
            });
        };

        const updateChatPresenceOnly = () => {
            if (window.activeTab !== 'chat' || !currentUser || !coupleData) return;
            const users=coupleData.users||{};
            const partnerUid=Object.keys(users).find(id=>id!==currentUser.uid);
            const partner=partnerUid?users[partnerUid]:null;
            if(!partner)return;

            const typing=!!partner.typing;
            const online=!!(partner.lastSeen && Date.now()-Number(partner.lastSeen)<90000);
            const statusText=typing?'digitando…':online?'online agora':partner.lastSeen?'visto recentemente':'offline';
            const statusClass=typing||online?'text-emerald-400':'text-slate-500';

            const name=document.getElementById('elo-chat-partner-name');
            const status=document.getElementById('elo-chat-partner-status');
            const dot=document.getElementById('elo-chat-partner-dot');

            if(name && name.textContent !== (partner.name||'Seu amor')) name.textContent=partner.name||'Seu amor';
            if(status){
                if(status.textContent !== statusText) status.textContent=statusText;
                const nextClass=`text-[10px] ${statusClass}`;
                if(status.className !== nextClass) status.className=nextClass;
            }
            if(dot){
                const nextDot=`w-1.5 h-1.5 rounded-full ${online?'bg-emerald-400':'bg-slate-600'}`;
                if(dot.className !== nextDot) dot.className=nextDot;
            }
        };

        const renderChatOnly = () => {
            if (window.activeTab !== 'chat') return;
            const main=document.getElementById('main-content'); if(!main)return;

            const oldInput=document.getElementById('chat-input');
            if(oldInput) chatDraft=oldInput.value;
            const oldScroller=document.getElementById('chat-messages');
            if(oldScroller) chatWasNearBottom=(oldScroller.scrollHeight-oldScroller.scrollTop-oldScroller.clientHeight)<110;
            const hadFocus=document.activeElement===oldInput;

            const users=coupleData?.users||{};
            const partnerUid=Object.keys(users).find(id=>id!==currentUser.uid);
            const partner=partnerUid?users[partnerUid]:null;
            const typing=!!partner?.typing;
            const online=partner?.lastSeen && Date.now()-Number(partner.lastSeen)<90000;
            const formatTime=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
            const reactionsFor=m=>Object.values(m.reactions||{}).filter(Boolean).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{});
            const readState=m=>Object.keys(m.readBy||{}).length>1?'<i class="ph-bold ph-checks text-[11px]"></i>':'<i class="ph-bold ph-check text-[11px]"></i>';
            let lastDay='';

            const msgHTML=chatMessages.map((m,index)=>{
                const isMe=m.senderId===currentUser.uid;
                const prev=chatMessages[index-1], next=chatMessages[index+1];
                const closeInTime=(a,b)=>a&&b&&Math.abs(Number(a.timestamp||0)-Number(b.timestamp||0))<5*60*1000&&chatDateKey(a.timestamp)===chatDateKey(b.timestamp);
                const groupedPrev=!!(prev&&prev.senderId===m.senderId&&closeInTime(prev,m));
                const groupedNext=!!(next&&next.senderId===m.senderId&&closeInTime(m,next));
                const day=chatDateKey(m.timestamp);
                const divider=day!==lastDay?`<div class="elo-chat-day"><span>${chatDateLabel(m.timestamp)}</span></div>`:'';
                lastDay=day;
                const reply=m.replyTo?`<div class="elo-message-reply">↩ ${escapeHTML(m.replyTo.text||'Imagem')}</div>`:'';
                let content='';
                let mediaClass='';
                if(m.type==='image'){
                    if(m.localMediaUrl){
                        const src=escapeHTML(m.localMediaUrl);
                        content=`<img src="${src}" decoding="async" class="elo-message-image ${m._failed?'opacity-70':''}" alt="Imagem enviada no chat" draggable="false" onclick="event.stopPropagation();window.open(this.src,'_blank')">`;
                    } else if(m.mediaKey){
                        content=`<div data-media-holder class="elo-chat-media-loading-wrap"><div class="elo-chat-media-loading"><i class="ph-bold ph-image text-xl mb-1"></i><span>Carregando foto…</span></div><img loading="lazy" decoding="async" data-private-media-key="${escapeHTML(m.mediaKey)}" src="" class="elo-message-image opacity-0" alt="Imagem enviada no chat" draggable="false" onclick="event.stopPropagation();if(this.src)window.open(this.src,'_blank')"></div>`;
                    } else {
                        const src=escapeHTML(m.mediaUrl||m.text); content=`<img src="${src}" loading="lazy" decoding="async" class="elo-message-image" alt="Imagem enviada no chat" draggable="false" onclick="event.stopPropagation();window.open(this.src,'_blank')">`;
                    }
                    mediaClass=' media';
                } else if(m.type==='audio') {
                    const duration=formatAudioDuration(m.duration);
                    const localSrc=m.localMediaUrl ? escapeHTML(m.localMediaUrl) : '';
                    const audioState=m._failed
                        ? '<span class="elo-audio-state failed"><i class="ph-bold ph-warning-circle"></i> falhou</span>'
                        : (m._uploading || m.sendState==='uploading')
                            ? '<span class="elo-audio-state"><i class="ph-bold ph-spinner-gap elo-spin"></i> sincronizando</span>'
                            : '<span class="elo-audio-state sent"><i class="ph-bold ph-check"></i> áudio</span>';
                    content=`<div class="elo-audio-player ${m._uploading?'is-uploading':''} ${m._failed?'is-failed':''}" data-duration="${Number(m.duration||0)}" data-media-holder><button class="elo-audio-play" onclick="event.stopPropagation();toggleChatAudio(this,'${escapeHTML(m.mediaKey||'')}')"><i class="ph-fill ph-play"></i></button><div class="elo-audio-main"><div class="elo-audio-wave" aria-hidden="true">${[8,14,20,11,17,24,13,19,10,22,15,8,18,25,12,20,9,16].map(h=>`<i style="height:${h}px"></i>`).join('')}</div><div class="elo-audio-track" onclick="seekChatAudio(event,this)"><div class="elo-audio-progress"></div></div><div class="elo-audio-info"><span data-audio-time>${duration}</span>${audioState}</div></div><button class="elo-audio-speed" onclick="event.stopPropagation();cycleChatAudioSpeed(this)">1x</button><audio ${localSrc?`src="${localSrc}"`:''} data-private-media-key="${escapeHTML(m.mediaKey||'')}" preload="metadata"></audio></div>`;
                } else if(m.type==='gift') {
                    const g=m.gift||{}; const senderName=getProfileName(m.senderId); const giftText=g.message||m.text||'';
                    content=`<div class="elo-chat-gift elo-gift-${escapeHTML(g.kind||'gift')}"><div class="elo-chat-gift-sparkles"><i>✦</i><i>♡</i><i>✦</i></div><div class="elo-chat-gift-emoji">${escapeHTML(g.emoji||'💝')}</div><p class="elo-chat-gift-label">${escapeHTML(senderName)} enviou</p><h4>${escapeHTML(g.title||'Um presente')}</h4><div class="elo-chat-gift-note">“${escapeHTML(giftText)}”</div></div>`;
                    mediaClass=' media special-card';
                } else if(m.type==='voucher') {
                    const v=m.voucher||{}; const status=v.status||'pending'; const debtorName=getProfileName(v.debtorUid); const beneficiaryName=getProfileName(v.beneficiaryUid); const isDebtor=currentUser?.uid===v.debtorUid; const isBeneficiary=currentUser?.uid===v.beneficiaryUid;
                    let statusHtml='',actions='';
                    if(status==='pending'){
                        statusHtml=`<span class="elo-voucher-status pending">● Pendente</span><p>${escapeHTML(debtorName)} está devendo <b>${escapeHTML(v.title||m.text)}</b> para ${escapeHTML(beneficiaryName)}.</p>`;
                        if(isDebtor)actions=`<button onclick="event.stopPropagation();markVoucherCompleted('${m.id}')" class="elo-voucher-action primary">Marcar como concluído</button>`;
                    }else if(status==='awaiting_confirmation'){
                        statusHtml=`<span class="elo-voucher-status waiting">● Aguardando confirmação</span><p>${escapeHTML(debtorName)} marcou como realizado. ${escapeHTML(beneficiaryName)} precisa confirmar.</p>`;
                        if(isBeneficiary)actions=`<div class="elo-voucher-actions"><button onclick="event.stopPropagation();reviewVoucherCompletion('${m.id}',false)" class="elo-voucher-action secondary">Ainda não</button><button onclick="event.stopPropagation();reviewVoucherCompletion('${m.id}',true)" class="elo-voucher-action primary">Confirmar ❤️</button></div>`;
                    }else{
                        statusHtml=`<span class="elo-voucher-status completed">✓ Concluído</span><p>Combinado realizado e confirmado por vocês.</p>`;
                    }
                    content=`<div class="elo-chat-voucher"><div class="elo-chat-voucher-icon">🎟️</div><div class="elo-chat-voucher-title">${escapeHTML(v.title||m.text)}</div>${statusHtml}${actions}</div>`;
                    mediaClass=' media special-card';
                } else {
                    content=`<div class="elo-message-text">${escapeHTML(m.text).replace(/\n/g,'<br>')}</div>`;
                }
                const reactions=reactionsFor(m);
                const reactHTML=Object.entries(reactions).map(([e,n])=>`<button onclick="event.stopPropagation();reactChatMessage('${m.id}','${e}')" class="elo-reaction-pill">${e}${n>1?` ${n}`:''}</button>`).join('');
                const rowClasses=[isMe?'me':'them',groupedPrev?'grouped grouped-prev':'',groupedNext?'grouped-next':''].filter(Boolean).join(' ');
                const deliveryMeta=isMe
                    ? (m._failed ? '<i class="ph-bold ph-warning-circle text-red-300"></i>' : (m._uploading || m.sendState==='uploading') ? '<i class="ph-bold ph-spinner-gap elo-spin text-white/60"></i>' : readState(m))
                    : '';
                return `${divider}<div class="elo-message-row ${rowClasses}"><div class="elo-message-stack"><div class="elo-message-bubble${mediaClass}" data-chat-message="${m.id}" aria-label="Mensagem. Segure para ver opções.">${reply}${content}<div class="elo-message-meta"><span>${formatTime(m.timestamp)}</span>${m.edited?'<span>· editada</span>':''}${deliveryMeta}</div></div>${reactHTML?`<div class="elo-message-reactions">${reactHTML}</div>`:''}</div></div>`;
            }).join('');
            const historyHTML = chatLoadingOlder
                ? '<div class="elo-chat-history-status loading"><i class="ph-bold ph-spinner-gap"></i> Carregando mensagens antigas…</div>'
                : chatHasMoreHistory
                    ? '<div class="elo-chat-history-status"><i class="ph-bold ph-arrow-up"></i> Suba para carregar mensagens antigas</div>'
                    : (chatMessages.length ? '<div class="elo-chat-history-status">Início da conversa ❤️</div>' : '');

            const partnerAvatar=partner?.photoUrl
                ? `<img src="${escapeHTML(partner.photoUrl)}" alt="${escapeHTML(partner?.name||'Parceiro')}">`
                : `<span class="text-lg font-black text-pink-300">${escapeHTML((partner?.name||'A').charAt(0).toUpperCase())}</span>`;
            const statusText=typing?'digitando…':online?'online agora':partner?.lastSeen?'visto recentemente':'offline';
            const statusClass=typing||online?'text-emerald-400':'text-slate-500';
            const replyBar=chatReplyTo?`<div class="elo-chat-replybar"><i class="ph-bold ph-arrow-bend-up-left text-pink-400"></i><div class="flex-1 min-w-0"><span>${chatEditingId?'Editando':'Respondendo'}:</span> <b class="text-slate-200">${escapeHTML(chatReplyTo.text||'Imagem')}</b></div><button onclick="cancelChatReply()" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300">✕</button></div>`:'';

            const emptyHTML='<div class="elo-chat-empty"><div class="w-14 h-14 mx-auto rounded-2xl bg-pink-500/10 text-pink-400 grid place-items-center mb-3"><i class="ph-fill ph-chat-teardrop-text text-3xl"></i></div><p class="font-bold text-slate-300">Comecem uma conversa ❤️</p><p class="mt-1 text-xs">Mensagens, fotos, áudios e carinho ficam aqui.</p></div>';
            const existingShell=main.querySelector('.elo-chat-shell');

            // IMPORTANTE: depois que o chat é montado, nunca recriamos o composer.
            // O listener do Firestore atualiza apenas mensagens/cabeçalho/reply bar.
            // Isso preserva foco, teclado aberto, seleção e todo o rascunho digitado.
            if(existingShell && document.getElementById('chat-input')){
                const headerAvatar=document.getElementById('elo-chat-partner-avatar');
                const headerName=document.getElementById('elo-chat-partner-name');
                const headerStatus=document.getElementById('elo-chat-partner-status');
                const headerDot=document.getElementById('elo-chat-partner-dot');
                if(headerAvatar && headerAvatar.dataset.avatarHtml !== partnerAvatar) {
                    headerAvatar.innerHTML=partnerAvatar;
                    headerAvatar.dataset.avatarHtml=partnerAvatar;
                }
                const nextPartnerName=partner?.name||'Seu amor';
                if(headerName && headerName.textContent!==nextPartnerName) headerName.textContent=nextPartnerName;
                if(headerStatus){
                    if(headerStatus.textContent!==statusText) headerStatus.textContent=statusText;
                    const nextStatusClass=`text-[10px] ${statusClass}`;
                    if(headerStatus.className!==nextStatusClass) headerStatus.className=nextStatusClass;
                }
                if(headerDot){
                    const nextDotClass=`w-1.5 h-1.5 rounded-full ${online?'bg-emerald-400':'bg-slate-600'}`;
                    if(headerDot.className!==nextDotClass) headerDot.className=nextDotClass;
                }

                const messagesEl=document.getElementById('chat-messages');
                if(messagesEl){
                    const wasNearBottom=isChatNearBottom(messagesEl);
                    const previousTop=messagesEl.scrollTop;
                    const previousHeight=messagesEl.scrollHeight;
                    const newlyArrived = chatSuppressNewMessageCounter
                        ? 0
                        : chatMessages.filter(m => !chatRenderedMessageIds.has(m.id) && m.senderId !== currentUser.uid).length;
                    if (chatUserAwayFromBottom && newlyArrived > 0) chatNewMessagesWhileAway += newlyArrived;
                    messagesEl.innerHTML=(historyHTML + (msgHTML||emptyHTML));
                    bindChatScrollBehavior(messagesEl);
                    requestAnimationFrame(()=>{
                        if(chatForceBottomOnOpen || (!chatUserAwayFromBottom && wasNearBottom)) {
                            messagesEl.scrollTop=messagesEl.scrollHeight;
                            chatForceBottomOnOpen=false;
                        } else {
                            // Preserve exatamente a região que o usuário estava lendo.
                            messagesEl.scrollTop=previousTop+(messagesEl.scrollHeight-previousHeight);
                        }
                        updateChatNewMessagesButton();
                    });
                }
                const replySlot=document.getElementById('elo-chat-reply-slot');
                if(replySlot) replySlot.innerHTML=replyBar;
                chatRenderedMessageIds = new Set(chatMessages.map(m => m.id));
                bindChatMessageGestures();
                bindAudioPlayers();
                hydrateChatMedia();
                return;
            }

            main.innerHTML=`<div class="elo-chat-shell"><div class="elo-chat-header"><div id="elo-chat-partner-avatar" class="elo-chat-avatar">${partnerAvatar}</div><div class="flex-1 min-w-0"><p id="elo-chat-partner-name" class="font-black text-white text-[15px] truncate">${escapeHTML(partner?.name||'Seu amor')}</p><div class="flex items-center gap-1.5"><span id="elo-chat-partner-dot" class="w-1.5 h-1.5 rounded-full ${online?'bg-emerald-400':'bg-slate-600'}"></span><p id="elo-chat-partner-status" class="text-[10px] ${statusClass}">${statusText}</p></div></div><button onclick="searchChatMessages()" class="w-9 h-9 rounded-xl bg-slate-800/90 text-slate-300 grid place-items-center active:scale-95"><i class="ph-bold ph-magnifying-glass"></i></button></div><div class="relative flex-1 min-h-0"><div class="elo-chat-messages hide-scrollbar h-full" id="chat-messages">${historyHTML}${msgHTML||emptyHTML}</div><button id="chat-new-messages" onclick="scrollChatToLatest()" class="hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-pink-600 text-white text-xs font-black px-4 py-2 shadow-xl active:scale-95 whitespace-nowrap">↓ 1 nova mensagem</button></div><div id="elo-chat-reply-slot">${replyBar}</div><div class="elo-chat-composer"><div id="chat-compose-normal" class="elo-compose-row"><label class="elo-chat-tool elo-attach-action cursor-pointer" title="Enviar foto" aria-label="Enviar foto"><i class="ph-bold ph-plus text-xl"></i><input type="file" accept="image/*" class="hidden" onchange="sendChatImage(event)"></label><div class="elo-chat-input-wrap"><textarea id="chat-input" rows="1" maxlength="2000" placeholder="Mensagem" oninput="handleChatComposerInput(this)" onfocus="setChatFocusState(true)" onblur="setChatFocusState(false)" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();sendChatMessage();}">${escapeHTML(chatDraft)}</textarea><i class="ph-bold ph-smiley elo-compose-smile" aria-hidden="true"></i></div><button id="chat-mic-action" onclick="startChatAudioRecording()" class="elo-chat-send elo-mic-primary" aria-label="Gravar áudio" title="Gravar áudio"><i class="ph-fill ph-microphone text-xl"></i></button><button id="chat-send-action" data-chat-send onpointerdown="event.preventDefault()" onmousedown="event.preventDefault()" onclick="sendChatMessage()" class="elo-chat-send hidden" aria-label="Enviar mensagem"><i class="ph-fill ph-paper-plane-right text-xl"></i></button></div><div id="chat-recording-panel" class="elo-chat-recording" style="display:none"><button onclick="cancelChatAudioRecording()" class="elo-rec-trash" aria-label="Cancelar gravação"><i class="ph-bold ph-trash text-lg"></i></button><span class="elo-rec-dot"></span><div class="min-w-0 flex-1"><div class="elo-rec-wave">${[10,18,13,23,16,9,20,14,25,12,18,8,22,15,11,19].map(h=>`<i style="height:${h}px"></i>`).join('')}</div><div class="flex items-center justify-between gap-2"><div id="chat-record-time" class="elo-rec-time">0:00</div><div class="elo-rec-label">Gravando…</div></div></div><button onclick="finishChatAudioRecording()" class="elo-rec-send-round" aria-label="Enviar áudio"><i class="ph-fill ph-paper-plane-right text-xl"></i></button></div></div></div>`;

            const c=document.getElementById('chat-messages');
            if(c){
                bindChatScrollBehavior(c);
                chatUserAwayFromBottom=false;
                chatNewMessagesWhileAway=0;
                requestAnimationFrame(()=>{ c.scrollTop=c.scrollHeight; updateChatNewMessagesButton(); });
            }
            const input=document.getElementById('chat-input');
            if(input){
                resizeChatComposer(input);
                syncChatComposerAction();
                if(hadFocus || chatShouldKeepFocus){
                    requestAnimationFrame(()=>{input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);});
                }
            }
            chatRenderedMessageIds = new Set(chatMessages.map(m => m.id));
            bindChatMessageGestures();
            bindAudioPlayers();
            hydrateChatMedia();
            updateRecordingUI();
        };

        let chatViewportRaf=0,lastChatViewportHeight=0;
        const syncChatVisualViewport=()=>{if(chatViewportRaf)return;chatViewportRaf=requestAnimationFrame(()=>{chatViewportRaf=0;const vv=window.visualViewport;const h=Math.round(vv?vv.height:window.innerHeight);if(Math.abs(h-lastChatViewportHeight)>2){lastChatViewportHeight=h;document.documentElement.style.setProperty('--elo-visible-vh',`${h}px`);}const open=!!vv&&(window.innerHeight-vv.height)>120;document.body.classList.toggle('elo-keyboard-open',open&&window.activeTab==='chat');});};
        if(window.visualViewport)visualViewport.addEventListener('resize',syncChatVisualViewport,{passive:true});
        window.addEventListener('resize',syncChatVisualViewport,{passive:true});syncChatVisualViewport();

        const partnerUidOf = () => {
            const users = coupleData?.users || {};
            return Object.keys(users).find(id => id !== currentUser?.uid) || null;
        };

        const dispatchPartnerPush = async notificationId => {
            if (!currentUser || !coupleId || !notificationId) return;
            if (!ELO_PUSH_ENDPOINT || ELO_PUSH_ENDPOINT.includes('COLE_AQUI')) {
                console.info('Push externo ainda não configurado: publique cloudflare-worker/ e configure ELO_PUSH_ENDPOINT.');
                return;
            }
            try {
                const idToken = await currentUser.getIdToken();
                const response = await fetch(ELO_PUSH_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ coupleId, notificationId })
                });
                if (!response.ok) {
                    const detail = await response.text().catch(()=> '');
                    throw new Error(`Push ${response.status}: ${detail.slice(0,180)}`);
                }
            } catch (e) {
                // A notificação interna já foi salva; falha no push não deve impedir a ação principal.
                console.warn('Push externo:', e);
            }
        };

        const createPartnerNotification = async ({title, body, type='system', data={}}) => {
            const recipientUid = partnerUidOf();
            if (!recipientUid || !coupleId || !currentUser) return;
            try {
                const notificationRef = await addDoc(collection(db, 'relationships', coupleId, 'notifications'), {
                    recipientUid,
                    senderUid: currentUser.uid,
                    senderName: coupleData?.users?.[currentUser.uid]?.name || currentUser.displayName || 'Seu amor',
                    title, body, type, data,
                    notificationCategory: type || 'system',
                    createdAt: Date.now(), read: false,
                    pushStatus: 'pending'
                });
                // Disparo serverless gratuito. O Worker valida o usuário e usa os dados reais do Firestore.
                dispatchPartnerPush(notificationRef.id);
            } catch (e) { console.warn('Notificação do casal:', e); }
        };

        const markNotificationRead = async id => {
            try { await updateDoc(doc(db, 'relationships', coupleId, 'notifications', id), {read:true}); } catch(e) {}
        };

        const startNotificationSync = () => {
            if (!coupleId || !currentUser) return;
            if (unsubscribeNotifications) unsubscribeNotifications();
            unsubscribeNotifications = onSnapshot(
                query(
                    collection(db, 'relationships', coupleId, 'notifications'),
                    orderBy('createdAt','desc'),
                    limit(100)
                ),
                snap => {
                const incoming = snap.docs.map(d => ({id:d.id, ...d.data()}))
                    .filter(n => n.recipientUid === currentUser.uid)
                    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
                window.eloNotifications = incoming;
                const unread = incoming.filter(n => !n.read);
                const dot = document.getElementById('notification-dot');
                if (dot) { dot.textContent = unread.length > 9 ? '9+' : String(unread.length); dot.classList.toggle('hidden', !unread.length); dot.classList.toggle('flex', !!unread.length); }
                if (unread.length && window.activeTab !== 'chat') {
                    const newest = unread[0];
                    if (newest && notificationPrefEnabled(newest.type || newest.notificationCategory || 'system') && newest.createdAt > Number(localStorage.getItem('elo_last_push_notice')||0)) {
                        localStorage.setItem('elo_last_push_notice', String(newest.createdAt));
                        showToast(`${newest.title}: ${newest.body}`, 'info');
                    }
                }
            }, err => console.warn('Sincronização de notificações:', err));
        };

        window.openNotificationCenter = () => {
            const list = (window.eloNotifications || []).slice(0,40);
            openGenericModal(`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🔔 Central</p><h3 class="text-xl font-black text-white">Notificações</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><button onclick="enablePushNotifications()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">🔔 Ativar notificações no aparelho</button><button onclick="openNotificationSettings()" class="w-full bg-slate-800 border border-slate-700 text-white font-black py-3 rounded-xl">⚙️ Configurar notificações</button><button onclick="openPushDiagnostics()" class="w-full bg-slate-900 border border-slate-700 text-white font-black py-3 rounded-xl">🩺 Diagnóstico de notificações</button><div class="space-y-2">${list.map(n=>`<button onclick="markNotificationRead('${n.id}')" class="w-full text-left p-3 rounded-2xl border ${n.read?'border-slate-800 bg-slate-900':'border-pink-500/30 bg-pink-500/10'}"><p class="text-sm font-black text-white">${escapeHTML(n.title||'Elo')}</p><p class="text-xs text-slate-300 mt-1">${escapeHTML(n.body||'')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(n.createdAt||Date.now()).toLocaleString('pt-BR')}</p></button>`).join('') || '<p class="text-sm text-slate-500 text-center py-6">Nenhuma notificação ainda.</p>'}</div></div>`);
        };

        const notificationPrefEnabled = type => !!(window.notificationPrefs?.[type] ?? true);

        const loadNotificationPrefs = async () => {
            if (!currentUser) return;
            try {
                const snap = await getDoc(doc(db, 'userProfiles', currentUser.uid));
                const saved = snap.exists() ? (snap.data().notificationPrefs || {}) : {};
                window.notificationPrefs = {...DEFAULT_NOTIFICATION_PREFS, ...saved};
            } catch (e) { console.warn('Preferências de notificações:', e); }
        };

        const saveNotificationPrefs = async prefs => {
            if (!currentUser) return;
            window.notificationPrefs = {...DEFAULT_NOTIFICATION_PREFS, ...prefs};
            try {
                await setDoc(doc(db, 'userProfiles', currentUser.uid), {notificationPrefs: window.notificationPrefs, updatedAt: Date.now()}, {merge:true});
                showToast('Preferências de notificações salvas.', 'success');
            } catch (e) { console.error(e); showToast('Não foi possível salvar as preferências.', 'error'); }
        };

        window.openPushDiagnostics=async()=>{openGenericModal(`<div class="space-y-4"><h3 class="text-xl font-black text-white">🩺 Diagnóstico de notificações</h3><div id="push-diag" class="text-sm text-slate-400">Verificando…</div><button onclick="enablePushNotifications();setTimeout(openPushDiagnostics,1200)" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Registrar/atualizar este aparelho</button></div>`);const rows=[];const add=(n,ok,d)=>rows.push([n,ok,d]);add('HTTPS',window.isSecureContext,window.isSecureContext?'OK':'Push exige HTTPS');add('Permissão','Notification'in window&&Notification.permission==='granted','Notification'in window?Notification.permission:'indisponível');let reg=null;try{reg=await navigator.serviceWorker.ready;add('Service Worker',!!reg.active,reg.active?'Ativo':'Inativo')}catch(e){add('Service Worker',false,e.message)}let token='';if(reg&&Notification.permission==='granted')try{token=await getToken(messaging,{vapidKey:FCM_VAPID_KEY,serviceWorkerRegistration:reg});add('Token FCM',!!token,token?token.slice(0,18)+'…':'Não gerado')}catch(e){add('Token FCM',false,e.message)}let saved=false;if(token&&currentUser)try{saved=(await getDoc(doc(db,'userProfiles',currentUser.uid,'fcmTokens',encodeURIComponent(token)))).exists()}catch(_){}add('Token no Firestore',saved,saved?'Registrado':'Não encontrado');const ep=!!ELO_PUSH_ENDPOINT&&!ELO_PUSH_ENDPOINT.includes('COLE_AQUI');if(!ep){add('Cloudflare Worker',false,'URL ainda não configurada')}else{try{const healthUrl=ELO_PUSH_ENDPOINT.replace(/\/push\/?$/,'/health');const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),5000);const hr=await fetch(healthUrl,{cache:'no-store',signal:ctl.signal});clearTimeout(tm);let hj=null;try{hj=await hr.json()}catch(_){}add('Cloudflare Worker',hr.ok&&hj?.ok===true,hr.ok&&hj?.ok===true?'Online e conectado ao Elo':`Health check HTTP ${hr.status}`)}catch(e){add('Cloudflare Worker',false,`Falha ao conectar: ${e?.message||'erro de rede'}`)}};const el=document.getElementById('push-diag');if(el)el.innerHTML=rows.map(r=>`<div class="flex justify-between gap-3 p-3 mb-2 rounded-xl bg-slate-900 border ${r[1]?'border-emerald-500/20':'border-rose-500/30'}"><div><b class="text-white">${escapeHTML(r[0])}</b><div class="text-[10px] text-slate-500 break-all">${escapeHTML(String(r[2]||''))}</div></div><span>${r[1]?'✅':'❌'}</span></div>`).join('')};

        window.openNotificationSettings = () => {
            const p = {...DEFAULT_NOTIFICATION_PREFS, ...(window.notificationPrefs||{})};
            const rows = [
                ['messages','💬 Mensagens','Novas mensagens do seu parceiro'],
                ['quests','🎯 Missões','Missões concluídas e aprovações'],
                ['streak','🔥 Chama','Check-ins e alertas da Chama'],
                ['vouchers','🎁 Vouchers','Vouchers enviados ou usados'],
                ['moments','📸 Momentos','Novos momentos adicionados'],
                ['achievements','🏆 Conquistas','Conquistas e recompensas'],
                ['daily','💭 Pergunta do Dia','Respostas e novidades da pergunta'],
                ['system','✨ Sistema','Avisos gerais do Elo'],
                ['hideContent','🔐 Ocultar conteúdo','Mostra apenas “Você recebeu uma nova notificação no Elo” na tela bloqueada']
            ];
            openGenericModal(`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">⚙️ Preferências</p><h3 class="text-xl font-black text-white">Notificações</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><p class="text-xs text-slate-400">Escolha quais tipos podem gerar notificações no seu aparelho. A Central do Elo continua registrando as atividades.</p><div class="space-y-2">${rows.map(([key,title,desc])=>`<label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 cursor-pointer"><div><p class="text-sm font-bold text-white">${title}</p><p class="text-[10px] text-slate-500 mt-1">${desc}</p></div><input type="checkbox" class="w-5 h-5 accent-pink-600" data-notif-pref="${key}" ${p[key]?'checked':''}></label>`).join('')}</div><button onclick="saveNotificationSettingsFromUI()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Salvar preferências</button></div>`);
        };

        window.saveNotificationSettingsFromUI = async () => {
            const prefs = {};
            document.querySelectorAll('[data-notif-pref]').forEach(el => prefs[el.dataset.notifPref] = el.checked);
            await saveNotificationPrefs(prefs);
            closeGenericModal();
        };

        window.enablePushNotifications = async () => {
            if (!messagingSupported) return showToast('Este aparelho/navegador não suporta notificações push.', 'error');
            if (FCM_VAPID_KEY.includes('COLE_SUA')) return showToast('Configure a chave VAPID do Firebase antes de ativar as notificações.', 'info');
            try {
                if (Notification.permission === 'denied') return showToast('As notificações estão bloqueadas no navegador. Ative-as nas configurações do site.', 'info');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return showToast('Permissão de notificações não concedida.', 'info');
                const registration = await navigator.serviceWorker.ready;
                const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registration });
                if (!token || !currentUser) throw new Error('Token FCM não disponível.');
                await setDoc(doc(db, 'userProfiles', currentUser.uid, 'fcmTokens', encodeURIComponent(token)), { token, updatedAt: Date.now(), userAgent: navigator.userAgent }, {merge:true});
                pushInitialized = true;
                showToast('🔔 Notificações ativadas neste aparelho!', 'success');
            } catch (e) { console.error('FCM:', e); showToast('Não foi possível ativar as notificações. Verifique o FCM/VAPID.', 'error'); }
        };

        const initForegroundPush = () => {
            if (!messagingSupported || foregroundPushInitialized) return;
            foregroundPushInitialized = true;
            try {
                onMessage(messaging, payload => {
                    const n = payload.notification || payload.data || {};
                    showToast(`🔔 ${n.title || 'Elo'}${n.body ? ': '+n.body : ''}`, 'info');
                });
            } catch(e) {
                foregroundPushInitialized = false;
                console.warn('FCM foreground:', e);
            }
        };

        const getQuestByInstanceId = (instanceId, ownerUid = null) => {
            const parts = String(instanceId || '').split('_');
            const baseId = parts[parts.length - 1];
            return DAILY_QUEST_POOL.find(q => q.id === baseId) || null;
        };
        const getUserCoins = (data, uid) => Number(data?.users?.[uid]?.coins || 0);
        const getMissionXP = (data, uid) => Number(data?.users?.[uid]?.xp || 0);
        const XP_LEVELS = [
            { level: 1, title: 'Faísca', min: 0 },
            { level: 2, title: 'Sintonia', min: 150 },
            { level: 3, title: 'Conexão', min: 400 },
            { level: 4, title: 'Cumplicidade', min: 800 },
            { level: 5, title: 'Parceria', min: 1400 },
            { level: 6, title: 'Elo Forte', min: 2200 },
            { level: 7, title: 'Inseparáveis', min: 3200 },
            { level: 8, title: 'Alma Gêmea', min: 4500 },
            { level: 9, title: 'Elo Épico', min: 6200 },
            { level: 10, title: 'Elo Lendário', min: 8500 }
        ];
        const getUserLevelInfo = (data, uid) => {
            const xp = getMissionXP(data, uid);
            let current = XP_LEVELS[0];
            for (const entry of XP_LEVELS) if (xp >= entry.min) current = entry;
            const next = XP_LEVELS.find(entry => entry.level === current.level + 1) || null;
            const base = current.min;
            const span = next ? Math.max(1, next.min - base) : 1;
            return { ...current, xp, next, progress: next ? Math.min(100, Math.max(0, ((xp - base) / span) * 100)) : 100, remaining: next ? Math.max(0, next.min - xp) : 0 };
        };
        const getSpendableCoins = (data, uid) => getUserCoins(data, uid);

        window.requestQuestApproval = (questId) => {
            if (!coupleData || !currentUser) return;

            const quest = getQuestByInstanceId(questId, currentUser.uid);
            if (!quest) return showToast('Missão não encontrada.', 'error');

            const stateKey = `${questId}_${currentUser.uid}`;
            const state = coupleData.quests?.[stateKey];

            if (state === 'completed') {
                return showToast('Essa missão já foi concluída e aprovada.', 'info');
            }

            if (state === 'pending_approval') {
                return openCancelQuestApprovalModal(questId);
            }

            openGenericModal(`
                <div class="space-y-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-[10px] uppercase tracking-widest font-black text-orange-400">Confirmar conclusão</p>
                            <h3 class="text-xl font-black text-white mt-1">Você realmente concluiu?</h3>
                        </div>
                        <button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-300 shrink-0">✕</button>
                    </div>

                    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                        <p class="text-sm font-black text-white">${escapeHTML(quest.title)}</p>
                        <div class="flex flex-wrap gap-2 mt-3">
                            <span class="text-[10px] font-black px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">+${quest.reward} Coins</span>
                            <span class="text-[10px] font-black px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">+${quest.xp} XP</span>
                            <span class="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-800 text-slate-400">${escapeHTML(quest.difficultyLabel || quest.difficulty || '')}</span>
                        </div>
                    </div>

                    <p class="text-xs text-slate-400 leading-relaxed">
                        Ao confirmar, seu amor poderá ver o conteúdo desta missão e decidir se ela foi realmente concluída.
                    </p>

                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="closeGenericModal()" class="bg-slate-800 border border-slate-700 text-slate-300 font-black py-3 rounded-xl">
                            Ainda não fiz
                        </button>
                        <button onclick="confirmQuestCompletion('${questId}')" class="bg-gradient-to-r from-orange-500 to-pink-600 text-white font-black py-3 rounded-xl">
                            Sim, concluí
                        </button>
                    </div>
                </div>
            `);
        };

        window.confirmQuestCompletion = async (questId) => {
            if (!coupleData || !currentUser) return;

            const quest = getQuestByInstanceId(questId, currentUser.uid);
            if (!quest) return showToast('Missão não encontrada.', 'error');

            const stateKey = `${questId}_${currentUser.uid}`;
            const currentState = coupleData.quests?.[stateKey];

            if (currentState === 'completed') {
                closeGenericModal();
                return showToast('Essa missão já foi aprovada.', 'info');
            }

            if (currentState === 'pending_approval') {
                closeGenericModal();
                return showToast('Essa missão já está aguardando aprovação.', 'info');
            }

            // Feedback local imediato.
            coupleData = {
                ...coupleData,
                quests: {
                    ...(coupleData.quests || {}),
                    [stateKey]: 'pending_approval'
                }
            };
            closeGenericModal();
            if (window.activeTab === 'quests') updateUI();

            try {
                await updateDoc(doc(db, 'relationships', coupleId), {
                    [`quests.${stateKey}`]: 'pending_approval'
                });

                // A missão só é revelada ao parceiro depois desta confirmação.
                backgroundChatTask(createPartnerNotification({
                    title: '🎯 Missão para aprovar',
                    body: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} concluiu: ${quest.title}.`,
                    type: 'quest',
                    data: {
                        questId,
                        title: quest.title,
                        reward: quest.reward,
                        xp: quest.xp,
                        difficulty: quest.difficulty
                    }
                }), 'Notificação de missão');

                showToast('Missão enviada para aprovação!', 'success');
            } catch (err) {
                console.error('Enviar missão para aprovação:', err);

                // Reverte o estado otimista em caso de falha.
                const nextQuests = {...(coupleData.quests || {})};
                delete nextQuests[stateKey];
                coupleData = {...coupleData, quests: nextQuests};
                if (window.activeTab === 'quests') updateUI();

                showToast('Não foi possível enviar a missão para aprovação.', 'error');
            }
        };

        window.openCancelQuestApprovalModal = (questId) => {
            if (!coupleData || !currentUser) return;

            const stateKey = `${questId}_${currentUser.uid}`;
            if (coupleData.quests?.[stateKey] !== 'pending_approval') {
                return showToast('Essa missão não está aguardando aprovação.', 'info');
            }

            const quest = getQuestByInstanceId(questId, currentUser.uid);

            openGenericModal(`
                <div class="space-y-4">
                    <div>
                        <p class="text-[10px] uppercase tracking-widest font-black text-orange-400">Aguardando aprovação</p>
                        <h3 class="text-xl font-black text-white mt-1">Desfazer envio?</h3>
                        <p class="text-xs text-slate-400 mt-2">Use isso se você marcou a missão sem querer ou percebeu que ainda não concluiu.</p>
                    </div>

                    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                        <p class="text-sm font-black text-white">${escapeHTML(quest?.title || 'Missão')}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="closeGenericModal()" class="bg-slate-800 border border-slate-700 text-slate-300 font-black py-3 rounded-xl">
                            Manter envio
                        </button>
                        <button onclick="cancelQuestApproval('${questId}')" class="bg-red-500/15 border border-red-500/25 text-red-300 font-black py-3 rounded-xl">
                            Desfazer
                        </button>
                    </div>
                </div>
            `);
        };

        window.cancelQuestApproval = async (questId) => {
            if (!coupleData || !currentUser) return;

            const stateKey = `${questId}_${currentUser.uid}`;
            if (coupleData.quests?.[stateKey] !== 'pending_approval') {
                closeGenericModal();
                return showToast('Essa missão já mudou de estado.', 'info');
            }

            const quest = getQuestByInstanceId(questId, currentUser.uid);

            try {
                await updateDoc(doc(db, 'relationships', coupleId), {
                    [`quests.${stateKey}`]: deleteField()
                });

                const nextQuests = {...(coupleData.quests || {})};
                delete nextQuests[stateKey];
                coupleData = {...coupleData, quests: nextQuests};

                closeGenericModal();
                if (window.activeTab === 'quests') updateUI();

                backgroundChatTask(createPartnerNotification({
                    title: '↩️ Pedido de missão cancelado',
                    body: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} retirou uma missão que estava aguardando aprovação.`,
                    type: 'quest_cancelled',
                    data: {questId}
                }), 'Cancelamento de missão');

                showToast('Envio desfeito. A missão voltou para você.', 'info');
            } catch (err) {
                console.error('Cancelar aprovação de missão:', err);
                showToast('Não foi possível desfazer o envio.', 'error');
            }
        };

        window.approveQuest = async (questId, partnerId, reward, xp) => {
            if (!coupleData || !partnerId || partnerId === currentUser.uid) return;

            const quest = getQuestByInstanceId(questId, partnerId);
            const safeReward = Number(quest?.reward ?? reward ?? 0);
            const safeXP = Number(quest?.xp ?? xp ?? 0);
            const stateKey = `${questId}_${partnerId}`;
            const ref = doc(db, 'relationships', coupleId);

            try {
                let approved = false;

                // Transação evita recompensa dupla em toque repetido / dois aparelhos.
                await runTransaction(db, async transaction => {
                    const snap = await transaction.get(ref);
                    if (!snap.exists()) throw new Error('ELO_NOT_FOUND');

                    const data = snap.data();
                    if (data.quests?.[stateKey] !== 'pending_approval') {
                        throw new Error('QUEST_NOT_PENDING');
                    }

                    if (!data.users?.[partnerId]) throw new Error('PARTNER_NOT_FOUND');

                    transaction.update(ref, {
                        [`quests.${stateKey}`]: 'completed',
                        [`users.${partnerId}.coins`]: increment(safeReward),
                        [`users.${partnerId}.xp`]: increment(safeXP)
                    });

                    approved = true;
                });

                if (!approved) return;

                backgroundChatTask(createPartnerNotification({
                    title: '🏆 Missão aprovada!',
                    body: `Você ganhou ${safeReward} Elo Coins e ${safeXP} XP.`,
                    type: 'quest_approved',
                    data: {questId, reward: safeReward, xp: safeXP}
                }), 'Aprovação de missão');

                showToast(`Aprovado! ${coupleData.users?.[partnerId]?.name || 'Seu amor'} recebeu as recompensas.`, 'success');
            } catch (err) {
                console.error('Aprovar missão:', err);

                if (err?.message === 'QUEST_NOT_PENDING') {
                    showToast('Essa missão já foi aprovada, recusada ou cancelada.', 'info');
                } else {
                    showToast('Não foi possível aprovar a missão.', 'error');
                }
            }
        };

        window.openRejectQuestModal = (questId, partnerId) => {
            if (!coupleData || !partnerId || partnerId === currentUser.uid) return;

            const stateKey = `${questId}_${partnerId}`;
            if (coupleData.quests?.[stateKey] !== 'pending_approval') {
                return showToast('Essa missão não está aguardando sua decisão.', 'info');
            }

            const quest = getQuestByInstanceId(questId, partnerId);
            const partnerName = coupleData.users?.[partnerId]?.name || 'Seu amor';

            openGenericModal(`
                <div class="space-y-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-[10px] uppercase tracking-widest font-black text-red-400">Recusar conclusão</p>
                            <h3 class="text-xl font-black text-white mt-1">A missão não foi concluída?</h3>
                        </div>
                        <button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-300 shrink-0">✕</button>
                    </div>

                    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                        <p class="text-[10px] text-slate-500 font-black uppercase">${escapeHTML(partnerName)} marcou:</p>
                        <p class="text-sm font-black text-white mt-1">${escapeHTML(quest?.title || 'Missão')}</p>
                    </div>

                    <p class="text-xs text-slate-400 leading-relaxed">
                        Ao recusar, nenhuma recompensa será entregue e a missão voltará para ${escapeHTML(partnerName)} tentar novamente.
                    </p>

                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="closeGenericModal()" class="bg-slate-800 border border-slate-700 text-slate-300 font-black py-3 rounded-xl">
                            Voltar
                        </button>
                        <button onclick="rejectQuest('${questId}','${partnerId}')" class="bg-red-600 text-white font-black py-3 rounded-xl">
                            Recusar
                        </button>
                    </div>
                </div>
            `);
        };

        window.rejectQuest = async (questId, partnerId) => {
            if (!coupleData || !partnerId || partnerId === currentUser.uid) return;

            const stateKey = `${questId}_${partnerId}`;
            const quest = getQuestByInstanceId(questId, partnerId);
            const ref = doc(db, 'relationships', coupleId);

            try {
                await runTransaction(db, async transaction => {
                    const snap = await transaction.get(ref);
                    if (!snap.exists()) throw new Error('ELO_NOT_FOUND');

                    const data = snap.data();

                    if (data.quests?.[stateKey] !== 'pending_approval') {
                        throw new Error('QUEST_NOT_PENDING');
                    }

                    transaction.update(ref, {
                        [`quests.${stateKey}`]: 'rejected'
                    });
                });

                closeGenericModal();

                backgroundChatTask(createPartnerNotification({
                    title: '↩️ Missão recusada',
                    body: `A missão "${quest?.title || 'Missão'}" não foi aprovada. Você pode tentar novamente.`,
                    type: 'quest_rejected',
                    data: {questId}
                }), 'Recusa de missão');

                showToast('Missão recusada. Nenhuma recompensa foi entregue.', 'info');
            } catch (err) {
                console.error('Recusar missão:', err);

                if (err?.message === 'QUEST_NOT_PENDING') {
                    closeGenericModal();
                    showToast('Essa missão já mudou de estado.', 'info');
                } else {
                    showToast('Não foi possível recusar a missão.', 'error');
                }
            }
        };


        /* =========================================================
           V34 · AMIZADES ENTRE ELOS
           ========================================================= */

        const SOCIAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        const getEloSocialName = (data = coupleData) => {
            const users = Object.values(data?.users || {});
            const names = users
                .map(u => String(u?.name || '').trim())
                .filter(Boolean)
                .slice(0,2);

            if (names.length >= 2) return `${names[0]} & ${names[1]}`;
            if (names.length === 1) return `Elo de ${names[0]}`;
            return 'Um Elo';
        };

        const normalizeSocialCode = value =>
            String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g,'')
                .replace(/[01IO]/g,'')
                .slice(0,6);

        window.normalizeSocialCodeInput = input => {
            if (!input) return;
            input.value = normalizeSocialCode(input.value);
        };

        const makeRandomSocialCode = () => {
            let code = '';
            for (let i=0;i<6;i++) {
                code += SOCIAL_CODE_ALPHABET[
                    Math.floor(Math.random()*SOCIAL_CODE_ALPHABET.length)
                ];
            }
            return code;
        };

        const findEloBySocialCode = async code => {
            const normalized = normalizeSocialCode(code);
            if (normalized.length !== 6) return null;

            const result = await getDocs(
                query(
                    collection(db,'relationships'),
                    where('social.code','==',normalized),
                    limit(1)
                )
            );

            if (result.empty) return null;

            const snap = result.docs[0];
            return {
                coupleId: snap.id,
                data: snap.data()
            };
        };

        const ensureSocialProfile = async () => {
            if (!coupleId || !coupleData || !currentUser) return;

            const users = coupleData.users || {};
            if (Object.keys(users).length < 2) return;

            const desiredName = getEloSocialName(coupleData);
            const existingCode = normalizeSocialCode(coupleData?.social?.code || '');

            if (existingCode.length === 6) {
                if (coupleData?.social?.displayName !== desiredName) {
                    updateDoc(
                        doc(db,'relationships',coupleId),
                        {'social.displayName':desiredName}
                    ).catch(()=>{});
                }
                return;
            }

            // Tenta alguns códigos até encontrar um que ainda não esteja em uso.
            for (let attempt=0; attempt<12; attempt++) {
                const candidate = makeRandomSocialCode();
                const found = await findEloBySocialCode(candidate);
                if (found) continue;

                try {
                    await updateDoc(
                        doc(db,'relationships',coupleId),
                        {
                            'social.code':candidate,
                            'social.displayName':desiredName,
                            'social.createdAt':Date.now(),
                            'social.enabled':true,
                            'social.friends':{},
                            'social.friendRequestsIncoming':{},
                            'social.friendRequestsOutgoing':{}
                        }
                    );
                    return;
                } catch (e) {
                    console.warn('Criar perfil social do Elo:', e);
                    return;
                }
            }
        };

        window.copySocialCode = async () => {
            const code = normalizeSocialCode(coupleData?.social?.code || '');
            if (!code) return showToast('O código social ainda está sendo preparado.', 'info');

            try {
                await navigator.clipboard.writeText(code);
                showToast('Código de amizade copiado! 🤝', 'success');
            } catch (_) {
                showToast(`Código de amizade: ${code}`, 'info');
            }
        };

        const getSocialFriends = () =>
            Object.entries(coupleData?.social?.friends || {})
                .map(([id,friend]) => ({coupleId:id,...(friend||{})}))
                .sort((a,b)=>String(a.displayName||'').localeCompare(String(b.displayName||''),'pt-BR'));

        const getIncomingFriendRequests = () =>
            Object.entries(coupleData?.social?.friendRequestsIncoming || {})
                .map(([id,request]) => ({coupleId:id,...(request||{})}))
                .sort((a,b)=>Number(b.sentAt||0)-Number(a.sentAt||0));

        const getOutgoingFriendRequests = () =>
            Object.entries(coupleData?.social?.friendRequestsOutgoing || {})
                .map(([id,request]) => ({coupleId:id,...(request||{})}));

        window.sendEloFriendRequest = async () => {
            if (!coupleId || !coupleData) return;

            const input = document.getElementById('elo-friend-code');
            const code = normalizeSocialCode(input?.value || '');

            if (code.length !== 6) {
                input?.focus({preventScroll:true});
                return showToast('Digite os 6 caracteres do código de amizade.', 'info');
            }

            if (code === normalizeSocialCode(coupleData?.social?.code || '')) {
                return showToast('Esse é o código do seu próprio Elo 😄', 'info');
            }

            const alreadyFriend = getSocialFriends()
                .some(friend => normalizeSocialCode(friend.code) === code);

            if (alreadyFriend) {
                return showToast('Vocês já são Elos amigos ❤️', 'info');
            }

            try {
                const target = await findEloBySocialCode(code);

                if (!target) {
                    return showToast('Não encontramos nenhum Elo com esse código.', 'error');
                }

                if (target.coupleId === coupleId) {
                    return showToast('Esse é o seu próprio Elo.', 'info');
                }

                const targetUsers = Object.keys(target.data?.users || {});
                if (targetUsers.length < 2) {
                    return showToast('Esse Elo ainda não está completo.', 'info');
                }

                if (target.data?.social?.friends?.[coupleId]) {
                    return showToast('Vocês já são amigos.', 'info');
                }

                const myCode = normalizeSocialCode(coupleData?.social?.code || '');
                const myName = getEloSocialName(coupleData);
                const targetName = getEloSocialName(target.data);
                const now = Date.now();

                const myRef = doc(db,'relationships',coupleId);
                const targetRef = doc(db,'relationships',target.coupleId);

                await runTransaction(db, async transaction => {
                    const [mySnap,targetSnap] = await Promise.all([
                        transaction.get(myRef),
                        transaction.get(targetRef)
                    ]);

                    if (!mySnap.exists() || !targetSnap.exists()) {
                        throw new Error('ELO_NOT_FOUND');
                    }

                    const myData = mySnap.data();
                    const remoteData = targetSnap.data();

                    if (myData?.social?.friends?.[target.coupleId] ||
                        remoteData?.social?.friends?.[coupleId]) {
                        throw new Error('ALREADY_FRIENDS');
                    }

                    transaction.update(targetRef,{
                        [`social.friendRequestsIncoming.${coupleId}`]:{
                            code:myCode,
                            displayName:myName,
                            sentAt:now
                        }
                    });

                    transaction.update(myRef,{
                        [`social.friendRequestsOutgoing.${target.coupleId}`]:{
                            code,
                            displayName:targetName,
                            sentAt:now
                        }
                    });
                });

                if (input) input.value = '';
                showToast(`Pedido enviado para ${targetName}! 🤝`,'success');
            } catch (e) {
                console.error('Pedido de amizade:',e);

                if (e?.message === 'ALREADY_FRIENDS') {
                    showToast('Vocês já são Elos amigos.', 'info');
                } else {
                    showToast('Não foi possível enviar o pedido agora.', 'error');
                }
            }
        };

        window.acceptEloFriendRequest = async fromCoupleId => {
            if (!coupleId || !fromCoupleId || fromCoupleId === coupleId) return;

            const myRef = doc(db,'relationships',coupleId);
            const fromRef = doc(db,'relationships',fromCoupleId);

            try {
                await runTransaction(db, async transaction => {
                    const [mySnap,fromSnap] = await Promise.all([
                        transaction.get(myRef),
                        transaction.get(fromRef)
                    ]);

                    if (!mySnap.exists() || !fromSnap.exists()) {
                        throw new Error('ELO_NOT_FOUND');
                    }

                    const myData = mySnap.data();
                    const fromData = fromSnap.data();
                    const request = myData?.social?.friendRequestsIncoming?.[fromCoupleId];

                    if (!request) throw new Error('REQUEST_NOT_FOUND');

                    const mySocialCode = normalizeSocialCode(myData?.social?.code || '');
                    const fromSocialCode = normalizeSocialCode(fromData?.social?.code || '');
                    const now = Date.now();

                    transaction.update(myRef,{
                        [`social.friends.${fromCoupleId}`]:{
                            code:fromSocialCode,
                            displayName:getEloSocialName(fromData),
                            friendsSince:now
                        },
                        [`social.friendRequestsIncoming.${fromCoupleId}`]:deleteField()
                    });

                    transaction.update(fromRef,{
                        [`social.friends.${coupleId}`]:{
                            code:mySocialCode,
                            displayName:getEloSocialName(myData),
                            friendsSince:now
                        },
                        [`social.friendRequestsOutgoing.${coupleId}`]:deleteField()
                    });
                });

                showToast('Agora vocês são Elos amigos! ❤️','success');
            } catch (e) {
                console.error('Aceitar amizade:',e);
                showToast('Não foi possível aceitar este pedido.','error');
            }
        };

        window.declineEloFriendRequest = async fromCoupleId => {
            if (!coupleId || !fromCoupleId) return;

            const myRef = doc(db,'relationships',coupleId);
            const fromRef = doc(db,'relationships',fromCoupleId);

            try {
                await runTransaction(db, async transaction => {
                    const [mySnap,fromSnap] = await Promise.all([
                        transaction.get(myRef),
                        transaction.get(fromRef)
                    ]);

                    if (!mySnap.exists()) return;

                    transaction.update(myRef,{
                        [`social.friendRequestsIncoming.${fromCoupleId}`]:deleteField()
                    });

                    if (fromSnap.exists()) {
                        transaction.update(fromRef,{
                            [`social.friendRequestsOutgoing.${coupleId}`]:deleteField()
                        });
                    }
                });

                showToast('Pedido recusado.','info');
            } catch (e) {
                console.error('Recusar amizade:',e);
                showToast('Não foi possível recusar o pedido.','error');
            }
        };

        window.removeEloFriend = async friendId => {
            if (!coupleId || !friendId) return;
            openEloConfirm({title:'Remover Elo amigo?',message:'O casal será removido da lista de amigos dos dois lados. As conversas antigas não serão apagadas automaticamente.',confirmLabel:'Remover amizade',danger:true,onConfirm:async()=>{
                const myRef=doc(db,'relationships',coupleId); const friendRef=doc(db,'relationships',friendId);
                try{
                    await runTransaction(db,async transaction=>{
                        const [mySnap,friendSnap]=await Promise.all([transaction.get(myRef),transaction.get(friendRef)]);
                        if(mySnap.exists()) transaction.update(myRef,{[`social.friends.${friendId}`]:deleteField()});
                        if(friendSnap.exists()) transaction.update(friendRef,{[`social.friends.${coupleId}`]:deleteField()});
                    });
                    if(socialChatFriendId===friendId) closeSocialChat();
                    showToast('Amizade removida.','info');
                }catch(e){console.error('Remover amizade:',e);showToast('Não foi possível remover a amizade.','error');}
            }});
        };

        const getSocialChatId = friendId =>
            [String(coupleId),String(friendId)].sort().join('__');

        const getSocialChatMessagesCollection = friendId =>
            collection(
                db,
                'eloSocialChats',
                getSocialChatId(friendId),
                'messages'
            );

        const mergeSocialMessages = (...groups) => {
            const byId = new Map();
            groups.flat().filter(Boolean).forEach(message => {
                byId.set(message.id, {...byId.get(message.id), ...message});
            });
            return [...byId.values()].sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));
        };

        window.openSocialChat = friendId => {
            if (!friendId || !coupleData?.social?.friends?.[friendId]) return;

            if (unsubscribeSocialChat) {
                unsubscribeSocialChat();
                unsubscribeSocialChat = null;
            }

            socialChatFriendId = friendId;
            socialView = 'chat';
            socialChatMessages = [];
            socialChatReady = false;
            socialChatHistoryCursor = null;
            socialChatHasMore = true;
            socialChatLoadingOlder = false;
            socialScrollRestore = null;
            activeTab = 'friends';
            window.activeTab = 'friends';
            document.body.dataset.eloTab = 'friends';

            updateUI();

            try {
                const chatId = getSocialChatId(friendId);

                setDoc(
                    doc(db,'eloSocialChats',chatId),
                    {
                        members:[coupleId,friendId],
                        updatedAt:Date.now()
                    },
                    {merge:true}
                ).catch(()=>{});

                // V35: somente as mensagens mais recentes ficam em tempo real.
                unsubscribeSocialChat = onSnapshot(
                    query(
                        getSocialChatMessagesCollection(friendId),
                        orderBy('timestamp','desc'),
                        limit(SOCIAL_CHAT_INITIAL_LIMIT)
                    ),
                    snap => {
                        const recent = snap.docs
                            .map(d=>({id:d.id,...d.data(),_optimistic:false}))
                            .reverse();

                        if (!socialChatReady) {
                            socialChatMessages = recent;
                            socialChatHistoryCursor = snap.docs.length
                                ? snap.docs[snap.docs.length-1]
                                : null;
                            socialChatHasMore = snap.docs.length === SOCIAL_CHAT_INITIAL_LIMIT;
                        } else {
                            // Preserva páginas antigas já carregadas e substitui mensagens otimistas pelo snapshot real.
                            socialChatMessages = mergeSocialMessages(socialChatMessages,recent);
                        }

                        socialChatReady = true;

                        if (window.activeTab === 'friends' &&
                            socialView === 'chat' &&
                            socialChatFriendId === friendId) {
                            renderSocialChatOnly();
                        }
                    },
                    err => {
                        console.warn('Chat social:',err);
                        socialChatReady = true;
                        if (window.activeTab === 'friends') renderSocialChatOnly();
                    }
                );
            } catch (e) {
                console.warn('Abrir chat social:',e);
            }
        };

        window.loadOlderSocialMessages = async () => {
            if (
                socialChatLoadingOlder ||
                !socialChatHasMore ||
                !socialChatHistoryCursor ||
                !socialChatFriendId
            ) return;

            const scroller = document.getElementById('social-chat-messages');
            socialScrollRestore = scroller
                ? {height:scroller.scrollHeight, top:scroller.scrollTop}
                : null;

            socialChatLoadingOlder = true;
            renderSocialChatOnly();

            try {
                const snap = await getDocs(
                    query(
                        getSocialChatMessagesCollection(socialChatFriendId),
                        orderBy('timestamp','desc'),
                        startAfter(socialChatHistoryCursor),
                        limit(SOCIAL_CHAT_HISTORY_PAGE)
                    )
                );

                const older = snap.docs
                    .map(d=>({id:d.id,...d.data(),_optimistic:false}))
                    .reverse();

                if (snap.docs.length) {
                    socialChatHistoryCursor = snap.docs[snap.docs.length-1];
                }
                if (snap.docs.length < SOCIAL_CHAT_HISTORY_PAGE) {
                    socialChatHasMore = false;
                }

                socialChatMessages = mergeSocialMessages(older,socialChatMessages);
            } catch (e) {
                console.warn('Histórico do chat social:',e);
                showToast('Não foi possível carregar mensagens antigas.','error');
            } finally {
                socialChatLoadingOlder = false;
                renderSocialChatOnly();
            }
        };

        window.closeSocialChat = () => {
            if (unsubscribeSocialChat) {
                unsubscribeSocialChat();
                unsubscribeSocialChat = null;
            }

            socialChatFriendId = '';
            socialChatMessages = [];
            socialChatReady = false;
            socialChatHistoryCursor = null;
            socialChatHasMore = true;
            socialChatLoadingOlder = false;
            socialScrollRestore = null;
            socialView = 'list';

            if (window.activeTab === 'friends') updateUI();
        };

        window.sendSocialMessage = async () => {
            if (!socialChatFriendId || !coupleId) return;

            const friendId = socialChatFriendId;
            const input = document.getElementById('social-chat-input');
            const text = String(input?.value || '').trim();
            if (!text) return;

            if (text.length > 1500) {
                return showToast('Mensagem muito longa.','info');
            }

            const friend = coupleData?.social?.friends?.[friendId];
            if (!friend) return showToast('Este Elo não está mais na sua lista de amigos.','error');

            const messageRef = doc(getSocialChatMessagesCollection(friendId));
            const message = {
                id:messageRef.id,
                senderCoupleId:coupleId,
                senderName:getEloSocialName(coupleData),
                text,
                timestamp:Date.now(),
                _optimistic:true
            };

            if (input) {
                input.value='';
                input.style.height='auto';
            }

            // A mensagem aparece no mesmo instante; Firestore sincroniza depois.
            socialChatMessages = mergeSocialMessages(socialChatMessages,message);
            renderSocialChatOnly();

            try {
                const {id,_optimistic,...remoteMessage} = message;
                await setDoc(messageRef,remoteMessage);

                setDoc(
                    doc(db,'eloSocialChats',getSocialChatId(friendId)),
                    {
                        members:[coupleId,friendId],
                        updatedAt:Date.now(),
                        lastMessage:text.slice(0,100)
                    },
                    {merge:true}
                ).catch(()=>{});
            } catch (e) {
                console.error('Enviar mensagem social:',e);
                socialChatMessages = socialChatMessages.filter(m=>m.id!==messageRef.id);
                renderSocialChatOnly();
                showToast('Não foi possível enviar a mensagem.','error');
            }
        };

        const renderSocialChatOnly = () => {
            if (window.activeTab !== 'friends' || socialView !== 'chat') return;

            const main = document.getElementById('main-content');
            if (!main) return;

            const friend = coupleData?.social?.friends?.[socialChatFriendId];

            if (!friend) {
                socialView='list';
                socialChatFriendId='';
                updateUI();
                return;
            }

            const oldInput = document.getElementById('social-chat-input');
            const draft = oldInput?.value || '';
            const hadFocus = document.activeElement === oldInput;
            const oldScroller = document.getElementById('social-chat-messages');
            const wasNearBottom = oldScroller
                ? oldScroller.scrollHeight-oldScroller.scrollTop-oldScroller.clientHeight < 100
                : true;

            const historyControl = socialChatHasMore
                ? `<div class="flex justify-center py-1"><button ${socialChatLoadingOlder?'disabled':''} onclick="loadOlderSocialMessages()" class="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-[9px] font-black text-slate-400 disabled:opacity-60">${socialChatLoadingOlder?'<i class="ph-bold ph-spinner-gap animate-spin mr-1"></i>Carregando…':'↑ Mensagens anteriores'}</button></div>`
                : (socialChatMessages.length ? '<p class="text-center text-[8px] text-slate-700 py-1">Início da conversa</p>' : '');

            const messagesHTML = socialChatMessages.length
                ? socialChatMessages.map(m=>{
                    const mine = m.senderCoupleId === coupleId;
                    return `
                        <div class="flex ${mine?'justify-end':'justify-start'}">
                            <div class="max-w-[82%] rounded-2xl ${mine?'bg-purple-600 text-white rounded-br-md':'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-md'} px-3 py-2 shadow-md ${m._optimistic?'opacity-80':''}">
                                ${mine?'':`<p class="text-[8px] uppercase tracking-widest font-black text-purple-300 mb-1">${escapeHTML(m.senderName||friend.displayName||'Elo amigo')}</p>`}
                                <p class="text-sm whitespace-pre-wrap break-words">${escapeHTML(m.text||'')}</p>
                                <p class="text-[8px] ${mine?'text-purple-100/70':'text-slate-500'} mt-1 text-right">${m._optimistic?'<i class="ph-bold ph-clock mr-1"></i>':''}${new Date(Number(m.timestamp||Date.now())).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                            </div>
                        </div>
                    `;
                }).join('')
                : socialChatReady
                    ? `<div class="text-center text-slate-500 py-12"><i class="ph-fill ph-chat-circle-dots text-3xl text-purple-400"></i><p class="text-sm font-bold mt-3">Comecem a conversar 👋</p><p class="text-xs mt-1">Este chat é entre os dois Elos.</p></div>`
                    : `<div class="text-center text-slate-500 py-12"><i class="ph-bold ph-spinner-gap animate-spin text-2xl text-purple-400"></i><p class="text-xs font-bold mt-3">Abrindo conversa…</p></div>`;

            main.innerHTML=`
                <div class="h-[calc(100dvh-175px)] flex flex-col">
                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-lg">
                        <button onclick="closeSocialChat()" class="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 grid place-items-center"><i class="ph-bold ph-arrow-left"></i></button>
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 grid place-items-center text-purple-300"><i class="ph-fill ph-users-three text-xl"></i></div>
                        <div class="min-w-0 flex-1">
                            <p class="font-black text-white truncate">${escapeHTML(friend.displayName||'Elo amigo')}</p>
                            <p class="text-[9px] text-slate-500">Chat entre Elos · ${escapeHTML(friend.code||'')}</p>
                        </div>
                        <button onclick="removeEloFriend('${socialChatFriendId}')" class="w-9 h-9 rounded-xl bg-slate-800 text-slate-500 grid place-items-center" title="Remover amizade"><i class="ph-bold ph-dots-three-vertical"></i></button>
                    </div>

                    <div id="social-chat-messages" class="flex-1 min-h-0 overflow-y-auto hide-scrollbar space-y-2 px-1 py-3 overscroll-contain">
                        ${historyControl}
                        ${messagesHTML}
                    </div>

                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex items-end gap-2">
                        <textarea
                            id="social-chat-input"
                            rows="1"
                            maxlength="1500"
                            placeholder="Mensagem para este Elo…"
                            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"
                            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSocialMessage();}"
                            class="flex-1 min-w-0 resize-none bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 max-h-[100px]"
                        >${escapeHTML(draft)}</textarea>
                        <button onclick="sendSocialMessage()" class="w-11 h-11 shrink-0 rounded-xl bg-purple-600 text-white grid place-items-center active:scale-95"><i class="ph-fill ph-paper-plane-right text-xl"></i></button>
                    </div>
                </div>
            `;

            const scroller = document.getElementById('social-chat-messages');
            if (scroller) {
                if (socialScrollRestore) {
                    const restore = socialScrollRestore;
                    socialScrollRestore = null;
                    requestAnimationFrame(()=>{
                        scroller.scrollTop = restore.top + Math.max(0,scroller.scrollHeight-restore.height);
                    });
                } else if (wasNearBottom) {
                    requestAnimationFrame(()=>{scroller.scrollTop=scroller.scrollHeight;});
                }
            }

            const input = document.getElementById('social-chat-input');
            if (hadFocus && input) {
                requestAnimationFrame(()=>input.focus({preventScroll:true}));
            }
        };

        const eloTabScrollPositions = {};
        window.switchTab = (tab) => {
            if (tab === activeTab) return;
            const main = document.getElementById('main-content');
            if (main && activeTab !== 'chat') eloTabScrollPositions[activeTab] = main.scrollTop || 0;
            if (tab !== 'quests') stopDailyQuestTimer();
            if (main) main.classList.add('elo-tab-changing');
            activeTab = tab; window.activeTab = tab; document.body.dataset.eloTab = tab;
            if(tab==='chat'){chatForceBottomOnOpen=true;chatUserAwayFromBottom=false;chatNewMessagesWhileAway=0;markChatRead();}
            if(tab!=='friends' && socialView==='chat'){
                if(unsubscribeSocialChat){unsubscribeSocialChat();unsubscribeSocialChat=null;}
                socialView='list';socialChatFriendId='';socialChatMessages=[];socialChatReady=false;socialChatHistoryCursor=null;socialChatHasMore=true;socialChatLoadingOlder=false;socialScrollRestore=null;
            }
            updateUI();
            requestAnimationFrame(() => {
                if (main) { main.classList.remove('elo-tab-changing'); main.classList.add('elo-tab-enter'); setTimeout(()=>main.classList.remove('elo-tab-enter'),220); }
                if(tab==='chat') {
                    renderChatOnly();
                    forceChatToLatestOnEntry();
                } else if (main) {
                    const savedTop = Number(eloTabScrollPositions[tab] || 0);
                    requestAnimationFrame(()=>{ main.scrollTop = savedTop; });
                }
            });
        };
                let storeSortMode = 'recommended';

const centerActiveStoreCategory = (smooth = true) => {
            requestAnimationFrame(() => {
                const active = document.querySelector('[data-store-category].is-active-store-category');
                if (!active) return;
                try {
                    active.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
                } catch (_) {
                    const rail = document.getElementById('store-category-rail');
                    if (!rail) return;
                    const target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
                    rail.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
                }
            });
        };
        window.setStoreFilter = (cat) => {
            storeCategoryFilter = cat;
            updateUI();
            centerActiveStoreCategory(true);
        };
        window.setStoreSort = mode => {
            storeSortMode = ['recommended','price_asc','price_desc','alpha'].includes(mode) ? mode : 'recommended';
            updateUI();
            centerActiveStoreCategory(false);
        };
        let storeSearchFrame = 0;
        const applyStoreSearch = () => {
            storeSearchFrame = 0;
            const cards = document.querySelectorAll('[data-store-card]');
            let visible = 0;
            cards.forEach(card => {
                const match = !storeSearchQuery || (card.dataset.storeSearch || '').includes(storeSearchQuery);
                card.classList.toggle('hidden', !match);
                if (match) visible++;
            });
            const count = document.getElementById('store-result-count');
            if (count && count.textContent !== String(visible)) count.textContent = String(visible);
            const clear = document.getElementById('store-search-clear');
            if (clear) clear.classList.toggle('hidden', !storeSearchQuery);
            const empty = document.getElementById('store-empty-search');
            if (empty) empty.classList.toggle('hidden', visible > 0);
        };
        window.setStoreSearch = (value = '') => {
            storeSearchQuery = String(value || '').trim().toLowerCase();
            if (storeSearchFrame) cancelAnimationFrame(storeSearchFrame);
            storeSearchFrame = requestAnimationFrame(applyStoreSearch);
        };
        window.clearStoreSearch = () => {
            storeSearchQuery = '';
            const input = document.getElementById('store-search-input');
            if (input) input.value = '';
            setStoreSearch('');
            if (input) input.focus({preventScroll:true});
        };
        window.buyStoreItemFromDetails = (id) => { const item=getStoreItem(id); if(!item)return; if(item.delivery==='chat_gift'){closeGenericModal();return openVirtualGiftComposer(item.id);} closeGenericModal(); buyStoreItem(item.id,item.price,item.title); };
        window.openStoreItemDetails = (id) => {
            const item = getStoreItem(id);
            if (!item) return showToast('Item não encontrado.', 'error');
            const guide = getStoreItemGuide(item);
            const balance = getUserCoins(coupleData, currentUser.uid);
            const canBuy = balance >= item.price;
            openGenericModal(`
                <div class="space-y-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <span class="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1"><i class="ph-fill ph-${STORE_CATEGORY_INFO[item.category]?.icon || 'bag'}"></i>${guide.categoryName}</span>
                            <h3 class="text-xl font-black text-white mt-2">${escapeHTML(item.title)}</h3>
                            <p class="text-sm text-slate-300 mt-1">${escapeHTML(item.desc)}</p>
                        </div>
                        <button onclick="closeGenericModal()" class="w-9 h-9 shrink-0 rounded-full bg-slate-900 text-slate-400 grid place-items-center"><i class="ph-bold ph-x"></i></button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3"><p class="text-[9px] uppercase tracking-widest font-black text-slate-500">Preço</p><p class="text-lg font-black text-yellow-400 mt-1"><i class="ph-fill ph-coin"></i> ${item.price.toLocaleString('pt-BR')}</p></div>
                        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3"><p class="text-[9px] uppercase tracking-widest font-black text-slate-500">Seu saldo</p><p class="text-lg font-black ${canBuy ? 'text-emerald-400' : 'text-red-400'} mt-1">${balance.toLocaleString('pt-BR')}</p></div>
                    </div>
                    <div class="space-y-2">
                        <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"><p class="text-xs font-black text-white flex items-center gap-2"><i class="ph-fill ph-info text-purple-400"></i> O que é?</p><p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${escapeHTML(guide.purpose)}</p></div>
                        <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"><p class="text-xs font-black text-white flex items-center gap-2"><i class="ph-fill ph-play-circle text-pink-400"></i> Como funciona?</p><p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${escapeHTML(guide.activation)}</p></div>
                        <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"><p class="text-xs font-black text-white flex items-center gap-2"><i class="ph-fill ph-check-circle text-emerald-400"></i> O que acontece?</p><p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${escapeHTML(guide.result)}</p></div>
                        <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"><p class="text-xs font-black text-white flex items-center gap-2"><i class="ph-fill ph-shield-check text-cyan-400"></i> Regras</p><p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${escapeHTML(guide.rules)}</p></div>
                        <div class="bg-purple-500/5 border border-purple-500/15 rounded-2xl p-4"><p class="text-xs font-black text-purple-300 flex items-center gap-2"><i class="ph-fill ph-lightbulb"></i> Importante</p><p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${escapeHTML(guide.note)}</p></div>
                    </div>
                    <button ${canBuy ? '' : 'disabled'} onclick="buyStoreItemFromDetails('${item.id}')" class="w-full py-3.5 rounded-2xl font-black ${canBuy ? 'bg-purple-600 text-white active:scale-[.98]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} transition-transform">${canBuy ? (item.delivery==='chat_gift'?'Personalizar e enviar · ':'Comprar por ')+item.price.toLocaleString('pt-BR')+' Coins' : 'Elo Coins insuficientes'}</button>
                </div>`);
        };

        const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

        const getCoupleStats = (data) => {
            const stats = data?.stats || {};
            const users = data?.users || {};
            const streak = getStreakData(data);
            const ids = Object.keys(users);
            const partnerUid = ids.find(id => id !== currentUser.uid);
            const partner = partnerUid ? users[partnerUid] : null;
            return { stats, users, streak, partnerUid, partner, ids };
        };

        const getNextMilestone = (current) => {
            const milestones = [3, 7, 14, 30, 50, 100, 180, 365, 500, 1000];
            return milestones.find(n => n > current) || current + 100;
        };

        const deleteSubcollectionDocs = async (parentId, subcollection) => {
            const snap = await getDocs(collection(db, 'relationships', parentId, subcollection));
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 100) {
                await Promise.all(docs.slice(i, i + 100).map(item => deleteDoc(item.ref)));
            }
        };

        window.leaveElo = async () => {
            if (!coupleId || !currentUser || !coupleData) return;
            openEloConfirm({title:'Encerrar este Elo?',message:'Essa ação apaga o Elo para os dois e remove chama, sinergia, Coins, Bolsa, missões, conquistas, mensagens, notificações e momentos. Não pode ser desfeita.',confirmLabel:'Encerrar e apagar tudo',danger:true,onConfirm:performLeaveElo});
        };
        const performLeaveElo = async () => {
            if (!coupleId || !currentUser || !coupleData) return;
            const oldCoupleId = coupleId;
            const relationshipRef = doc(db, 'relationships', oldCoupleId);
            const loading = document.getElementById('loading-screen');
            if (loading) loading.classList.remove('hidden');
            try {
                const snap = await getDoc(relationshipRef);
                if (!snap.exists()) throw new Error('Este Elo já não existe.');
                if (!snap.data()?.users?.[currentUser.uid]) throw new Error('Sua conta não pertence a este Elo.');

                closeCoupleModal();
                if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
                if (unsubscribeNotifications) { unsubscribeNotifications(); unsubscribeNotifications = null; }
                if (unsubscribeMoments) { unsubscribeMoments(); unsubscribeMoments = null; }
                if (unsubscribeSocialChat) { unsubscribeSocialChat(); unsubscribeSocialChat = null; }
                if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
                socialView='list'; socialChatFriendId=''; socialChatMessages=[]; socialChatReady=false;

                // Excluir o documento pai não exclui as subcoleções no Firestore.
                await deleteSubcollectionDocs(oldCoupleId, 'messages');
                await deleteSubcollectionDocs(oldCoupleId, 'notifications');
                await deleteSubcollectionDocs(oldCoupleId, 'moments');
                await deleteSubcollectionDocs(oldCoupleId, 'capsules');
                await deleteDoc(relationshipRef);
                await setDoc(doc(db, 'userProfiles', currentUser.uid), {coupleId: null, updatedAt: Date.now()}, {merge: true});

                localStorage.removeItem('elo_coupleId');
                localStorage.removeItem('elo_chat_last_seen');
                coupleId = null; coupleData = null; chatMessages = []; chatInitialized = false;
                resetMomentsPagination();
                chatUnreadCount = 0; lastRelationshipRenderSignature = '';
                document.getElementById('main-header').classList.add('hidden');
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('main-nav').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
                showToast('Elo encerrado. Todo o progresso foi apagado.', 'success');
            } catch (e) {
                console.error('Erro ao encerrar Elo:', e);
                showToast(e.message === 'Este Elo já não existe.' ? e.message : 'Não foi possível encerrar o Elo. Tente novamente.', 'error');
            } finally {
                if (loading) loading.classList.add('hidden');
            }
        };

        window.openCoupleModal = () => {
            if (!coupleData) return;
            const { stats, streak, partner } = getCoupleStats(coupleData);
            const myData = coupleData.users?.[currentUser.uid] || {};
            const createdAt = coupleData.createdAt ? new Date(coupleData.createdAt) : null;
            const partnerChecked = partner?.lastCheckInDate === getGameDateKey();
            const myChecked = myData.lastCheckInDate === getGameDateKey();
            const code = coupleId || '----';
            const next = getNextMilestone(streak.current || 0);
            const progress = Math.min(100, Math.max(0, ((streak.current || 0) / next) * 100));
            const content = document.getElementById('couple-modal-content');
            content.innerHTML = `
                <div class="rounded-3xl p-5 bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-700 shadow-xl relative overflow-hidden">
                    <div class="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/10"></div>
                    <div class="absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-white/5"></div>
                    <div class="relative z-10 flex items-center justify-center gap-4">
                        <div class="text-center">
                            <div class="w-16 h-16 rounded-2xl bg-slate-950/30 border border-white/20 flex items-center justify-center overflow-hidden">
                                ${myData.photoUrl ? `<img src="${myData.photoUrl}" class="w-full h-full object-cover"/>` : `<span class="text-2xl font-black text-white">${escapeHTML((myData.name || 'E').charAt(0).toUpperCase())}</span>`}
                            </div>
                            <p class="text-xs font-black text-white mt-2">${escapeHTML(myData.name || 'Você')}</p>
                        </div>
                        <div class="flex flex-col items-center">
                            <i class="ph-fill ph-heart text-3xl text-white animate-pulse"></i>
                            <span class="text-[9px] text-white/70 uppercase tracking-widest mt-1">Elo</span>
                        </div>
                        <div class="text-center">
                            <div class="w-16 h-16 rounded-2xl bg-slate-950/30 border border-white/20 flex items-center justify-center overflow-hidden">
                                ${partner ? (partner.photoUrl ? `<img src="${partner.photoUrl}" class="w-full h-full object-cover"/>` : `<span class="text-2xl font-black text-white">${escapeHTML((partner.name || 'P').charAt(0).toUpperCase())}</span>`) : `<i class="ph-bold ph-user-plus text-2xl text-white/50"></i>`}
                            </div>
                            <p class="text-xs font-black text-white mt-2">${partner ? escapeHTML(partner.name) : 'Aguardando...'}</p>
                        </div>
                    </div>
                    <div class="relative z-10 mt-5 text-center">
                        <p class="text-4xl font-black text-white">🔥 ${streak.current || 0}</p>
                        <p class="text-xs text-white/80 font-bold uppercase tracking-widest">dias de chama</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                        <p class="text-[9px] uppercase tracking-widest text-slate-500 font-black">Recorde</p>
                        <p class="text-2xl font-black text-pink-400 mt-1">${streak.longest || 0}</p>
                        <p class="text-[10px] text-slate-500">dias</p>
                    </div>
                    <div class="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                        <p class="text-[9px] uppercase tracking-widest text-slate-500 font-black">Sinergia</p>
                        <p class="text-2xl font-black text-rose-400 mt-1">${Number(stats.synergy ?? 50)}</p>
                        <p class="text-[10px] text-slate-500">pontos</p>
                    </div>
                </div>

                <div class="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                    <div class="flex justify-between items-center mb-2">
                        <div><p class="text-xs font-black text-white">Próximo marco</p><p class="text-[10px] text-slate-500">${streak.current || 0} → ${next} dias</p></div>
                        <span class="text-xs font-black text-orange-400">${Math.round(progress)}%</span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full" style="width:${progress}%"></div></div>
                </div>

                <div class="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
                    <p class="text-[9px] uppercase tracking-widest text-slate-500 font-black">Check-in de hoje</p>
                    <div class="flex items-center justify-between"><span class="text-sm font-bold text-slate-200">${escapeHTML(myData.name || 'Você')}</span><span class="text-xs font-black ${myChecked ? 'text-emerald-400' : 'text-amber-400'}">${myChecked ? '✓ Fez hoje' : '○ Pendente'}</span></div>
                    <div class="flex items-center justify-between"><span class="text-sm font-bold text-slate-200">${partner ? escapeHTML(partner.name) : 'Seu par'}</span><span class="text-xs font-black ${partnerChecked ? 'text-emerald-400' : 'text-slate-500'}">${partner ? (partnerChecked ? '✓ Fez hoje' : '○ Ainda não') : 'Aguardando conexão'}</span></div>
                </div>

                <div class="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                    <p class="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-2">Código do Elo</p>
                    <div class="flex gap-2">
                        <div class="flex-1 bg-slate-900 rounded-xl px-4 py-3 font-mono text-xl font-black tracking-[0.35em] text-indigo-300 text-center border border-slate-800">${escapeHTML(code)}</div>
                        <button onclick="copyEloCode()" class="w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><i class="ph-bold ph-copy"></i></button>
                    </div>
                </div>

                <button onclick="openRelationshipDateModal()" class="w-full bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 text-left"><p class="text-[9px] uppercase tracking-widest text-pink-400 font-black">Data do relacionamento</p><p class="text-lg font-black text-white mt-1">${coupleData.relationshipStartDate ? new Date(`${coupleData.relationshipStartDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Definir nossa data'}</p><p class="text-xs text-slate-400 mt-1">${relationshipDurationText(coupleData)}</p></button>
                ${createdAt ? `<p class="text-center text-[10px] text-slate-600">Elo criado em ${createdAt.toLocaleDateString('pt-BR')} · esta data não entra no cálculo do relacionamento.</p>` : ''}
                ${partner ? '' : `<button onclick="openJoinPartnerEloModal()" class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black py-3.5 rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2"><i class="ph-bold ph-sign-in"></i> Entrar no Elo do meu amor</button>`}
                ${partner ? '' : `<button onclick="copyEloCode()" class="w-full bg-slate-800 text-white font-black py-3 rounded-xl border border-slate-700 active:scale-95">🔢 Copiar meu código de 4 dígitos</button>`}
                ${partner ? '' : `<button onclick="copyInviteLink()" class="w-full bg-slate-900 text-slate-300 font-black py-3 rounded-xl border border-slate-800 active:scale-95">🔗 Copiar link direto (opcional)</button>`}
                <button onclick="shareElo()" class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black py-3 rounded-xl active:scale-95 flex items-center justify-center gap-2"><i class="ph-fill ph-share-network"></i> Compartilhar convite</button>
                <div class="pt-2 border-t border-slate-800">
                    <button onclick="leaveElo()" class="w-full bg-red-950/40 hover:bg-red-950/60 border border-red-500/30 text-red-300 font-black py-3 rounded-xl active:scale-95 flex items-center justify-center gap-2">
                        <i class="ph-bold ph-heart-break"></i> Sair e encerrar este Elo
                    </button>
                    <p class="text-[9px] text-red-300/60 text-center mt-2">Isso apaga o progresso, missões, moedas, mensagens e demais dados deste casal para os dois.</p>
                </div>
            `;
            document.getElementById('couple-modal').classList.remove('hidden');
        };

        window.closeCoupleModal = () => document.getElementById('couple-modal').classList.add('hidden');

        window.openJoinPartnerEloModal = () => {
            const users = coupleData?.users || {};
            const hasPartner = Object.keys(users).some(uid => uid !== currentUser?.uid);

            if (hasPartner) {
                return showToast('Este Elo já possui um parceiro. Para trocar de Elo, encerre o vínculo atual primeiro.', 'info');
            }

            closeCoupleModal();
            openGenericModal(`
                <div class="space-y-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-[10px] uppercase tracking-widest font-black text-purple-400">Conectar ao seu amor</p>
                            <h3 class="text-xl font-black text-white mt-1">Entrar em outro Elo</h3>
                            <p class="text-xs text-slate-400 mt-2">Como seu Elo atual ainda está vazio, você pode trocar para o código do seu amor sem precisar criar outro vínculo.</p>
                        </div>
                        <button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-300 shrink-0">✕</button>
                    </div>

                    <div class="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                        <label class="text-[10px] uppercase tracking-widest font-black text-slate-500 block mb-2">Código do Elo do seu amor</label>
                        <input
                            id="switch-elo-code"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            maxlength="4"
                            placeholder="0000"
                            oninput="normalizeEloCodeInput(this)"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();switchToPartnerElo();}"
                            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.3em] text-white focus:outline-none focus:border-purple-500"
                        />
                    </div>

                    <div class="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-3">
                        <p class="text-[10px] text-amber-200/80 leading-relaxed">Seu Elo solo atual será removido depois que a conexão com o novo código for confirmada. Seus dados pessoais, como Coins, XP, nome, foto e personagem, serão preservados.</p>
                    </div>

                    <button onclick="switchToPartnerElo()" class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black py-3.5 rounded-xl">
                        Entrar nesse Elo
                    </button>
                </div>
            `);

            setTimeout(() => document.getElementById('switch-elo-code')?.focus(), 80);
        };

        window.switchToPartnerElo = async () => {
            if (!currentUser || !coupleId || !coupleData) return;

            const input = document.getElementById('switch-elo-code');
            const targetCode = normalizeEloJoinCode(input?.value || '');

            if (targetCode.length !== 4) {
                input?.focus({preventScroll:true});
                return showToast('Digite os 4 dígitos do Elo do seu amor.', 'info');
            }

            if (targetCode === coupleId) {
                return showToast('Esse já é o seu Elo atual.', 'info');
            }

            const currentUsers = coupleData.users || {};
            const currentIds = Object.keys(currentUsers);

            if (currentIds.some(uid => uid !== currentUser.uid)) {
                return showToast('Seu Elo atual já possui um parceiro e não pode ser trocado automaticamente.', 'error');
            }

            const loading = document.getElementById('loading-screen');
            if (loading) {
                loading.classList.remove('hidden','opacity-0','pointer-events-none');
            }

            const oldCode = coupleId;
            const oldData = coupleData;
            const myOldData = oldData.users?.[currentUser.uid] || {};

            try {
                const oldRef = doc(db,'relationships',oldCode);
                const targetRef = doc(db,'relationships',targetCode);

                await runTransaction(db, async transaction => {
                    const [oldSnap, targetSnap] = await Promise.all([
                        transaction.get(oldRef),
                        transaction.get(targetRef)
                    ]);

                    if (!targetSnap.exists()) {
                        throw new Error('TARGET_NOT_FOUND');
                    }

                    const targetData = targetSnap.data() || {};
                    const targetUsers = targetData.users || {};
                    const targetIds = Object.keys(targetUsers);

                    if (targetIds.length >= 2 && !targetUsers[currentUser.uid]) {
                        throw new Error('TARGET_FULL');
                    }

                    if (oldSnap.exists()) {
                        const freshOldUsers = oldSnap.data()?.users || {};
                        const otherUsers = Object.keys(freshOldUsers).filter(uid => uid !== currentUser.uid);

                        if (otherUsers.length) {
                            throw new Error('CURRENT_HAS_PARTNER');
                        }
                    }

                    if (!targetUsers[currentUser.uid]) {
                        transaction.update(targetRef, {
                            [`users.${currentUser.uid}`]: {
                                name: myOldData.name || currentUser.displayName || 'Eu',
                                photoUrl: myOldData.photoUrl || currentUser.photoURL || '',
                                character: myOldData.character || defaultCharacter(),
                                checkedInToday: false,
                                lastCheckInDate: '',
                                typing: false,
                                lastSeen: Date.now(),
                                coins: Number(myOldData.coins ?? 50),
                                xp: Number(myOldData.xp ?? 0)
                            },
                            'streak.status': 'waiting'
                        });
                    }

                    if (oldSnap.exists()) {
                        transaction.delete(oldRef);
                    }
                });

                // Encerra listeners do Elo antigo antes de mudar o código local.
                if (unsubscribeSnapshot) {
                    unsubscribeSnapshot();
                    unsubscribeSnapshot = null;
                }
                if (unsubscribeMoments) {
                    unsubscribeMoments();
                    unsubscribeMoments = null;
                }
                if (unsubscribeNotifications) {
                    unsubscribeNotifications();
                    unsubscribeNotifications = null;
                }
                if (unsubscribeSocialChat) {
                    unsubscribeSocialChat();
                    unsubscribeSocialChat = null;
                }
                socialView = 'list';
                socialChatFriendId = '';
                socialChatMessages = [];
                socialChatReady = false;

                coupleId = targetCode;
                coupleData = null;
                resetMomentsPagination();
                localStorage.setItem('elo_coupleId', targetCode);

                await saveUserProfile(
                    currentUser.uid,
                    targetCode,
                    myOldData.name || currentUser.displayName || 'Eu'
                );

                closeGenericModal();
                setupSync();
                showToast('Vocês agora estão no mesmo Elo! ❤️', 'success');
            } catch (err) {
                console.error('Troca de Elo:', err);

                if (err?.message === 'TARGET_NOT_FOUND') {
                    showToast('Não encontramos um Elo com esse código.', 'error');
                } else if (err?.message === 'TARGET_FULL') {
                    showToast('Esse Elo já possui duas pessoas.', 'error');
                } else if (err?.message === 'CURRENT_HAS_PARTNER') {
                    showToast('Seu Elo atual já possui um parceiro e não pode ser trocado automaticamente.', 'error');
                } else {
                    showToast('Não foi possível trocar de Elo agora. Tente novamente.', 'error');
                }
            } finally {
                if (loading) loading.classList.add('hidden');
            }
        };

        window.copyEloCode = async () => {
            if (!coupleId) return;
            try { await navigator.clipboard.writeText(coupleId); showToast('Código do Elo copiado!', 'success'); }
            catch { showToast(`Seu código é ${coupleId}`, 'info'); }
        };
        window.shareElo = async () => {
            if (!coupleId) return;
            const myName = coupleData?.users?.[currentUser.uid]?.name || 'seu amor';
            const inviteUrl = getInviteUrl(coupleId);
            const text = `💕 ${myName} te convidou para entrar no Elo!\n\nCódigo do Elo: ${coupleId}\n\nAbra o Elo, entre com sua conta Google e digite esse código de 4 dígitos. Não precisa abrir o link. ❤️\n\nSe preferir, link direto:\n${inviteUrl}`;
            try {
                if (navigator.share) await navigator.share({ title: 'Convite para o Elo ❤️', text, url: inviteUrl });
                else { await navigator.clipboard.writeText(text); showToast('Link de convite copiado!', 'success'); }
            } catch (err) { if (err?.name !== 'AbortError') showToast('Não foi possível compartilhar agora.', 'error'); }
        };

        window.copyInviteLink = async () => {
            if (!coupleId) return;
            const url = getInviteUrl(coupleId);
            try { await navigator.clipboard.writeText(url); showToast('Link direto copiado!', 'success'); }
            catch { showToast(url, 'info'); }
        };

        const getRelationshipStartDate = data => {
            const raw = data?.relationshipStartDate;
            if (!raw) return null;
            const d = new Date(`${raw}T00:00:00`);
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const getRelationshipDays = data => {
            const start = getRelationshipStartDate(data);
            if (!start) return null;
            const today = new Date(); today.setHours(0,0,0,0);
            return Math.max(0, Math.floor((today - start) / 86400000));
        };
        const relationshipDurationText = data => {
            const days = getRelationshipDays(data);
            if (days === null) return 'Definam quando o relacionamento começou';
            if (days === 0) return 'Começou hoje ❤️';
            return `${days.toLocaleString('pt-BR')} ${days===1?'dia':'dias'} juntos`;
        };
        window.openRelationshipDateModal = () => {
            const current = coupleData?.relationshipStartDate || '';
            openGenericModal(`<div class="space-y-4"><div class="flex justify-between items-start"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">❤️ Nossa data</p><h3 class="text-xl font-black text-white">Início do relacionamento</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><p class="text-xs text-slate-400">Essa data será usada para calcular os dias juntos, aniversários, retrospectivas e conquistas. Ela não depende da data em que vocês criaram o Elo.</p><input id="relationship-start-date" type="date" max="${new Date().toISOString().slice(0,10)}" value="${current}" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"><button onclick="saveRelationshipStartDate()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Salvar nossa data</button></div>`);
        };
        window.saveRelationshipStartDate = async () => {
            const value=document.getElementById('relationship-start-date')?.value;
            if(!value) return showToast('Escolha uma data.','error');
            if(new Date(`${value}T00:00:00`) > new Date()) return showToast('A data não pode estar no futuro.','error');
            const persist=async()=>{try{await updateDoc(doc(db,'relationships',coupleId),{relationshipStartDate:value,relationshipStartDateUpdatedAt:Date.now()});closeGenericModal();showToast('Data do relacionamento salva! ❤️','success');}catch(e){console.error(e);showToast('Não foi possível salvar a data.','error');}};
            const changing=!!coupleData?.relationshipStartDate && coupleData.relationshipStartDate!==value;
            if(changing) return openEloConfirm({title:'Alterar a data do relacionamento?',message:'Isso recalcula os dias juntos, marcos e retrospectivas do Elo.',confirmLabel:'Alterar data',onConfirm:persist});
            await persist();
        };

        const MOODS=[['amazing','🥰','Apaixonado(a)'],['happy','😊','Bem'],['calm','😌','Tranquilo(a)'],['low','😔','Pra baixo'],['angry','😤','Estressado(a)'],['talk','💬','Quero conversar']];
        window.openMoodCheckin=()=>{
            const today=new Date().toISOString().slice(0,10); const mine=coupleData?.moodCheckins?.[currentUser.uid];
            openGenericModal(`<div class="space-y-4"><div class="flex justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">😊 Check-in</p><h3 class="text-xl font-black text-white">Como você está hoje?</h3></div><button onclick="closeGenericModal()">✕</button></div><div class="grid grid-cols-2 gap-2">${MOODS.map(m=>`<button onclick="saveMood('${m[0]}')" class="p-4 rounded-2xl border ${mine?.date===today&&mine?.mood===m[0]?'border-pink-500 bg-pink-500/15':'border-slate-800 bg-slate-900'} text-left"><div class="text-2xl">${m[1]}</div><p class="text-xs font-black text-white mt-1">${m[2]}</p></button>`).join('')}</div><p class="text-[10px] text-slate-500">Seu par poderá ver apenas o humor escolhido para hoje.</p></div>`);
        };
        window.saveMood=async mood=>{const item=MOODS.find(m=>m[0]===mood);if(!item)return;try{await updateDoc(doc(db,'relationships',coupleId),{[`moodCheckins.${currentUser.uid}`]:{mood,date:new Date().toISOString().slice(0,10),updatedAt:Date.now()}});closeGenericModal();showToast('Humor compartilhado ❤️','success');}catch(e){showToast('Não foi possível salvar.','error')}};

        window.openCapsulesModal=async()=>{try{const snap=await getDocs(query(collection(db,'relationships',coupleId,'capsules'),orderBy('openAt','asc')));const now=Date.now();const caps=snap.docs.map(d=>({id:d.id,...d.data()}));openGenericModal(`<div class="space-y-4"><div class="flex justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">💌 Surpresas</p><h3 class="text-xl font-black text-white">Cápsula do Tempo</h3></div><button onclick="closeGenericModal()">✕</button></div><button onclick="openCreateCapsule()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Criar cápsula</button><div class="space-y-2">${caps.map(c=>{const locked=now<Number(c.openAt||0);return `<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><div class="flex justify-between gap-3"><div><p class="text-sm font-black text-white">${locked?'🔒 Cápsula fechada':'💌 '+escapeHTML(c.title||'Para nós')}</p><p class="text-[10px] text-slate-500 mt-1">${locked?'Abre em '+new Date(c.openAt).toLocaleDateString('pt-BR'):new Date(c.openAt).toLocaleDateString('pt-BR')}</p></div>${locked?'':`<button onclick="openCapsule('${c.id}')" class="text-pink-400 font-black text-xs">Abrir</button>`}</div></div>`}).join('')||'<p class="text-sm text-slate-500 text-center py-6">Nenhuma cápsula ainda.</p>'}</div></div>`)}catch(e){console.error(e);showToast('Não foi possível carregar as cápsulas.','error')}};
        window.openCreateCapsule=()=>openGenericModal(`<div class="space-y-4"><div class="flex justify-between"><h3 class="text-xl font-black text-white">Nova cápsula 💌</h3><button onclick="closeGenericModal()">✕</button></div><input id="caps-title" maxlength="50" placeholder="Título" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white"><textarea id="caps-message" maxlength="1500" placeholder="Escreva algo para o futuro..." class="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-white"></textarea><input id="caps-date" type="date" min="${new Date(Date.now()+86400000).toISOString().slice(0,10)}" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white"><button onclick="createCapsule()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Selar cápsula</button></div>`);
        window.createCapsule=async()=>{const title=document.getElementById('caps-title')?.value.trim()||'Para nós';const message=document.getElementById('caps-message')?.value.trim();const date=document.getElementById('caps-date')?.value;if(!message||!date)return showToast('Escreva a mensagem e escolha a data.','error');const openAt=new Date(`${date}T00:00:00`).getTime();if(openAt<=Date.now())return showToast('Escolha uma data futura.','error');try{await addDoc(collection(db,'relationships',coupleId,'capsules'),{title,message,openAt,createdAt:Date.now(),createdBy:currentUser.uid});showToast('Cápsula selada! 🔒','success');openCapsulesModal()}catch(e){showToast('Não foi possível criar a cápsula.','error')}};
        window.openCapsule=async id=>{try{const snap=await getDoc(doc(db,'relationships',coupleId,'capsules',id));if(!snap.exists())return;const c=snap.data();if(Date.now()<Number(c.openAt||0))return showToast('Essa cápsula ainda está fechada.','info');openGenericModal(`<div class="space-y-4 text-center"><div class="text-5xl">💌</div><h3 class="text-2xl font-black text-white">${escapeHTML(c.title||'Para nós')}</h3><div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left text-sm text-slate-200 whitespace-pre-wrap">${escapeHTML(c.message||'')}</div><p class="text-[10px] text-slate-500">Selada em ${new Date(c.createdAt).toLocaleDateString('pt-BR')}</p><button onclick="closeGenericModal()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Fechar</button></div>`)}catch(e){showToast('Não foi possível abrir.','error')}};

        window.openWeeklyRecap=async()=>{
            const since=Date.now()-7*86400000;
            const msgs=chatMessages.filter(m=>(m.timestamp||0)>=since).length;
            const completedTotal=countCompletedQuests(coupleData);
            const qAnswers=coupleData?.dailyQuestion?.answers?Object.keys(coupleData.dailyQuestion.answers).length:0;

            let moments=0;
            try{
                const snap=await getDocs(query(
                    collection(db,'relationships',coupleId,'moments'),
                    where('timestamp','>=',since)
                ));
                moments=snap.size;
            }catch(_){
                moments=(coupleData?.moments||[]).filter(m=>(m.timestamp||0)>=since).length;
            }

            openGenericModal(`<div class="space-y-4"><div class="flex justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">📊 Resumo</p><h3 class="text-xl font-black text-white">Nosso Elo agora</h3></div><button onclick="closeGenericModal()">✕</button></div><p class="text-xs text-slate-400">Sem histórico permanente: mostramos somente dados atuais e conteúdo recente que já existe nas próprias funcionalidades.</p><div class="grid grid-cols-2 gap-2"><div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p class="text-2xl font-black text-white">${msgs}</p><p class="text-[10px] text-slate-500">mensagens recentes carregadas</p></div><div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p class="text-2xl font-black text-white">${moments}</p><p class="text-[10px] text-slate-500">momentos nos últimos 7 dias</p></div><div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p class="text-2xl font-black text-white">${completedTotal}</p><p class="text-[10px] text-slate-500">missões aprovadas no total</p></div><div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p class="text-2xl font-black text-white">${coupleData?.quickStats?.matches||0}</p><p class="text-[10px] text-slate-500">combinações no jogo</p></div></div>${qAnswers?`<p class="text-xs text-slate-400">Pergunta atual: ${qAnswers}/2 respostas registradas.</p>`:''}</div>`);
        };

        const runEloIdle = (fn, timeout = 900) => {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(()=>fn(),{timeout});
            } else {
                setTimeout(fn,0);
            }
        };

        const ACHIEVEMENTS = [
            ['first_message','Primeira Conversa','Envie sua primeira mensagem.','chat'],
            ['first_moment','Primeira Memória','Registre seu primeiro momento.','camera'],
            ['streak_7','7 Dias de Chama','Mantenha a chama por 7 dias.','fire'],
            ['streak_30','30 Dias de Chama','Mantenha a chama por 30 dias.','fire'],
            ['quests_10','Românticos','Concluam 10 missões.','target'],
            ['synergy_80','Conexão','Alcancem 80 de Sinergia.','heart'],
            ['coins_1000','Primeiros 1.000','Acumule 1.000 Elo Coins.','coin']
        ];
        const getAchievements = data => data?.achievements || {};
        const countCompletedQuests = data => Object.values(data?.quests||{}).filter(v=>v==='completed').length;
        window.unlockAchievement = async id => { if(!coupleData || coupleData.achievements?.[id]) return; try { await updateDoc(doc(db,'relationships',coupleId),{[`achievements.${id}`]:Date.now()}); showToast('🏆 Conquista desbloqueada!','reward'); }catch(e){} };
        const evaluateAchievements = async data => {
            const a=getAchievements(data); const streak=getStreakData(data).current||0; const synergy=Number(data?.stats?.synergy||0); const coins=getUserCoins(data,currentUser?.uid); const quests=countCompletedQuests(data); const msgs=chatMessages.length;
            const checks={first_message:msgs>0,first_moment:(data?.moments||[]).length>0,streak_7:streak>=7,streak_30:streak>=30,quests_10:quests>=10,synergy_80:synergy>=80,coins_1000:coins>=1000};
            for(const [id,ok] of Object.entries(checks)) if(ok&&!a[id]) await unlockAchievement(id);
        };
        window.openActivityModal = () => {
            const achievements=getAchievements(coupleData);
            const unlocked=ACHIEVEMENTS.filter(a=>achievements[a[0]]).length;
            const html=`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🏆 Progresso</p><h3 class="text-xl font-black text-white">Conquistas</h3><p class="text-[10px] text-slate-500 mt-1">${unlocked} de ${ACHIEVEMENTS.length} desbloqueadas</p></div><button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-400"><i class="ph-bold ph-x"></i></button></div><button onclick="openNotificationCenter()" class="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-left flex items-center justify-between"><div><p class="text-xs font-black text-white">🔔 Notificações</p><p class="text-[9px] text-slate-500 mt-1">Veja avisos recentes do Elo</p></div><i class="ph-bold ph-caret-right text-slate-500"></i></button><div class="grid grid-cols-2 gap-2">${ACHIEVEMENTS.map(a=>`<div class="rounded-2xl p-3 border ${achievements[a[0]]?'border-yellow-500/30 bg-yellow-500/10':'border-slate-800 bg-slate-900'}"><div class="text-xl">${achievements[a[0]]?'🏆':'🔒'}</div><p class="text-xs font-black text-white mt-1">${a[1]}</p><p class="text-[9px] text-slate-500 mt-1">${a[2]}</p></div>`).join('')}</div></div>`;
            openGenericModal(html);
        };
        window.openGenericModal = html => { let m=document.getElementById('generic-modal'); if(!m){m=document.createElement('div');m.id='generic-modal';m.className='elo-modal-backdrop fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center sm:p-4';m.addEventListener('click',e=>{if(e.target===m)closeGenericModal();});document.body.appendChild(m);} delete m.dataset.eloModal; m.innerHTML=`<div class="elo-bottom-sheet w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-t-[2rem] sm:rounded-3xl p-5 shadow-2xl">${html}</div>`; };
        window.closeGenericModal=()=>document.getElementById('generic-modal')?.remove();
        document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('generic-modal'))closeGenericModal();});
        const QUESTIONS=['Qual foi o momento em que você percebeu que estava apaixonado?','Qual viagem você gostaria de fazer comigo?','Qual é meu prato favorito?','Quem sobreviveria mais tempo em uma ilha deserta?','Qual carinho você mais gosta de receber?','Qual sonho você quer realizar comigo?','Qual música lembra nosso relacionamento?','Qual foi nosso encontro mais inesquecível?'];
        window.openDailyQuestion=()=>{ const idx=Math.floor(Date.now()/86400000)%QUESTIONS.length; const q=QUESTIONS[idx]; const date=new Date().toISOString().slice(0,10); const dq=coupleData?.dailyQuestion?.date===date?coupleData.dailyQuestion:null; const answers=dq?.answers||{}; const mine=answers[currentUser.uid]; const ids=Object.keys(coupleData?.users||{}); const partnerUid=ids.find(id=>id!==currentUser.uid); const other=partnerUid?answers[partnerUid]:null; const both=!!mine&&!!other; openGenericModal(`<div class="space-y-4"><button onclick="closeGenericModal()" class="float-right text-slate-500">✕</button><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">💭 Pergunta do casal</p><h3 class="text-2xl font-black text-white">${escapeHTML(q)}</h3>${mine?`<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4"><p class="text-[9px] text-slate-500 uppercase font-black">Sua resposta</p><p class="text-sm text-white mt-1">${escapeHTML(mine)}</p></div>${both?`<div class="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4"><p class="text-[9px] text-pink-400 uppercase font-black">Resposta do seu amor</p><p class="text-sm text-white mt-1">${escapeHTML(other)}</p></div>`:'<p class="text-xs text-slate-400 text-center">🔒 A resposta do seu amor será revelada quando os dois responderem.</p>'}`:`<textarea id="daily-answer" class="w-full h-28 bg-slate-900 border border-slate-800 rounded-2xl p-3 text-white text-sm" placeholder="Escreva sua resposta..."></textarea><button onclick="saveDailyAnswer('${encodeURIComponent(q)}')" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Salvar resposta</button>`}</div>`); };
        window.saveDailyAnswer=async encoded=>{const answer=document.getElementById('daily-answer')?.value.trim();if(!answer)return;const date=new Date().toISOString().slice(0,10);const question=decodeURIComponent(encoded);try{const payload=coupleData?.dailyQuestion?.date===date?{[`dailyQuestion.answers.${currentUser.uid}`]:answer,'dailyQuestion.question':question}:{dailyQuestion:{date,question,answers:{[currentUser.uid]:answer}}};await updateDoc(doc(db,'relationships',coupleId),payload);closeGenericModal();showToast('Resposta salva! ❤️','success');}catch(e){showToast('Não foi possível salvar.','error')}};
        const QUICK_GAME_MODES={
            either:{title:'Isso ou Aquilo',subtitle:'Escolham uma opção',rounds:[['Praia 🏖️','Montanha 🏔️'],['Pizza 🍕','Hambúrguer 🍔'],['Filme 🎬','Série 📺'],['Viagem ✈️','Ficar em casa 🏠'],['Abraço 🤗','Beijo 💋'],['Planejar 📋','Improvisar 🎲']]},
            likely:{title:'Quem é mais provável?',subtitle:'Quem combina mais com a frase?',rounds:[['Você','Seu amor','esquecer onde colocou o celular?'],['Você','Seu amor','planejar uma viagem surpresa?'],['Você','Seu amor','rir no momento errado?'],['Você','Seu amor','dormir durante um filme?']]},
            know:{title:'Você me conhece?',subtitle:'Tentem combinar a resposta',rounds:[['Doce 🍫','Salgado 🍟'],['Manhã ☀️','Noite 🌙'],['Sair 🎉','Ficar em casa 🏠'],['Presente 🎁','Experiência ✈️']]}
        };
        const quickGameRef=()=>doc(db,'relationships',coupleId);
        const quickGameNames = () => { const ids=Object.keys(coupleData?.users||{}); const partnerUid=ids.find(id=>id!==currentUser?.uid); return {myUid:currentUser?.uid,myName:getProfileName(currentUser?.uid),partnerUid,partnerName:partnerUid?getProfileName(partnerUid):'Seu amor'}; };
        const quickGameResolvedOptions = game => {
            const mode=QUICK_GAME_MODES[game?.mode]||QUICK_GAME_MODES.either;
            const raw=game?.options||mode.rounds[0].slice(0,2);
            if(game?.mode!=='likely')return raw;
            if(Array.isArray(game.optionUserIds)&&game.optionUserIds.length===2)return game.optionUserIds.map(uid=>getProfileName(uid));
            // Compatibilidade com rodadas antigas: "Você" era quem criou a rodada.
            const creator=game?.createdBy||currentUser?.uid; const ids=Object.keys(coupleData?.users||{}); const other=ids.find(id=>id!==creator);
            return [getProfileName(creator),other?getProfileName(other):'Seu amor'];
        };
        const quickGameHtml=game=>{
            const choices=game?.choices||{}; const myChoice=choices[currentUser?.uid]; const names=quickGameNames();
            const partnerChoice=names.partnerUid?choices[names.partnerUid]:undefined; const both=myChoice!==undefined&&partnerChoice!==undefined; const same=both&&myChoice===partnerChoice;
            const mode=QUICK_GAME_MODES[game?.mode]||QUICK_GAME_MODES.either; const opts=quickGameResolvedOptions(game);
            return `<div id="quick-game-content" class="text-center space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🎲 Jogo rápido</p><h3 class="text-2xl font-black text-white">${mode.title}</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div>${game?.prompt?`<p class="text-sm font-black text-white">${escapeHTML(game.prompt)}</p>`:`<p class="text-sm text-slate-300">${mode.subtitle}</p>`}<div class="grid grid-cols-2 gap-3">${opts.map((o,i)=>`<button ${myChoice!==undefined?'disabled':''} onclick="chooseCoupleGame(${i})" class="p-4 rounded-2xl border ${myChoice===i?'border-pink-500 bg-pink-500/20':'border-slate-800 bg-slate-900'} text-white font-black text-sm disabled:opacity-100">${escapeHTML(o)}</button>`).join('')}</div>${myChoice!==undefined?`<p class="text-xs text-slate-400">Resposta de ${escapeHTML(names.myName)} registrada. ${partnerChoice!==undefined?`${escapeHTML(names.partnerName)} já respondeu!`:`Aguardando ${escapeHTML(names.partnerName)}…`}</p>`:'<p class="text-xs text-slate-500">Cada um responde no próprio celular.</p>'}${both?`<div class="rounded-2xl p-4 ${same?'bg-pink-500/10 border-pink-500/30':'bg-slate-900 border-slate-800'} border"><div class="text-3xl mb-2">${same?'💖':'😄'}</div><p class="font-black text-white">${same?'Vocês combinaram!':'Respostas diferentes desta vez.'}</p><p class="text-xs text-slate-400 mt-1">${escapeHTML(names.myName)}: ${escapeHTML(opts[myChoice])} · ${escapeHTML(names.partnerName)}: ${escapeHTML(opts[partnerChoice])}</p></div><button onclick="newCoupleGame('${game.mode||'either'}')" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Outra rodada</button>`:''}</div>`;
        };
        const renderCoupleGameModal=()=>{if(document.getElementById('quick-game-content')&&coupleData?.quickGame)document.getElementById('quick-game-content').outerHTML=quickGameHtml(coupleData.quickGame)};
        window.openCoupleGame=()=>{const game=coupleData?.quickGame;if(game)return openGenericModal(quickGameHtml(game));openGenericModal(`<div class="space-y-4"><div class="flex justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🎮 Escolha um modo</p><h3 class="text-xl font-black text-white">Jogo Rápido</h3></div><button onclick="closeGenericModal()">✕</button></div>${Object.entries(QUICK_GAME_MODES).map(([id,m])=>`<button onclick="newCoupleGame('${id}')" class="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left"><p class="font-black text-white">${m.title}</p><p class="text-xs text-slate-500 mt-1">${m.subtitle}</p></button>`).join('')}</div>`)};
        window.newCoupleGame=async(modeId='either')=>{
            if(quickGameCreating)return; quickGameCreating=true; const mode=QUICK_GAME_MODES[modeId]||QUICK_GAME_MODES.either; const round=mode.rounds[Math.floor(Math.random()*mode.rounds.length)];
            const names=quickGameNames(); const optionUserIds=modeId==='likely'?[currentUser.uid,names.partnerUid].filter(Boolean):null;
            const candidate={id:`${Date.now()}_${currentUser.uid}`,mode:modeId,options:round.slice(0,2),...(optionUserIds?.length===2?{optionUserIds}:{}),prompt:round[2]||'',choices:{},status:'open',createdAt:Date.now(),createdBy:currentUser.uid}; let selected=candidate;
            try{await runTransaction(db,async tx=>{const ref=quickGameRef();const snap=await tx.get(ref);if(!snap.exists())throw new Error('Elo não encontrado.');const existing=snap.data()?.quickGame;if(existing&&existing.status==='open'){selected=existing;return;}tx.update(ref,{quickGame:candidate});});coupleData={...coupleData,quickGame:selected};openGenericModal(quickGameHtml(selected));if(selected.id!==candidate.id)showToast(`${getProfileName(selected.createdBy)} já iniciou uma rodada. Você entrou na mesma pergunta ❤️`,'info')}catch(e){console.error(e);showToast('Não foi possível iniciar o jogo.','error')}finally{quickGameCreating=false}
        };
        window.chooseCoupleGame=async index=>{const localGame=coupleData?.quickGame;if(!localGame||localGame.status==='done'||localGame.choices?.[currentUser.uid]!==undefined)return;try{let next=null;await runTransaction(db,async tx=>{const ref=quickGameRef();const snap=await tx.get(ref);if(!snap.exists())throw new Error('Elo não encontrado.');const data=snap.data();const game=data.quickGame;if(!game||game.id!==localGame.id||game.status==='done')throw new Error('A rodada mudou. Abra o jogo novamente.');if(game.choices?.[currentUser.uid]!==undefined){next=game;return;}const ids=Object.keys(data.users||{});const partnerUid=ids.find(id=>id!==currentUser.uid);const partnerAnswered=!!partnerUid&&game.choices?.[partnerUid]!==undefined;const same=partnerAnswered&&game.choices?.[partnerUid]===index;const choices={...(game.choices||{}),[currentUser.uid]:index};next={...game,choices,status:partnerAnswered?'done':'open',...(partnerAnswered?{finishedAt:Date.now()}:{})};const updates={[`quickGame.choices.${currentUser.uid}`]:index};if(partnerAnswered){updates['quickGame.status']='done';updates['quickGame.finishedAt']=next.finishedAt;updates['quickStats.rounds']=increment(1);if(same)updates['quickStats.matches']=increment(1)}tx.update(ref,updates);});coupleData={...coupleData,quickGame:next};openGenericModal(quickGameHtml(next))}catch(e){console.error(e);showToast(e.message||'Não foi possível registrar sua escolha.','error')}};
        const updateNotificationDot=()=>{const dot=document.getElementById('notification-dot');const n=(window.eloNotifications||[]).filter(item=>!item.read).length;if(dot){dot.textContent=n>9?'9+':String(n);dot.classList.toggle('hidden',!n);dot.classList.toggle('flex',!!n);}};

        const mergeMoments = (...groups) => {
            const byId = new Map();
            groups.flat().filter(Boolean).forEach(moment => byId.set(moment.id,{...byId.get(moment.id),...moment}));
            return [...byId.values()].sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));
        };

        const resetMomentsPagination = () => {
            momentsCache = [];
            momentsLoadedCoupleId = '';
            momentsOldestCursor = null;
            momentsHasMore = true;
            momentsHistoryLoaded = false;
            momentsLoadingOlder = false;
        };

        const momentCardsHTML = () => {
            const loaded = momentsLoadedCoupleId === coupleId;
            const moments = momentsCache.slice().sort((a,b)=>Number(b.timestamp||0)-Number(a.timestamp||0));

            if (!moments.length) {
                return loaded
                    ? '<div class="col-span-2 text-center text-sm text-slate-500 py-8">Adicionem a primeira memória de vocês ❤️</div>'
                    : '<div class="col-span-2 flex flex-col items-center justify-center py-10 text-slate-500"><i class="ph-bold ph-spinner-gap animate-spin text-2xl text-pink-400"></i><p class="text-xs font-bold mt-3">Carregando seus momentos…</p></div>';
            }

            return moments.map(m=>`
                <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <img src="${escapeHTML(m.url)}" loading="lazy" decoding="async" class="w-full aspect-square object-cover" alt="Momento do casal">
                    <div class="p-2">
                        <p class="text-xs text-white font-bold">${escapeHTML(m.caption||'Momento de vocês ❤️')}</p>
                        <p class="text-[9px] text-slate-500 mt-1">${new Date(m.timestamp).toLocaleDateString('pt-BR')} · ${Math.round((m.bytes||0)/1024)} KB</p>
                        <div class="flex gap-1 mt-2">${['❤️','🥰','😂'].map(r=>`<button onclick="reactMoment('${m.id}','${r}')" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border ${m.reactions?.[currentUser.uid]===r?'border-pink-500':'border-slate-700'}">${r}</button>`).join('')}</div>
                    </div>
                </div>
            `).join('');
        };

        const renderMomentsGridOnly = () => {
            const modal = document.getElementById('generic-modal');
            if (modal?.dataset?.eloModal !== 'moments') return;

            const grid = document.getElementById('moments-grid');
            if (grid) grid.innerHTML = momentCardsHTML();

            const more = document.getElementById('moments-load-more');
            if (more) {
                more.classList.toggle('hidden', !momentsHasMore || !momentsCache.length);
                more.disabled = momentsLoadingOlder;
                more.innerHTML = momentsLoadingOlder
                    ? '<i class="ph-bold ph-spinner-gap animate-spin mr-1"></i>Carregando…'
                    : '<i class="ph-bold ph-images mr-1"></i>Carregar momentos antigos';
            }
        };

        const startMomentsSync = () => {
            if (!coupleId || unsubscribeMoments) return;

            const listenerCoupleId = coupleId;
            resetMomentsPagination();

            unsubscribeMoments = onSnapshot(
                query(
                    collection(db,'relationships',listenerCoupleId,'moments'),
                    orderBy('timestamp','desc'),
                    limit(MOMENTS_PAGE_SIZE)
                ),
                snap => {
                    if (listenerCoupleId !== coupleId) return;

                    const recent = snap.docs.map(d=>({id:d.id,...d.data()}));
                    momentsLoadedCoupleId = listenerCoupleId;
                    momentsCache = momentsHistoryLoaded
                        ? mergeMoments(momentsCache,recent)
                        : recent;

                    if (!momentsHistoryLoaded) {
                        momentsOldestCursor = snap.docs.length
                            ? snap.docs[snap.docs.length-1]
                            : null;
                        momentsHasMore = snap.docs.length === MOMENTS_PAGE_SIZE;
                    }

                    if (coupleData) coupleData = {...coupleData,moments:momentsCache};
                    renderMomentsGridOnly();
                },
                err => console.warn('Sincronização dos momentos:',err)
            );
        };

        window.loadOlderMoments = async () => {
            if (momentsLoadingOlder || !momentsHasMore || !momentsOldestCursor || !coupleId) return;

            momentsLoadingOlder = true;
            renderMomentsGridOnly();

            try {
                const snap = await getDocs(
                    query(
                        collection(db,'relationships',coupleId,'moments'),
                        orderBy('timestamp','desc'),
                        startAfter(momentsOldestCursor),
                        limit(MOMENTS_PAGE_SIZE)
                    )
                );

                const older = snap.docs.map(d=>({id:d.id,...d.data()}));
                momentsCache = mergeMoments(momentsCache,older);
                momentsHistoryLoaded = true;

                if (snap.docs.length) momentsOldestCursor = snap.docs[snap.docs.length-1];
                if (snap.docs.length < MOMENTS_PAGE_SIZE) momentsHasMore = false;

                if (coupleData) coupleData = {...coupleData,moments:momentsCache};
            } catch (e) {
                console.warn('Carregar momentos antigos:',e);
                showToast('Não foi possível carregar momentos antigos.','error');
            } finally {
                momentsLoadingOlder = false;
                renderMomentsGridOnly();
            }
        };

        window.openMomentsModal = () => {
            openGenericModal(`
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[10px] uppercase tracking-widest font-black text-pink-400">📸 Privado do casal</p>
                            <h3 class="text-xl font-black text-white">Nossos Momentos</h3>
                            <p class="text-[9px] text-slate-500 mt-1">A galeria agora carrega aos poucos para deixar o Elo mais leve.</p>
                        </div>
                        <button onclick="closeGenericModal()" class="text-slate-500">✕</button>
                    </div>

                    <label class="w-full flex items-center justify-center gap-2 bg-pink-600 text-white font-black py-3 rounded-xl cursor-pointer">
                        <i class="ph-bold ph-camera"></i> Adicionar momento
                        <input type="file" accept="image/*" class="hidden" onchange="addMoment(event)">
                    </label>

                    <div id="moments-grid" class="grid grid-cols-2 gap-2">${momentCardsHTML()}</div>
                    <button id="moments-load-more" onclick="loadOlderMoments()" class="${momentsHasMore&&momentsCache.length?'':'hidden'} w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-black py-3 rounded-xl">
                        <i class="ph-bold ph-images mr-1"></i>Carregar momentos antigos
                    </button>
                </div>
            `);

            const modal = document.getElementById('generic-modal');
            if (modal) modal.dataset.eloModal = 'moments';
        };
        window.reactMoment=async(id,reaction)=>{try{await updateDoc(doc(db,'relationships',coupleId,'moments',id),{[`reactions.${currentUser.uid}`]:reaction});showToast('Reação salva ❤️','success')}catch(e){showToast('Não foi possível reagir.','error')}};
        let pendingMomentUpload = null;
        window.addMoment = async e => {
            const file=e.target.files?.[0]; e.target.value='';
            if(!file||!coupleData)return;
            if(!file.type.startsWith('image/')) return showToast('Selecione uma imagem.','error');
            if(file.size>12*1024*1024)return showToast('A imagem original deve ter até 12 MB.','error');
            try{
                showToast('Preparando momento...','info');
                const dataUrl=await compressChatImage(file);
                pendingMomentUpload={dataUrl,bytes:dataUrlBytes(dataUrl)};
                openGenericModal(`<div class="space-y-4"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">📸 Novo momento</p><h3 class="text-xl font-black text-white">Como vocês vão lembrar disso?</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><img src="${dataUrl}" class="w-full max-h-64 object-cover rounded-2xl border border-slate-800" alt="Prévia do momento"><div><label class="text-[10px] uppercase tracking-widest font-black text-slate-500">Legenda opcional</label><input id="moment-caption-input" maxlength="160" value="Momento de vocês ❤️" class="mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500"></div><button onclick="confirmAddMoment()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Guardar momento ❤️</button></div>`);
            }catch(err){console.error(err);showToast('Não foi possível preparar o momento.','error');}
        };
        window.confirmAddMoment = async () => {
            if(!pendingMomentUpload)return showToast('Selecione a foto novamente.','error');
            const upload=pendingMomentUpload; const caption=(document.getElementById('moment-caption-input')?.value||'').trim()||'Momento de vocês ❤️';
            try{await addDoc(collection(db,'relationships',coupleId,'moments'),{url:upload.dataUrl,caption:caption.slice(0,160),timestamp:Date.now(),senderId:currentUser.uid,bytes:upload.bytes});pendingMomentUpload=null;closeGenericModal();showToast(`Momento salvo! ❤️ (${Math.round(upload.bytes/1024)} KB)`,'success');if(!coupleData?.achievements?.first_moment)runEloIdle(()=>unlockAchievement('first_moment'));}catch(err){console.error(err);showToast('Não foi possível salvar o momento.','error');}
        };
        const chatSearchResultHTML = term => {
            const q=String(term||'').trim().toLowerCase();
            if(!q)return '<div class="text-center py-8 text-slate-600 text-sm">Digite algo para pesquisar.</div>';
            const found=chatMessages.filter(m=>`${m.text||''} ${m.gift?.title||''} ${m.voucher?.title||''}`.toLowerCase().includes(q));
            return found.slice().sort((a,b)=>b.timestamp-a.timestamp).map(m=>`<div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><p class="text-[9px] uppercase tracking-widest font-black text-slate-500">${escapeHTML(getProfileName(m.senderId))}</p><p class="text-sm text-white mt-1">${escapeHTML(m.text||m.gift?.title||m.voucher?.title||'Mídia')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(m.timestamp).toLocaleString('pt-BR')}</p></div>`).join('')||'<p class="text-sm text-slate-500 py-8 text-center">Nenhuma mensagem carregada corresponde à pesquisa.</p>';
        };
        window.updateChatSearchResults = value => { const el=document.getElementById('chat-search-results'); if(el)el.innerHTML=chatSearchResultHTML(value); };
        window.searchChatMessages = () => {openGenericModal(`<div class="space-y-3"><div class="flex items-start justify-between gap-3"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🔎 Pesquisa</p><h3 class="font-black text-xl text-white">Pesquisar no Chat</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><div class="relative"><i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i><input id="chat-search-modal-input" oninput="updateChatSearchResults(this.value)" class="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-3 text-white outline-none focus:border-pink-500" placeholder="Mensagem, presente ou voucher..."></div><p class="text-[10px] text-slate-500">A pesquisa considera as mensagens já carregadas neste aparelho. Para incluir mensagens antigas, carregue o histórico antes.</p><div id="chat-search-results" class="space-y-2 max-h-[55vh] overflow-y-auto hide-scrollbar">${chatSearchResultHTML('')}</div></div>`);setTimeout(()=>document.getElementById('chat-search-modal-input')?.focus(),80);};
        window.pinChatMessage=async id=>{try{await updateDoc(messageDoc(id),{pinned:true});showToast('Mensagem fixada.','success')}catch(e){}};
        window.favoriteChatMessage=async id=>{try{const m=chatMessages.find(x=>x.id===id);const fav=!!m?.favorites?.[currentUser.uid];await updateDoc(messageDoc(id),{[`favorites.${currentUser.uid}`]:!fav});showToast(!fav?'Mensagem favoritada.':'Removida dos favoritos.','info')}catch(e){}};

        const updateUI = () => {
            document.body.dataset.eloTab = activeTab;
            if (!coupleData) return;
            const { stats = {}, users = {} } = coupleData;
            const myData = users[currentUser.uid] || { name: 'Eu', character: defaultCharacter(), checkedInToday: false };
            const streak = getStreakData(coupleData);
            const today = getGameDateKey();
            const myCheckedToday = myData.lastCheckInDate === today;
            const uids = Object.keys(users);
            const partnerUid = uids.find(id => id !== currentUser.uid);
            const partnerData = partnerUid ? users[partnerUid] : null;

            // Header Setup
            const hAvatar = document.getElementById('header-avatar');
            const hInitial = document.getElementById('header-initial');
            if (myData.photoUrl) {
                if (hAvatar.getAttribute('src') !== myData.photoUrl) hAvatar.src = myData.photoUrl;
                hAvatar.classList.remove('hidden');
                hInitial.classList.add('hidden');
            } else {
                hAvatar.classList.add('hidden');
                hInitial.classList.remove('hidden');
                const initial = myData.name.charAt(0).toUpperCase();
                if (hInitial.textContent !== initial) hInitial.textContent = initial;
            }

            const headerName=document.getElementById('header-name');
            const headerCoins=document.getElementById('header-coins');
            const headerStreak=document.getElementById('header-streak');
            const nextCoins=String(getSpendableCoins(coupleData,currentUser.uid));
            const nextStreak=String(streak.current||0);
            if(headerName?.textContent!==myData.name) headerName.textContent=myData.name;
            if(headerCoins?.textContent!==nextCoins) headerCoins.textContent=nextCoins;
            if(headerStreak?.textContent!==nextStreak) headerStreak.textContent=nextStreak;

            document.querySelectorAll('.nav-btn').forEach(b => {
                const active = b.id === `nav-${activeTab}`;
                b.classList.toggle('text-pink-400',active);
                b.classList.toggle('elo-nav-active',active);
                b.classList.toggle('text-slate-500',!active);
            });

            const main = document.getElementById('main-content');
            let html = '';

            if (activeTab === 'home') {
                const synergy = Math.min(100, Math.max(0, Number(stats.synergy ?? 50)));
                const levelInfo = getUserLevelInfo(coupleData, currentUser.uid);
                const todaysQuests = getDailyQuestsForUser(currentUser.uid);
                const completedTodayCount = todaysQuests.filter(q => coupleData.quests?.[`${q.instanceId}_${currentUser.uid}`] === 'completed').length;
                const nextQuest = todaysQuests.find(q => !coupleData.quests?.[`${q.instanceId}_${currentUser.uid}`]) || null;
                const nextMilestone = getNextMilestone(streak.current || 0);
                const streakProgress = Math.min(100, Math.max(0, ((streak.current || 0) / nextMilestone) * 100));
                const nextStreakReward = getNextStreakReward(streak.current || 0);
                const streakRemainingMs = getTimeUntilNextDay();
                const streakUrgent = streakRemainingMs <= 3*60*60*1000;
                const partnerCheckedToday = partnerData?.lastCheckInDate === today;
                const relationshipDays = getRelationshipDays(coupleData);
                const todayMood = coupleData?.moodCheckins?.[currentUser.uid]?.date===new Date().toISOString().slice(0,10)?coupleData.moodCheckins[currentUser.uid]:null;
                const partnerMood = partnerUid&&coupleData?.moodCheckins?.[partnerUid]?.date===new Date().toISOString().slice(0,10)?coupleData.moodCheckins[partnerUid]:null;
                const statusText = !partnerData
                    ? 'Conecte seu amor para começar a jornada.'
                    : streak.bothChecked
                        ? 'Vocês cuidaram do Elo hoje. ❤️'
                        : myCheckedToday
                            ? `${escapeHTML(partnerData.name)} ainda precisa fazer a parte de hoje.`
                            : 'Tem coisa boa esperando vocês hoje.';

                html = `
                    <div class="space-y-4 pb-4">

                        <!-- 1. IDENTIDADE DO CASAL / PERSONAGENS -->
                        <section class="elo-home-hero relative overflow-hidden rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 shadow-2xl">
                            <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-pink-500/10 blur-2xl"></div>
                            <div class="absolute -left-20 bottom-0 w-56 h-56 rounded-full bg-purple-500/10 blur-2xl"></div>
                            <div class="relative z-10 p-5">
                                <div class="flex items-start justify-between gap-4">
                                    <div>
                                        <p class="text-[10px] uppercase tracking-[0.25em] font-black text-pink-400">Nosso Elo</p>
                                        <h2 class="text-2xl font-black text-white mt-1">${escapeHTML(myData.name || 'Você')} <span class="text-pink-400">&</span> ${partnerData ? escapeHTML(partnerData.name) : 'seu amor'}</h2>
                                        <p class="text-xs text-slate-400 mt-1">${statusText}</p>
                                    </div>
                                    <button onclick="openCoupleModal()" class="elo-action-card shrink-0 w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 text-pink-400 flex items-center justify-center active:scale-95"><i class="ph-fill ph-heart"></i></button>
                                </div>

                                <div class="elo-couple-stage relative h-52 mt-5 rounded-3xl bg-gradient-to-t from-slate-950/90 via-slate-900/20 to-transparent overflow-hidden border border-white/5 flex items-end justify-between px-8 pb-4">
                                    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(236,72,153,0.12),transparent_45%)]"></div>
                                    <div class="relative z-10 w-24 h-36 flex flex-col items-center">
                                        <div class="w-full h-full transform scale-x-[-1] drop-shadow-2xl">${renderAvatar(myData.character, currentUser?.uid)}</div>
                                        <span class="bg-slate-950/90 px-2.5 py-1 rounded-full text-[10px] text-white font-black absolute -bottom-2 border border-slate-700 max-w-full truncate">${escapeHTML(myData.name || 'Você')}</span>
                                    </div>
                                    <div class="relative z-20 flex flex-col items-center justify-end h-full pb-6">
                                        <div class="w-14 h-14 rounded-full bg-slate-950/80 border border-pink-500/30 flex items-center justify-center shadow-xl">
                                            <i class="ph-fill ph-heart text-2xl text-pink-500 animate-pulse"></i>
                                        </div>
                                    </div>
                                    <div class="relative z-10 w-24 h-36 flex flex-col items-center">
                                        <div class="w-full h-full drop-shadow-2xl">${partnerData ? renderAvatar(partnerData.character, partnerUid) : '<i class="ph-fill ph-user-plus text-5xl text-slate-700 mt-10"></i>'}</div>
                                        <span class="bg-slate-950/90 px-2.5 py-1 rounded-full text-[10px] text-white font-black absolute -bottom-2 border border-slate-700 max-w-full truncate">${partnerData ? escapeHTML(partnerData.name) : 'Aguardando'}</span>
                                    </div>
                                    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                                        <i class="ph-fill ph-fire text-5xl ${streak.bothChecked ? 'text-orange-500 animate-fire' : streak.status === 'at_risk' ? 'text-amber-500 animate-fire' : 'text-slate-700'}"></i>
                                    </div>
                                </div>

                                <div class="grid grid-cols-3 gap-2 mt-4">
                                    <button onclick="openSynergyInfo()" class="elo-home-metric elo-action-card rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-left active:scale-[.98]"><p class="text-[8px] uppercase font-black text-slate-500">Sinergia</p><p class="text-lg font-black text-white mt-1">${synergy}<span class="text-[9px] text-slate-600">/100</span></p></button>
                                    <div class="elo-home-metric rounded-xl bg-slate-950/60 border border-slate-800 p-3"><p class="text-[8px] uppercase font-black text-slate-500">Coins</p><p class="text-lg font-black text-yellow-400 mt-1">${Number(getSpendableCoins(coupleData, currentUser.uid)).toLocaleString('pt-BR')}</p></div>
                                    <button onclick="openProfileModal()" class="elo-home-metric elo-action-card rounded-xl bg-slate-950/60 border border-purple-500/20 p-3 text-left active:scale-[.98]"><p class="text-[8px] uppercase font-black text-slate-500">Nível</p><p class="text-lg font-black text-white mt-1">${levelInfo.level}</p><p class="text-[8px] text-purple-300 truncate">${levelInfo.title}</p></button>
                                </div>
                            </div>
                        </section>

                        <!-- 2. HOJE NO ELO -->
                        <section class="rounded-[2rem] border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-slate-900 to-purple-500/10 p-5 shadow-xl">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-[10px] uppercase tracking-[0.24em] font-black text-pink-400">Hoje no Elo</p>
                                    <h3 class="text-lg font-black text-white mt-1">O que importa agora</h3>
                                </div>
                                <span class="text-[10px] font-black text-purple-300">Nível ${levelInfo.level}</span>
                            </div>
                            <div class="mt-3 h-2 bg-slate-950/80 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-full" style="width:${levelInfo.progress}%"></div></div>
                            <div class="flex justify-between mt-1 text-[9px] font-bold text-slate-500"><span>${levelInfo.xp.toLocaleString('pt-BR')} XP</span><span>${levelInfo.next ? `${levelInfo.remaining} XP para o próximo nível` : 'Nível máximo'}</span></div>

                            <div class="grid grid-cols-2 gap-2 mt-4">
                                <button onclick="switchTab('quests')" class="elo-action-card rounded-2xl bg-slate-950/70 border border-slate-800 p-3 text-left active:scale-[.98]">
                                    <p class="text-[9px] uppercase font-black text-orange-400">Missões</p>
                                    <p class="font-black text-white text-sm mt-1">${completedTodayCount}/4 concluídas</p>
                                    <p class="text-[9px] text-slate-500 truncate">${nextQuest ? escapeHTML(nextQuest.title) : 'Tudo feito por hoje ✨'}</p>
                                </button>
                                <button onclick="switchTab('chat')" class="elo-action-card rounded-2xl bg-slate-950/70 border border-slate-800 p-3 text-left active:scale-[.98]">
                                    <p class="text-[9px] uppercase font-black text-cyan-400">Chat</p>
                                    <p class="font-black text-white text-sm mt-1">${chatUnreadCount ? `${chatUnreadCount} ${chatUnreadCount===1?'mensagem nova':'mensagens novas'}` : 'Conversar agora 💬'}</p>
                                    <p class="text-[9px] text-slate-500">${partnerData ? `Falar com ${escapeHTML(partnerData.name)}` : 'Seu espaço de conversa'}</p>
                                </button>
                            </div>
                        </section>

                        <!-- 3. CHAMA -->
                        ${partnerData ? `
                        <section id="elo-streak-card" class="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
                            <div class="flex items-center justify-between gap-3 mb-4">
                                <div><p class="text-[10px] uppercase tracking-[0.2em] font-black text-orange-400">Chama do casal</p><h3 class="text-3xl font-black text-white flex items-center gap-2 mt-1"><i class="ph-fill ph-fire text-orange-500"></i>${streak.current || 0}<span class="text-sm text-slate-500 mt-2">dias</span></h3></div>
                                <div class="text-right"><p class="text-[9px] uppercase font-black text-slate-500">Recorde</p><p class="text-lg font-black text-pink-400">${streak.longest || 0}</p></div>
                            </div>
                            <div class="elo-streak-countdown ${streakUrgent && !streak.bothChecked ? 'urgent' : ''}">
                                <div><p class="text-[9px] uppercase tracking-widest font-black text-slate-500">${streak.bothChecked ? 'Status de hoje' : 'Tempo para manter a chama'}</p><p class="text-[10px] text-slate-400 mt-0.5">${streak.bothChecked ? 'Os dois fizeram a parte de hoje ❤️' : 'Os dois precisam concluir antes da virada do dia.'}</p></div>
                                <strong id="home-streak-countdown">${streak.bothChecked ? 'SEGURA 🔥' : formatDailyQuestCountdown(streakRemainingMs)}</strong>
                            </div>
                            <div class="h-2 bg-slate-800 rounded-full overflow-hidden mb-2"><div class="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 rounded-full" style="width:${streakProgress}%"></div></div>
                            <div class="elo-streak-milestone mb-4"><span>Agora: ${streak.current || 0} dias</span><span>${nextStreakReward ? `Próximo prêmio: ${nextStreakReward.days} dias · +${nextStreakReward.reward} Coins` : 'Todos os marcos principais alcançados 🏆'}</span></div>
                            <div class="grid grid-cols-2 gap-2 mb-4">
                                <div class="bg-slate-950 rounded-xl p-3 border border-slate-800"><p class="text-[9px] uppercase font-black text-slate-500">${escapeHTML(myData.name || 'Você')}</p><p class="text-sm font-black ${myCheckedToday ? 'text-emerald-400' : 'text-amber-400'}">${myCheckedToday ? '✓ Fez hoje' : '○ Falta fazer'}</p></div>
                                <div class="bg-slate-950 rounded-xl p-3 border border-slate-800"><p class="text-[9px] uppercase font-black text-slate-500">${escapeHTML(partnerData.name)}</p><p class="text-sm font-black ${partnerCheckedToday ? 'text-emerald-400' : 'text-slate-400'}">${partnerCheckedToday ? '✓ Fez hoje' : '○ Ainda não'}</p></div>
                            </div>
                            ${!myCheckedToday ? `<button onclick="checkInToday(this)" class="elo-action-card streak-checkin-btn w-full bg-gradient-to-r from-orange-500 to-pink-600 text-white font-black py-3.5 rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2"><i class="ph-fill ph-fire text-xl"></i> Manter a Chama Hoje</button>` : `<div class="w-full ${streak.bothChecked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-300'} border font-bold py-3.5 rounded-xl text-center text-sm">${streak.bothChecked ? '🔥 Chama mantida!' : '❤️ Sua parte está feita. Aguardando seu amor.'}</div>`}
                        </section>
                        ` : `
                        <section class="bg-gradient-to-br from-indigo-900/80 to-slate-900 rounded-3xl p-5 border border-indigo-500/30">
                            <h3 class="font-black text-white">Seu Elo está esperando</h3><p class="text-xs text-indigo-200/80 mt-1">Compartilhe o código para seu amor entrar.</p>
                            <button onclick="openCoupleModal()" class="elo-action-card w-full mt-4 bg-indigo-600 text-white font-black py-3 rounded-xl active:scale-95">Ver código do Elo</button>
                        </section>`}

                        <!-- 4. ÚNICO HUB DE JOGOS -->
                        <section class="space-y-2">
                            <div class="elo-home-section-title flex items-center justify-between px-1">
                                <div><p class="text-[10px] uppercase tracking-[0.2em] font-black text-purple-400">Juntos</p><h3 class="font-black text-white">Jogos & momentos</h3></div>
                                <span class="text-[9px] text-slate-500">Tudo em um lugar</span>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="openCoupleGame()" class="elo-action-card bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left active:scale-[.98]"><span class="text-xl">🎮</span><p class="font-black text-white text-sm mt-2">Jogo rápido</p><p class="text-[9px] text-slate-500">Descubram se pensam igual</p></button>
                                <button onclick="openDailyQuestion()" class="elo-action-card bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left active:scale-[.98]"><span class="text-xl">💭</span><p class="font-black text-white text-sm mt-2">Pergunta do dia</p><p class="text-[9px] text-slate-500">Respostas reveladas juntos</p></button>
                                <button onclick="openMoodCheckin()" class="elo-action-card bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left active:scale-[.98]"><span class="text-xl">${todayMood?MOODS.find(m=>m[0]===todayMood.mood)?.[1]||'😊':'😊'}</span><p class="font-black text-white text-sm mt-2">Como estou</p><p class="text-[9px] text-slate-500">${partnerMood?'Seu amor também respondeu':'Check-in de humor'}</p></button>
                                <button onclick="openMomentsModal()" class="elo-action-card bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left active:scale-[.98]"><span class="text-xl">📸</span><p class="font-black text-white text-sm mt-2">Nossos momentos</p><p class="text-[9px] text-slate-500">Fotos e lembranças</p></button>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="openCapsulesModal()" class="elo-action-card bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-3 text-left active:scale-[.98]"><p class="text-xs font-black text-white">💌 Cápsula do tempo</p><p class="text-[9px] text-slate-500 mt-1">Mensagens para o futuro</p></button>
                                <button onclick="openWeeklyRecap()" class="elo-action-card bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-3 text-left active:scale-[.98]"><p class="text-xs font-black text-white">📊 Resumo do Elo</p><p class="text-[9px] text-slate-500 mt-1">Dados atuais e recentes</p></button>
                            </div>
                        </section>

                        <!-- 5. HISTÓRIA / SECUNDÁRIOS -->
                        <button onclick="openRelationshipDateModal()" class="elo-action-card w-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-4 flex items-center justify-between text-left">
                            <div><p class="text-[9px] uppercase tracking-widest font-black text-pink-400">Nossa história</p><p class="text-lg font-black text-white mt-1">${relationshipDays===null?'Quando tudo começou ❤️':`${relationshipDays.toLocaleString('pt-BR')} dias juntos`}</p><p class="text-[10px] text-slate-400 mt-1">${coupleData.relationshipStartDate?new Date(`${coupleData.relationshipStartDate}T12:00:00`).toLocaleDateString('pt-BR'):'Toque para definir a data do relacionamento'}</p></div>
                            <i class="ph-bold ph-calendar-heart text-2xl text-pink-400"></i>
                        </button>

                        <button onclick="openActivityModal()" class="elo-action-card w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left active:scale-[.98] flex items-center justify-between gap-3"><div><span class="text-xl">🏆</span><p class="font-black text-white text-sm mt-1">Conquistas</p><p class="text-[9px] text-slate-500">Marcos desbloqueados do casal</p></div><i class="ph-bold ph-caret-right text-slate-500"></i></button>
                    </div>`;
            }
            else if (activeTab === 'store') {
                const cats = [
                    {id:'todos', icon:'squares-four', name:'Tudo'}, {id:'presentes', icon:'heart', name:'Presentes'},
                    {id:'tarefas', icon:'broom', name:'Tarefas'}, {id:'mimos', icon:'gift', name:'Mimos'},
                    {id:'experiencias', icon:'ticket', name:'Rolês'}, {id:'controle', icon:'game-controller', name:'Escolhas'},
                    {id:'lembrancas', icon:'camera', name:'Recordar'}, {id:'epicos', icon:'crown', name:'Épicos'}
                ];
                const q = String(storeSearchQuery || '').toLowerCase();
                if(storeCategoryFilter!=='todos' && !STORE_LIVE_CATEGORIES.has(storeCategoryFilter)) storeCategoryFilter='todos';
                const categoryStoreItems = STORE_ITEMS
                    .filter(isStoreItemLive)
                    .filter(item => storeCategoryFilter === 'todos' || item.category === storeCategoryFilter)
                    .sort((a,b) => {
                        if (storeSortMode === 'price_asc') return a.price-b.price;
                        if (storeSortMode === 'price_desc') return b.price-a.price;
                        if (storeSortMode === 'alpha') return a.title.localeCompare(b.title,'pt-BR');
                        const categoryDiff=(STORE_RECOMMENDED_ORDER[a.category]??99)-(STORE_RECOMMENDED_ORDER[b.category]??99);
                        if(categoryDiff)return categoryDiff;
                        return a.price-b.price || Number(a.id)-Number(b.id);
                    });
                const storePendingCount=(coupleData.inventory||[]).filter(i=>i.status==='pending'&&(i.beneficiaryUid===currentUser.uid||i.debtorUid===currentUser.uid)).length;
                const initialVisibleCount = categoryStoreItems.filter(item => {
                    const categoryName = STORE_CATEGORY_INFO[item.category]?.name || item.category;
                    return !q || `${item.title} ${item.desc} ${categoryName}`.toLowerCase().includes(q);
                }).length;

                html = `
                    <div class="space-y-3 flex flex-col h-[calc(100dvh-172px)]">
                        <div class="shrink-0 space-y-3">
                            <div class="flex items-center justify-between gap-3 px-1">
                                <div><p class="text-[10px] uppercase tracking-widest font-black text-purple-400">Loja do Elo</p><h2 class="text-xl font-black text-white">Escolha seu próximo mimo</h2></div>
                                <div class="flex items-center gap-2"><div class="text-right"><p class="text-[9px] uppercase font-black text-slate-500">Seu saldo</p><p class="text-sm font-black text-yellow-400"><i class="ph-fill ph-coin"></i> ${getUserCoins(coupleData,currentUser.uid).toLocaleString('pt-BR')}</p></div><button onclick="switchTab('inventory')" class="relative w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-pink-400 grid place-items-center" aria-label="Abrir minha Bolsa"><i class="ph-fill ph-backpack text-lg"></i>${storePendingCount?`<span class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black grid place-items-center">${storePendingCount>9?'9+':storePendingCount}</span>`:''}</button></div>
                            </div>
                            <div class="elo-store-toolbar">
                                <div class="relative flex-1 min-w-0">
                                    <i class="ph-bold ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                    <input id="store-search-input" value="${escapeHTML(storeSearchQuery)}" oninput="setStoreSearch(this.value)" placeholder="Pesquisar por nome, efeito ou categoria..." class="w-full bg-slate-900 border border-slate-800 focus:border-purple-500/70 outline-none rounded-2xl py-3 pl-10 pr-10 text-sm text-white placeholder:text-slate-600">
                                    <button id="store-search-clear" onclick="clearStoreSearch()" class="${storeSearchQuery ? '' : 'hidden '}absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 text-slate-400 grid place-items-center"><i class="ph-bold ph-x"></i></button>
                                </div>
                                <select class="elo-store-sort" onchange="setStoreSort(this.value)" aria-label="Ordenar itens da loja">
                                    <option value="recommended" ${storeSortMode==='recommended'?'selected':''}>Recomendados</option>
                                    <option value="price_asc" ${storeSortMode==='price_asc'?'selected':''}>Menor preço</option>
                                    <option value="price_desc" ${storeSortMode==='price_desc'?'selected':''}>Maior preço</option>
                                    <option value="alpha" ${storeSortMode==='alpha'?'selected':''}>A–Z</option>
                                </select>
                            </div>
                            <div id="store-category-rail" class="flex gap-2 overflow-x-auto pb-1 px-1 hide-scrollbar scroll-smooth">
                                ${cats.map(c => `
                                    <button data-store-category="${c.id}" onclick="setStoreFilter('${c.id}')" class="shrink-0 px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all ${storeCategoryFilter === c.id ? 'is-active-store-category bg-purple-600 text-white shadow-lg shadow-purple-950/20' : 'bg-slate-900 text-slate-400 border border-slate-800'}">
                                        <i class="ph-fill ph-${c.icon}"></i> ${c.name}
                                    </button>
                                `).join('')}
                            </div>
                            <div class="flex items-center justify-between px-1">
                                <p class="text-[10px] text-slate-500"><span id="store-result-count" class="font-black text-slate-300">${initialVisibleCount}</span> itens encontrados</p>
                                <p class="text-[9px] text-slate-600">Só aparecem itens com uso implementado</p>
                            </div>
                        </div>
                        <div class="elo-store-results flex-1 overflow-y-auto space-y-2.5 hide-scrollbar pb-5 pr-0.5">
                            ${categoryStoreItems.map(item => {
                                const categoryName = STORE_CATEGORY_INFO[item.category]?.name || item.category;
                                const searchText = `${item.title} ${item.desc} ${categoryName}`.toLowerCase();
                                const hiddenBySearch = q && !searchText.includes(q);
                                return `
                                <div data-store-card data-store-search="${escapeHTML(searchText)}" role="button" onclick="openStoreItemDetails('${item.id}')" class="${hiddenBySearch ? 'hidden ' : ''}elo-store-card bg-slate-900 rounded-2xl p-3.5 border border-slate-800 flex gap-3 items-center cursor-pointer active:scale-[.992] transition-transform">
                                    <div class="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                                        <i class="ph-fill ph-${STORE_CATEGORY_INFO[item.category]?.icon || 'bag'} text-xl"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-start gap-2"><h4 class="font-bold text-slate-100 text-sm leading-tight flex-1">${escapeHTML(item.title)}</h4><span class="text-[8px] uppercase font-black text-slate-500 bg-slate-950/70 rounded-full px-2 py-0.5">${STORE_CATEGORY_INFO[item.category]?.name || item.category}</span></div>
                                        <p class="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">${escapeHTML(item.desc)}</p>
                                        <div class="flex items-center justify-between mt-2"><span class="text-xs font-black text-yellow-400"><i class="ph-fill ph-coin"></i> ${item.price.toLocaleString('pt-BR')}</span><span class="text-[10px] font-black text-purple-400">Ver detalhes <i class="ph-bold ph-caret-right"></i></span></div>
                                    </div>
                                </div>
                            `}).join('')}
                            <div id="store-empty-search" class="${initialVisibleCount ? 'hidden ' : ''}h-full min-h-52 grid place-items-center text-center px-6"><div><div class="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 grid place-items-center mx-auto text-slate-600"><i class="ph-bold ph-magnifying-glass text-2xl"></i></div><p class="font-black text-slate-300 mt-3">Nenhum item encontrado</p><p class="text-xs text-slate-600 mt-1">Tente outro nome ou selecione “Tudo”.</p><button onclick="clearStoreSearch()" class="text-xs font-black text-purple-400 mt-3">Limpar pesquisa</button></div></div>
                        </div>
                    </div>`;
            }
            else if (activeTab === 'chat') {
                // O chat tem renderização própria e persistente. Não montamos uma tela temporária
                // antes dele, evitando flicker, salto de scroll e trabalho duplicado no iPhone.
                renderChatOnly();
                updateChatBadge();
                updateNotificationDot();
                return;
            }
            else if (activeTab === 'quests') {
                html = `
                <div class="space-y-4 pb-4">
                    <div class="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-4 text-white shadow-lg mb-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <h2 class="font-black text-lg flex items-center gap-2"><i class="ph-fill ph-target"></i> Missões Diárias</h2>
                                <p class="text-xs text-white/80 mt-1">Suas missões são secretas e diferentes das do seu amor. Todas as missões de hoje podem ser concluídas antes do reset e várias podem ser adaptadas à distância.</p><div class="flex flex-wrap gap-2 mt-2"><span class="text-[10px] font-black bg-black/20 border border-white/15 rounded-lg px-2 py-1">Nível ${getUserLevelInfo(coupleData,currentUser.uid).level} · ${getUserLevelInfo(coupleData,currentUser.uid).title}</span><span class="text-[10px] font-black bg-black/20 border border-white/15 rounded-lg px-2 py-1">${getMissionXP(coupleData, currentUser.uid)} XP</span><span class="text-[10px] font-black bg-black/20 border border-white/15 rounded-lg px-2 py-1">${getUserCoins(coupleData, currentUser.uid)} Coins</span></div>
                            </div>
                            <div class="shrink-0 bg-black/20 border border-white/20 rounded-xl px-3 py-2 text-center">
                                <p class="text-[8px] uppercase tracking-widest font-black text-white/70">Novas em</p>
                                <p id="daily-quest-timer" class="font-black text-sm tabular-nums text-white">--:--:--</p>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${refreshDailyQuests().map(q => {
                            const myState = coupleData.quests?.[`${q.instanceId}_${currentUser.uid}`];
                            let btnHTML = `<button onclick="requestQuestApproval('${q.instanceId}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl border border-slate-700 transition-colors shadow-md active:scale-95" aria-label="Marcar missão como concluída"><i class="ph-bold ph-check"></i></button>`;
                            if (myState === 'pending_approval') btnHTML = `<button onclick="openCancelQuestApprovalModal('${q.instanceId}')" class="px-3 py-2 bg-orange-500/15 text-orange-300 border border-orange-500/25 rounded-xl text-[10px] font-black text-center active:scale-95"><span class="block">Aguardando</span><span class="block text-[8px] text-orange-200/70 mt-0.5">Desfazer</span></button>`;
                            if (myState === 'rejected') btnHTML = `<button onclick="requestQuestApproval('${q.instanceId}')" class="px-3 py-2 bg-red-500/10 text-red-300 border border-red-500/20 rounded-xl text-[10px] font-black text-center active:scale-95"><span class="block">Recusada</span><span class="block text-[8px] text-red-200/70 mt-0.5">Tentar de novo</span></button>`;
                            if (myState === 'completed') btnHTML = `<div class="p-2 text-green-500"><i class="ph-fill ph-check-circle text-3xl"></i></div>`;
                            return `
                            <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col gap-2">
                                <div class="flex justify-between items-center gap-4">
                                    <div class="flex-1">
                                        <h4 class="font-bold text-sm ${myState === 'completed' ? 'line-through text-slate-600' : myState === 'rejected' ? 'text-red-200' : 'text-slate-200'}">${q.title}</h4>${myState === 'rejected' ? '<p class="text-[9px] text-red-400 mt-1">Seu amor não aprovou desta vez. Você pode concluir e enviar novamente.</p>' : ''}
                                        <div class="flex flex-wrap items-center gap-2 mt-2">
                                            <span class="text-[10px] font-black px-2 py-1 rounded-lg ${q.difficulty === 'hard' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : q.difficulty === 'medium' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'bg-green-500/15 text-green-400 border border-green-500/20'}">${q.difficultyLabel}</span>
                                            <span class="text-xs text-yellow-400 font-black"><i class="ph-fill ph-coin"></i> +${q.reward}</span>
                                            <span class="text-xs text-cyan-400 font-black"><i class="ph-fill ph-lightning"></i> +${q.xp} XP</span>
                                        </div>
                                    </div>
                                    <div class="shrink-0">${btnHTML}</div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    ${(() => {
                        if (!partnerUid || !partnerData) return '';
                        const partnerQuests = getDailyQuestsForUser(partnerUid);
                        const pending = partnerQuests.filter(q => coupleData.quests?.[`${q.instanceId}_${partnerUid}`] === 'pending_approval');
                        if (!pending.length) return `<div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center"><i class="ph-fill ph-lock-key text-slate-600 text-xl"></i><p class="text-xs text-slate-500 mt-1">As missões de ${escapeHTML(partnerData.name)} são secretas. Você só verá uma quando ela pedir aprovação.</p></div>`;
                        return `<div class="space-y-2"><p class="text-[10px] uppercase tracking-widest font-black text-green-400">Para você aprovar</p>${pending.map(q => `<div class="bg-green-500/10 border border-green-500/20 rounded-2xl p-4"><p class="text-[10px] text-green-400 font-black mb-1">${escapeHTML(partnerData.name)} concluiu:</p><p class="text-sm font-bold text-white">${escapeHTML(q.title)}</p><p class="text-[10px] text-slate-400 mt-1">Agora você pode ver o conteúdo porque ${escapeHTML(partnerData.name)} marcou esta missão como concluída.</p><div class="mt-3"><div class="flex flex-wrap gap-2 mb-3"><span class="text-xs text-yellow-400 font-black">+${q.reward} Coins</span><span class="text-xs text-cyan-400 font-black">+${q.xp} XP</span><span class="text-[10px] text-slate-400 font-bold">${q.difficultyLabel}</span></div><div class="grid grid-cols-2 gap-2"><button onclick="openRejectQuestModal('${q.instanceId}', '${partnerUid}')" class="bg-red-500/10 border border-red-500/25 text-red-300 px-4 py-2.5 rounded-xl text-xs font-black active:scale-95 transition-all">Recusar</button><button onclick="approveQuest('${q.instanceId}', '${partnerUid}', ${q.reward}, ${q.xp})" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-black active:scale-95 transition-all">Aprovar</button></div></div></div>`).join('')}</div>`;
                    })()}
                </div>`;
            }
            else if (activeTab === 'friends') {
                if (socialView === 'chat' && socialChatFriendId) {
                    // O chat social preserva o textarea e só atualiza a lista de mensagens.
                    renderSocialChatOnly();
                    return;
                }

                const socialCode = normalizeSocialCode(coupleData?.social?.code || '');
                const friends = getSocialFriends();
                const incoming = getIncomingFriendRequests();
                const outgoing = getOutgoingFriendRequests();
                const hasPartner = Object.keys(users).length >= 2;

                html = `
                <div class="space-y-4 pb-4">
                    <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/80 via-slate-900 to-pink-950 border border-purple-500/20 p-5 shadow-xl">
                        <div class="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-pink-500/10 blur-2xl"></div>
                        <div class="relative z-10">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-[10px] uppercase tracking-[.22em] font-black text-purple-300">Amizades entre Elos</p>
                                    <h2 class="text-xl font-black text-white mt-1">O social de vocês 🤝</h2>
                                    <p class="text-xs text-slate-400 mt-1">Adicionem outros casais e conversem em um espaço separado do chat particular do casal.</p>
                                </div>
                                <div class="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 grid place-items-center shrink-0"><i class="ph-fill ph-users-three text-2xl"></i></div>
                            </div>

                            ${hasPartner ? `
                            <div class="mt-4 rounded-2xl bg-slate-950/55 border border-white/5 p-3">
                                <p class="text-[9px] uppercase tracking-widest font-black text-slate-500">Código de amizade do Elo</p>
                                ${socialCode ? `
                                <div class="flex items-center gap-2 mt-2">
                                    <button onclick="copySocialCode()" class="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-center font-mono text-xl font-black tracking-[.18em] text-purple-300 active:scale-[.99]">${escapeHTML(socialCode)}</button>
                                    <button onclick="copySocialCode()" class="w-11 h-11 rounded-xl bg-purple-600 text-white grid place-items-center"><i class="ph-bold ph-copy"></i></button>
                                </div>` : `
                                <div class="mt-2 flex items-center gap-2 text-xs text-slate-400"><i class="ph-bold ph-spinner-gap animate-spin text-purple-400"></i> Preparando código social…</div>`}
                            </div>` : `
                            <div class="mt-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 p-3 text-xs text-amber-200/80">
                                O sistema de amizades será liberado quando este Elo tiver as duas pessoas conectadas.
                            </div>`}
                        </div>
                    </section>

                    ${hasPartner ? `
                    <section class="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div><p class="text-[9px] uppercase tracking-widest font-black text-purple-400">Adicionar amizade</p><p class="text-sm font-black text-white">Código de outro Elo</p></div>
                            <i class="ph-bold ph-user-plus text-xl text-purple-400"></i>
                        </div>
                        <div class="flex gap-2">
                            <input id="elo-friend-code" maxlength="6" placeholder="ABC234" oninput="normalizeSocialCodeInput(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();sendEloFriendRequest();}" class="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-center uppercase tracking-[.15em] font-black text-white focus:outline-none focus:border-purple-500">
                            <button onclick="sendEloFriendRequest()" class="px-4 rounded-xl bg-purple-600 text-white font-black text-xs">Adicionar</button>
                        </div>
                        <p class="text-[9px] text-slate-500 mt-2">Use o código de 6 caracteres da aba Amigos — não o código de 4 dígitos do casal.</p>
                    </section>` : ''}

                    ${incoming.length ? `
                    <section class="space-y-2">
                        <div class="flex items-center justify-between px-1"><div><p class="text-[9px] uppercase tracking-widest font-black text-pink-400">Pedidos</p><h3 class="font-black text-white">Querem ser amigos</h3></div><span class="min-w-6 h-6 px-2 rounded-full bg-pink-600 text-white text-[10px] font-black grid place-items-center">${incoming.length}</span></div>
                        ${incoming.map(request=>`
                        <div class="bg-pink-500/5 border border-pink-500/15 rounded-2xl p-4">
                            <div class="flex items-center gap-3">
                                <div class="w-11 h-11 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 grid place-items-center"><i class="ph-fill ph-heart text-xl"></i></div>
                                <div class="min-w-0 flex-1"><p class="font-black text-white truncate">${escapeHTML(request.displayName||'Outro Elo')}</p><p class="text-[9px] text-slate-500">Código ${escapeHTML(request.code||'')}</p></div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-3">
                                <button onclick="declineEloFriendRequest('${request.coupleId}')" class="py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-black">Recusar</button>
                                <button onclick="acceptEloFriendRequest('${request.coupleId}')" class="py-2.5 rounded-xl bg-pink-600 text-white text-xs font-black">Aceitar</button>
                            </div>
                        </div>`).join('')}
                    </section>` : ''}

                    <section class="space-y-2">
                        <div class="flex items-center justify-between px-1">
                            <div><p class="text-[9px] uppercase tracking-widest font-black text-purple-400">Elos amigos</p><h3 class="font-black text-white">${friends.length ? `${friends.length} ${friends.length===1?'amizade':'amizades'}` : 'Sua lista'}</h3></div>
                        </div>

                        ${friends.length ? friends.map(friend=>`
                        <button onclick="openSocialChat('${friend.coupleId}')" class="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[.99] shadow-md">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-purple-500/20 text-purple-300 grid place-items-center shrink-0"><i class="ph-fill ph-users-three text-2xl"></i></div>
                            <div class="min-w-0 flex-1">
                                <p class="font-black text-white truncate">${escapeHTML(friend.displayName||'Elo amigo')}</p>
                                <p class="text-[9px] text-slate-500 mt-0.5">Código ${escapeHTML(friend.code||'')} · toque para conversar</p>
                            </div>
                            <i class="ph-bold ph-chat-circle-text text-xl text-purple-400"></i>
                        </button>`).join('') : `
                        <div class="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 text-center">
                            <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 text-purple-400 grid place-items-center"><i class="ph-fill ph-users-three text-3xl"></i></div>
                            <p class="text-sm font-black text-slate-300 mt-3">Ainda sem Elos amigos</p>
                            <p class="text-xs text-slate-500 mt-1">Troquem os códigos sociais com outro casal para começar.</p>
                        </div>`}
                    </section>

                    ${outgoing.length ? `
                    <section class="rounded-2xl bg-slate-900/50 border border-slate-800 p-3">
                        <p class="text-[9px] uppercase tracking-widest font-black text-slate-500 mb-2">Pedidos enviados</p>
                        <div class="space-y-2">${outgoing.map(request=>`<div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="text-xs font-bold text-slate-300 truncate">${escapeHTML(request.displayName||'Outro Elo')}</p><p class="text-[8px] text-slate-600">${escapeHTML(request.code||'')}</p></div><span class="text-[9px] text-amber-400 font-black">Aguardando</span></div>`).join('')}</div>
                    </section>` : ''}
                </div>`;
            }
            else if (activeTab === 'inventory') {
                const inventory = coupleData.inventory || [];
                const myItems = inventory.filter(i => i.owner === currentUser.uid && i.status === 'available');
                const requestedByMe = inventory.filter(i => i.beneficiaryUid === currentUser.uid && i.status === 'pending');
                const iOwe = inventory.filter(i => i.debtorUid === currentUser.uid && i.status === 'pending');
                const pendingCount=requestedByMe.length+iOwe.length;
                const pendingCard=(item,label,accent='pink')=>`<button onclick="switchTab('chat')" class="w-full text-left bg-slate-900 border border-${accent}-500/20 rounded-2xl p-4 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-${accent}-500/10 text-${accent}-300 grid place-items-center">🎟️</div><div class="min-w-0 flex-1"><p class="text-[9px] uppercase tracking-widest font-black text-${accent}-400">${label}</p><p class="text-sm font-black text-white truncate">${escapeHTML(item.title)}</p><p class="text-[9px] text-slate-500 mt-1">Acompanhe e conclua pelo Chat</p></div><i class="ph-bold ph-chat-circle-text text-slate-500"></i></button>`;
                html = `
                <div class="space-y-5 pb-4">
                    <div class="flex items-center justify-between"><div><p class="text-[9px] uppercase tracking-widest font-black text-pink-400">Vouchers do casal</p><h2 class="font-black text-xl text-white flex items-center gap-2"><i class="ph-fill ph-backpack text-pink-500"></i> Minha Bolsa</h2></div>${pendingCount?`<span class="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black">${pendingCount} pendente${pendingCount>1?'s':''}</span>`:''}</div>
                    ${(requestedByMe.length||iOwe.length)?`<section class="space-y-2"><p class="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Pendências</p>${iOwe.map(i=>pendingCard(i,'Você está devendo','amber')).join('')}${requestedByMe.map(i=>pendingCard(i,'Seu parceiro está devendo','pink')).join('')}</section>`:''}
                    <section class="space-y-2"><p class="text-[10px] uppercase tracking-widest font-black text-slate-500 px-1">Disponíveis para usar</p>
                    ${myItems.length === 0 ? `<div class="bg-slate-900 border border-slate-800 rounded-3xl p-7 text-center text-slate-500"><i class="ph-fill ph-ghost text-4xl mb-3 mx-auto"></i><p class="text-sm font-bold">Nenhum voucher disponível.</p><p class="text-xs mt-1">Compre um voucher na Loja para guardar aqui.</p></div>` : `<div class="space-y-3">${myItems.map(item => `<div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 border border-pink-500/20 shadow-lg flex items-center gap-4"><div class="w-12 h-12 bg-pink-500/10 rounded-xl border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0"><i class="ph-fill ph-gift text-2xl"></i></div><div class="flex-1 min-w-0"><h4 class="font-bold text-slate-100 text-sm leading-tight truncate">${escapeHTML(item.title)}</h4><p class="text-[10px] text-slate-400 mt-0.5">Ao usar, vira uma pendência no Chat</p></div><button onclick="useInventoryItem('${item.id}')" class="bg-pink-600 hover:bg-pink-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all">Usar</button></div>`).join('')}</div>`}
                    </section>
                </div>`;
            }

            // Enquanto o usuário está no chat, preserve o DOM do composer. Alterações do
            // documento do relacionamento (sinergia, typing, chama etc.) não devem recriar
            // o textarea e interromper a digitação.
            if (window.activeTab === 'chat' && main.querySelector('.elo-chat-shell') && document.getElementById('chat-input')) {
                updateChatBadge();
                updateNotificationDot();
                setTimeout(renderChatOnly, 0);
                return;
            }
            main.innerHTML = html;
            if (window.activeTab === 'quests') startDailyQuestTimer(); else stopDailyQuestTimer();
            if (window.activeTab === 'home') startHomeStreakCountdown(); else stopHomeStreakCountdown();
            if (window.activeTab === 'store') centerActiveStoreCategory(false);
            updateChatBadge();
            updateNotificationDot();
            if (window.activeTab === 'chat') setTimeout(renderChatOnly, 0);
        };

        const ensureIndividualEconomy = async (data) => {
            if (!currentUser || !coupleId || !data?.users) return;
            const updates = {};
            const legacyShared = Number(data?.stats?.coins || 0);
            for (const [uid, user] of Object.entries(data.users)) {
                if (typeof user?.coins !== 'number') {
                    // Versões antigas guardavam o saldo em stats.coins. Como a moeda sempre deveria
                    // ser individual, preservamos esse saldo para cada perfil que ainda não foi migrado.
                    updates[`users.${uid}.coins`] = legacyShared + Number(user?.missionCoins || 0);
                } else if (Number(user?.missionCoins || 0) > 0) {
                    updates[`users.${uid}.coins`] = Number(user.coins || 0) + Number(user.missionCoins || 0);
                }
                if (typeof user?.xp !== 'number') updates[`users.${uid}.xp`] = 0;
                if ('missionCoins' in (user || {})) updates[`users.${uid}.missionCoins`] = deleteField();
            }
            if ('coins' in (data.stats || {})) updates['stats.coins'] = deleteField();
            if (Object.keys(updates).length) {
                try { await updateDoc(doc(db, 'relationships', coupleId), updates); }
                catch (e) { console.warn('Migração de Elo Coins individuais:', e); }
            }
        };

        const setupSync = () => {
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-header').classList.remove('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            document.getElementById('main-nav').classList.remove('hidden');

            unsubscribeSnapshot = onSnapshot(
                doc(db, 'relationships', coupleId),
                async (snap) => {
                    try {
                        if (snap.exists()) {
                            const parentData = snap.data();
                            // 'moments' vive em subcoleção. Um snapshot do documento pai
                            // não pode apagar da memória as fotos que o listener de momentos já carregou.
                            const preservedMoments =
                                momentsLoadedCoupleId === coupleId
                                    ? momentsCache
                                    : (Array.isArray(coupleData?.moments) ? coupleData.moments : []);

                            coupleData = {
                                ...parentData,
                                moments: preservedMoments
                            };
                            const users = coupleData.users || {};

                            // Sincronização de foto movida do caminho crítico do login para o listener já aberto.
                            if (
                                currentUser?.photoURL &&
                                users[currentUser.uid] &&
                                !users[currentUser.uid].photoUrl &&
                                googlePhotoSyncedForCouple !== coupleId
                            ) {
                                googlePhotoSyncedForCouple = coupleId;
                                updateDoc(doc(db,'relationships',coupleId),{
                                    [`users.${currentUser.uid}.photoUrl`]:currentUser.photoURL
                                }).catch(()=>{});
                                setDoc(doc(db,'userProfiles',currentUser.uid),{
                                    photoUrl:currentUser.photoURL,
                                    updatedAt:Date.now()
                                },{merge:true}).catch(()=>{});
                            }

                            const economyNeedsMigration = Object.values(users).some(u => typeof u?.coins !== 'number' || 'missionCoins' in (u || {})) || 'coins' in (coupleData.stats || {});
                            if (economyNeedsMigration) ensureIndividualEconomy(coupleData);

                            const updates = {};

                            // V35.1: remove o histórico legado do documento principal.
                            // Os recursos atuais já possuem estado próprio e não precisam desse array crescente.
                            if ('logs' in parentData) {
                                updates.logs = deleteField();
                            }

                            Object.keys(users).forEach(uid => {
                                if (typeof users[uid].checkedInToday !== 'boolean') {
                                    updates[`users.${uid}.checkedInToday`] = false;
                                }
                                if (typeof users[uid].lastCheckInDate !== 'string') {
                                    updates[`users.${uid}.lastCheckInDate`] = '';
                                }
                            });

                            if (!coupleData.streak) {
                                updates.streak = createEmptyStreak();
                            }

                            if (Object.keys(updates).length) {
                                try {
                                    await updateDoc(doc(db, 'relationships', coupleId), updates);
                                    const topLevelUpdates = Object.fromEntries(
                                        Object.entries(updates)
                                            .filter(([k]) => !k.startsWith('users.') && k !== 'logs')
                                    );
                                    coupleData = {
                                        ...coupleData,
                                        ...topLevelUpdates
                                    };
                                    if ('logs' in coupleData) delete coupleData.logs;
                                } catch (e) {
                                    console.warn('Migração da Chama:', e);
                                }
                            }

                            // V35: não serializa imagens dos Momentos nem estados voláteis só para
                            // decidir se a interface precisa redesenhar. Isso era especialmente caro
                            // em Android quando a galeria crescia.
                            const renderUsers = Object.fromEntries(
                                Object.entries(coupleData.users || {}).map(([uid,user]) => {
                                    const {typing, lastSeen, ...stableUser} = user || {};
                                    return [uid, stableUser];
                                })
                            );
                            const {messages, moments, logs, ...stableRelationshipData} = coupleData;
                            const signature = JSON.stringify({
                                ...stableRelationshipData,
                                users: renderUsers
                            });
                            const meaningfulRelationshipChange = signature !== lastRelationshipRenderSignature;

                            if (meaningfulRelationshipChange) {
                                lastRelationshipRenderSignature = signature;
                                updateUI();
                                updateNotificationDot();
                                runEloIdle(()=>evaluateAchievements(coupleData));
                            } else {
                                // typing/lastSeen: atualiza somente o cabeçalho do chat.
                                updateChatPresenceOnly();
                            }

                            if (!chatInitialized) {
                                chatInitialized = true;
                                startChatSync();
                            }

                            if (!unsubscribeMoments) startMomentsSync();

                            if (!unsubscribeNotifications) startNotificationSync();
                            initForegroundPush();

                            // V34: cria o perfil social apenas quando o Elo já possui as duas pessoas.
                            if (Object.keys(coupleData.users || {}).length >= 2) {
                                ensureSocialProfile().catch(()=>{});
                            }
                        } else {
                            localStorage.removeItem('elo_coupleId');
                            const staleUid = currentUser?.uid;
                            coupleId = null;
                            googlePhotoSyncedForCouple = '';
                            if (staleUid) {
                                setDoc(doc(db,'userProfiles',staleUid),{coupleId:null,updatedAt:Date.now()},{merge:true}).catch(()=>{});
                            }
                            if (unsubscribeSnapshot) {
                                unsubscribeSnapshot();
                                unsubscribeSnapshot = null;
                            }
                            document.getElementById('main-header').classList.add('hidden');
                            document.getElementById('main-content').classList.add('hidden');
                            document.getElementById('main-nav').classList.add('hidden');
                            document.getElementById('auth-screen').classList.remove('hidden');
                            showToast('Este Elo não existe mais.', 'error');
                        }
                    } catch (err) {
                        console.error('Erro ao sincronizar Elo:', err);
                        showToast('Erro ao sincronizar o Elo. Recarregue a página.', 'error');
                    }
                },
                (error) => {
                    console.error('Erro do Firestore ao sincronizar Elo:', error);
                    showToast('Não foi possível sincronizar o Elo. Verifique sua conexão e as regras do Firebase.', 'error');
                }
            );
        };

        // Auth Loop — Google obrigatório, sem login anônimo.
        onAuthStateChanged(auth, async (u) => {
            currentUser = u || null;
            const finishBoot = () => {
                const boot=document.getElementById('loading-screen');
                if(!boot)return;
                boot.classList.add('opacity-0','pointer-events-none');
                setTimeout(()=>boot.classList.add('hidden'),220);
            };
            updateGoogleAccountUI(currentUser);
            updateInviteUI();

            if (!u) {
                coupleId = '';
                coupleData = null;
                document.getElementById('main-header').classList.add('hidden');
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('main-nav').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
                finishBoot();
                return;
            }

            if (u.isAnonymous) {
                await auth.signOut();
                return;
            }

            try {
                // Se chegou por convite, priorizamos o convite apenas quando
                // a conta ainda não possui um Elo salvo.
                const restored = await restoreCoupleFromProfile(u.uid);
                if (restored && coupleId) {
                    setupSync();
                    finishBoot();
                    return;
                }

                if (inviteCode && !inviteAutoJoinInProgress) {
                    inviteAutoJoinInProgress = true;
                    const input = document.getElementById('elo-code');
                    if (input) input.value = inviteCode;
                    const nameInput = document.getElementById('user-name');
                    if (nameInput && !nameInput.value.trim()) nameInput.value = u.displayName || '';
                    await joinElo(inviteCode);
                    finishBoot();
                    return;
                }

                document.getElementById('auth-screen').classList.remove('hidden');
                const nameInput = document.getElementById('user-name');
                if (nameInput && !nameInput.value.trim()) nameInput.value = u.displayName || '';
                finishBoot();
            } catch (err) {
                console.error('Erro ao iniciar sessão:', err);
                document.getElementById('auth-screen').classList.remove('hidden');
                showToast('Não foi possível carregar sua conta. Tente novamente.', 'error');
                finishBoot();
            }
        });


// V36.2 · verificação leve do manifesto Android quando aplicável.
setTimeout(()=>{ try{ compareAndroidVersion({silent:true}); }catch(_){} }, 2500);

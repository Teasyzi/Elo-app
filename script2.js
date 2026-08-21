
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, increment, runTransaction, collection, getDocs, addDoc, query, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
        const messaging = getMessaging(app);
        // Gere a chave pública VAPID em Firebase Console > Configurações do projeto > Cloud Messaging > Configuração da Web.
        const FCM_VAPID_KEY = "BApsBO4ttWBy3UNlw-slGfsOejxggS41iSv3W54XFtA6UlbV60bdW1q9htRGKRlif3iNZMYNlnctdwo-ltRMQq4";
        const messagingSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
        const DEFAULT_NOTIFICATION_PREFS = {
            messages: true,
            quests: true,
            streak: true,
            vouchers: true,
            moments: true,
            achievements: true,
            daily: true,
            system: true
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
        
        let unsubscribeSnapshot = null;
        let unsubscribeMessages = null;
        let chatMessages = [];
        let chatInitialized = false;
        let chatUnreadCount = 0;
        let chatLastSeenAt = Number(localStorage.getItem('elo_chat_last_seen') || 0);
        let chatReplyTo = null;
        let chatEditingId = null;
        let typingTimer = null;
        let presenceTimer = null;
        let lastRelationshipRenderSignature = '';
        let unsubscribeNotifications = null;
        let unsubscribeMoments = null;
        let pushInitialized = false;
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
125|epicos|Viagem Curta|Viagem de fim de semana.|8000
126|epicos|Hotel|Uma noite em hotel.|5000
127|epicos|Hotel Premium|Noite em hotel especial.|10000
128|epicos|Pousada Romântica|Uma noite em pousada.|7500
129|epicos|Chalé|Escapada para um chalé.|8000
130|epicos|Cabana Sonhos|Noite romântica na cabana.|12000
131|epicos|Fim de Semana|Fim de semana completo.|7500
132|epicos|FDS Premium|Hospedagem + refeições + passeio.|15000
133|epicos|Road Trip|Viagem de carro.|10000
134|epicos|Road Trip Pro|Viagem maior de carro.|20000
135|epicos|Viagem Surpresa|Escolhe destino e organiza tudo.|15000
136|epicos|Viagem dos Sonhos|Começar a planejar grande viagem.|25000
137|epicos|Passaporte do Amor|Viagem internacional.|50000
138|epicos|Férias dos Sonhos|Férias completa.|100000
139|epicos|Lua de Mel 2.0|Viagem romântica especial.|75000
140|epicos|Experiência Única|Uma experiência que nunca teve.|10000
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
248|coringas|Vale Especial|Exclusiva para os dois.|3000
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
279|epicos|Viagem Curta|Fim de semana organizado.|25000
280|epicos|Bate-Volta VIP|Dia planejado.|8000
281|epicos|Road Trip Rom.|Viagem de carro.|20000
282|epicos|Viagem Surpresa|Escolhe destino e organiza.|30000
283|epicos|Viagem Sonhos|Organizar viagem desejada.|40000
284|epicos|Férias Sonhos|Grande viagem de férias.|100000
285|epicos|Lua de Mel 2.0|Viagem romântica especial.|75000
286|epicos|Sonho Antigo|Ajuda a realizar sonho seu.|50000
287|epicos|Grande Surpresa|Prepara surpresa memorável.|20000
288|epicos|Experiência Única|Inédita para o casal.|15000
289|epicos|Dia Perfeito|Baseado em tudo que você ama.|20000
290|epicos|Vale Especial|Experiência especial combinada.|10000
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

        // Parser Rápido
        const STORE_ITEMS = rawStoreItems.trim().split('\n').map(line => {
            const [id, category, title, desc, price] = line.split('|');
            return { id, category, title, desc, price: parseInt(price) };
        });

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

        const DAILY_QUESTS = [
            { id: 'q1', title: 'Dizer "Eu te amo" do nada', reward: 15 },
            { id: 'q2', title: 'Mandar uma mensagem carinhosa no chat', reward: 10 },
            { id: 'q3', title: 'Fazer um elogio sincero', reward: 20 },
            { id: 'q4', title: 'Ajudar em uma tarefa sem pedir', reward: 30 }
        ];
        window.ALL_QUESTS = DAILY_QUESTS;

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
                const response = await fetch(
                    'https://api.dicebear.com/10.x/avataaars/options.json',
                    { cache: 'no-store' }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const schema = await response.json();

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
                                        onchange="${key === 'facialHairVariant' ? "handleFacialHairChange()" : 'updateCharacterPreview()'}"
                                        class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-[11px] font-bold outline-none focus:border-pink-500 shadow-inner"
                                    >
                                        ${key === 'facialHairVariant' ? `<option value="none" ${(!savedValue || savedValue === 'none') ? 'selected' : ''}>Nenhum</option>` : ''}
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
                    getSavedValue('accessoriesProbability') ?? '10';
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

                    options[key] = value;
                });

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

            if (accessories) {
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

            // Um personagem aleatório deve poder ter barba/acessórios.
            const facialHairProbability =
                document.getElementById(
                    'db-facialHairProbability'
                );

            if (facialHairProbability) {
                facialHairProbability.value = '100';
            }

            const accessoriesProbability =
                document.getElementById(
                    'db-accessoriesProbability'
                );

            if (accessoriesProbability) {
                accessoriesProbability.value = '100';
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

        // Convite direto: https://teasyzi.github.io/Elo-app/?join=1234
        const inviteCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
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

        const getGameDateKey = (date = new Date()) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

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
                const relationshipRef = doc(db, 'relationships', data.coupleId);
                const relationship = await getDoc(relationshipRef);
                if (!relationship.exists()) return false;

                // Se a conta Google possui foto e o perfil antigo ainda não tem uma,
                // usa automaticamente a foto do Google como foto do Elo.
                const googlePhoto = currentUser?.photoURL || '';
                if (googlePhoto) {
                    const relationshipData = relationship.data() || {};
                    const myUser = relationshipData.users?.[uid] || {};
                    if (!myUser.photoUrl) {
                        await updateDoc(relationshipRef, { [`users.${uid}.photoUrl`]: googlePhoto });
                    }
                    if (data.photoUrl !== googlePhoto) {
                        await setDoc(doc(db, 'userProfiles', uid), { photoUrl: googlePhoto, updatedAt: Date.now() }, { merge: true });
                    }
                }

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

        window.signInWithGoogle = async () => {
            const button = document.getElementById('google-login-btn');
            if (button) button.disabled = true;
            document.getElementById('loading-screen').classList.remove('hidden');
            try {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                const result = await signInWithPopup(auth, provider);
                currentUser = result.user;
                updateGoogleAccountUI(currentUser);
                const restored = await restoreCoupleFromProfile(currentUser.uid);
                const nameInput = document.getElementById('user-name');
                if (nameInput && !nameInput.value.trim()) nameInput.value = currentUser.displayName || '';
                if (restored && coupleId) {
                    setupSync();
                } else if (inviteCode) {
                    document.getElementById('elo-code').value = inviteCode;
                    await joinElo(inviteCode);
                } else {
                    document.getElementById('auth-screen').classList.remove('hidden');
                    showToast('Google conectado! Agora crie ou entre em um Elo. ❤️', 'success');
                }
            } catch (err) {
                console.error('Login Google:', err);
                let message = 'Não foi possível entrar com Google.';
                if (err.code === 'auth/popup-closed-by-user') message = 'Login cancelado.';
                if (err.code === 'auth/unauthorized-domain') message = 'Este domínio ainda não está autorizado no Firebase Authentication.';
                if (err.code === 'auth/operation-not-allowed') message = 'Ative o provedor Google no Firebase Authentication.';
                showToast(message, 'error');
            } finally {
                document.getElementById('loading-screen').classList.add('hidden');
                if (button) button.disabled = false;
            }
        };

        window.createElo = async () => {
            const name = document.getElementById('user-name').value.trim() || 'Eu';
            document.getElementById('loading-screen').classList.remove('hidden');
            try {
                const code = await getNewEloCode();
                await setDoc(doc(db, 'relationships', code), {
                    createdAt: Date.now(),
                    users: { [currentUser.uid]: {
                        name, photoUrl: currentUser?.photoURL || '', character: defaultCharacter(),
                        checkedInToday: false, lastCheckInDate: '', typing: false, lastSeen: Date.now()
                    }},
                    streak: { current: 0, longest: 0, lastCompletedDate: '', status: 'waiting_partner', today: {} },
                    stats: { synergy: 50, streak: 0, lives: 0, coins: 50, lastStreakDate: '', checkedInToday: false, streakVersion: 2 },
                    inventory: [], quests: [], logs: [{ id: Date.now().toString(), text: `${name} criou um novo Elo! 💕`, timestamp: Date.now(), type: 'system' }], messages: []
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
            const name = document.getElementById('user-name').value.trim() || currentUser.displayName || 'Eu';
            const code = (directCode || document.getElementById('elo-code').value).trim().toUpperCase();
            if (!code) return showToast('Digite o código do Elo.', 'error');
            document.getElementById('loading-screen').classList.remove('hidden');
            try {
                const docRef = doc(db, 'relationships', code);
                const snap = await getDoc(docRef);
                if (!snap.exists()) return showToast('Código inválido.', 'error');
                const data = snap.data();
                const users = data.users || {};
                const ids = Object.keys(users);
                if (ids.includes(currentUser.uid)) {
                    localStorage.setItem('elo_coupleId', code); coupleId = code; await saveUserProfile(currentUser.uid, code, name); setupSync(); return;
                }
                if (ids.length >= 2) return showToast('Este Elo já está completo. Um casal pode ter apenas 2 pessoas.', 'error');
                await updateDoc(docRef, {
                    [`users.${currentUser.uid}`]: { name, photoUrl: currentUser?.photoURL || '', character: defaultCharacter(), checkedInToday: false, lastCheckInDate: '', typing: false, lastSeen: Date.now() },
                    'streak.status': 'waiting',
                    logs: arrayUnion({ id: Date.now().toString(), text: `${name} entrou no Elo! 🎉`, timestamp: Date.now(), type: 'system' })
                });
                localStorage.setItem('elo_coupleId', code); coupleId = code; await saveUserProfile(currentUser.uid, code, name); setupSync(); setTimeout(openProfileModal, 700);
            } catch (err) {
                console.error(err); showToast('Não foi possível entrar no Elo.', 'error');
            } finally { document.getElementById('loading-screen').classList.add('hidden'); }
        };

                const STREAK_REWARDS = {7:100,14:200,30:500,50:800,100:2000,180:5000,365:10000};
        const grantStreakMilestone = async (streakValue) => { const reward=STREAK_REWARDS[streakValue]; if(!reward||coupleData?.streak?.rewards?.[streakValue]) return; try { await updateDoc(doc(db,'relationships',coupleId),{'stats.coins':increment(reward),[`streak.rewards.${streakValue}`]:true,logs:arrayUnion({id:Date.now().toString(),text:`🔥 Marco de ${streakValue} dias! +${reward} Coins`,timestamp:Date.now(),type:'streak'})}); showToast(`🔥 ${streakValue} dias! +${reward} Coins`,'reward'); }catch(e){} };

window.checkInToday = async (buttonEl = null) => {
            if (!coupleData || !currentUser) return;
            // Resposta imediata no toque: evita dupla ação e deixa claro que o clique foi recebido.
            if (buttonEl) {
                if (buttonEl.dataset.busy === '1') return;
                buttonEl.dataset.busy = '1';
                buttonEl.disabled = true;
                buttonEl.classList.add('opacity-70');
                buttonEl.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i> Salvando...';
            }
            const today = getGameDateKey();
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
                        ...(reward ? { 'stats.coins': increment(reward) } : {}),
                        logs: arrayUnion({ id: `${Date.now()}_${currentUser.uid}`, text: completedNow ? `Chama completada! 🔥 ${nextStreak} dia(s) +${reward} Coins` : `${users[currentUser.uid].name} fez o check-in de hoje ❤️`, timestamp: Date.now(), type: completedNow ? 'streak' : 'system' })
                    });
                    result = { already: false, completed: completedNow, both: everyoneChecked, streak: nextStreak, reward };
                });
                if (!result?.already) await createPartnerNotification({ title: '🔥 Check-in do casal', body: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} fez o check-in de hoje.`, type: 'checkin' });
                if (result?.already) showToast('Você já fez seu check-in de hoje! 🔥', 'info');
                else if (result?.completed) showToast(`🔥 Chama ${result.streak}! +${result.reward} Elo Coins`, 'success');
                else showToast('Check-in feito! Agora falta seu amor. ❤️', 'info');
            } catch (err) { console.error(err); showToast(err.message || 'Erro ao registrar check-in.', 'error'); }
            if (result?.completed) await grantStreakMilestone(result.streak);
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
            document.getElementById('edit-name').value = myData.name || 'Eu';

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

        // --- SISTEMA DE JOGO (LOJA, INVENTÁRIO, MISSÕES, CHAT) ---
        window.buyStoreItem = async (id, price, title) => {
            if (!coupleData) return;
            if (coupleData.stats.coins < price) return showToast("Moedas insuficientes!", "error");
            
            await updateDoc(doc(db, 'relationships', coupleId), {
                'stats.coins': increment(-price),
                inventory: arrayUnion({ id: Date.now().toString(), itemId: id, title, owner: currentUser.uid, status: 'available' }),
                logs: arrayUnion({ id: Date.now().toString(), text: `${coupleData.users[currentUser.uid].name} comprou: ${title}! 🛍️`, timestamp: Date.now(), type: 'system' })
            });
            showToast("Item comprado! Olhe na sua Bolsa.", "success");
        };

        window.useInventoryItem = async (invId, title) => {
            if (!coupleData || !coupleData.inventory) return;
            const newInv = coupleData.inventory.map(i => i.id === invId ? {...i, status: 'used'} : i);
            
            await updateDoc(doc(db, 'relationships', coupleId), {
                inventory: newInv,
                logs: arrayUnion({ id: Date.now().toString(), text: `${coupleData.users[currentUser.uid].name} ativou: ${title}! ✨`, timestamp: Date.now(), type: 'system' })
            });
            showToast("Voucher Ativado! O parceiro vai ser notificado.", "reward");
        };

        const chatCollection = () => collection(db, 'relationships', coupleId, 'messages');
        const messageDoc = id => doc(db, 'relationships', coupleId, 'messages', id);

        const normalizeMessage = (m, idFallback = null) => ({
            id: m.id || idFallback || String(Date.now()),
            senderId: m.senderId || '',
            type: m.type || 'text',
            text: m.text || '',
            mediaUrl: m.mediaUrl || (m.type === 'image' && /^data:image/.test(m.text || '') ? m.text : ''),
            timestamp: Number(m.timestamp || Date.now()),
            edited: !!m.edited,
            replyTo: m.replyTo || null,
            reactions: m.reactions || {},
            readBy: m.readBy || {}
        });

        const migrateLegacyMessages = async () => {
            if (!coupleData || coupleData.messagesMigrated) return;
            try {
                const existing = await getDocs(chatCollection());
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
            try {
                const q = query(chatCollection(), orderBy('timestamp', 'asc'));
                unsubscribeMessages = onSnapshot(q, snap => {
                    chatMessages = snap.docs.map(d => normalizeMessage(d.data(), d.id));
                    const latest = chatMessages.filter(m => m.senderId !== currentUser.uid && m.timestamp > chatLastSeenAt);
                    chatUnreadCount = latest.length;
                    updateChatBadge();
                    if (window.activeTab === 'chat') {
                        markChatRead();
                        renderChatOnly();
                    }
                }, err => console.warn('Sincronização do chat:', err));
            } catch (e) { console.warn('Chat sync:', e); }
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
            chatLastSeenAt = Date.now();
            localStorage.setItem('elo_chat_last_seen', String(chatLastSeenAt));
            chatUnreadCount = 0;
            updateChatBadge();
            const latestIds = chatMessages.filter(m => m.senderId !== currentUser.uid && !m.readBy?.[currentUser.uid]).slice(-30);
            latestIds.forEach(m => updateDoc(messageDoc(m.id), { [`readBy.${currentUser.uid}`]: true }).catch(()=>{}));
        };

        const setTyping = async (value) => {
            if (!coupleId || !currentUser) return;
            clearTimeout(typingTimer);
            try { await updateDoc(doc(db, 'relationships', coupleId), { [`users.${currentUser.uid}.typing`]: !!value, [`users.${currentUser.uid}.lastSeen`]: Date.now() }); } catch(e) {}
            if (value) typingTimer = setTimeout(() => setTyping(false), 2500);
        };

        window.setChatReply = id => {
            chatReplyTo = chatMessages.find(m => m.id === id) || null;
            renderChatOnly();
            setTimeout(()=>document.getElementById('chat-input')?.focus(),50);
        };
        window.cancelChatReply = () => { chatReplyTo = null; chatEditingId = null; renderChatOnly(); };
        window.editChatMessage = id => {
            const m = chatMessages.find(x => x.id === id);
            if (!m || m.type !== 'text' || m.senderId !== currentUser.uid) return;
            chatEditingId = id;
            chatReplyTo = null;
            renderChatOnly();
            const input = document.getElementById('chat-input'); if (input) { input.value = m.text; input.focus(); }
        };
        window.deleteChatMessage = async id => {
            const m = chatMessages.find(x => x.id === id); if (!m || m.senderId !== currentUser.uid) return;
            if (!confirm('Excluir esta mensagem?')) return;
            try { await deleteDoc(messageDoc(id)); showToast('Mensagem excluída.', 'info'); } catch(e) { showToast('Não foi possível excluir.', 'error'); }
        };
        window.reactChatMessage = async (id, emoji) => {
            const m = chatMessages.find(x => x.id === id); if (!m) return;
            const current = m.reactions?.[currentUser.uid];
            try { await updateDoc(messageDoc(id), { [`reactions.${currentUser.uid}`]: current === emoji ? null : emoji }); } catch(e) {}
        };

        window.sendChatMessage = async () => {
            const input = document.getElementById('chat-input');
            if(!input || !coupleData) return;
            const text = input.value.trim();
            if (!text) return;
            try {
                if (chatEditingId) {
                    await updateDoc(messageDoc(chatEditingId), { text, edited: true });
                    chatEditingId = null;
                } else {
                    await addDoc(chatCollection(), { senderId: currentUser.uid, type: 'text', text, timestamp: Date.now(), replyTo: chatReplyTo ? { id: chatReplyTo.id, text: chatReplyTo.text || 'Imagem', senderId: chatReplyTo.senderId } : null, reactions: {}, readBy: { [currentUser.uid]: true } });
                    await createPartnerNotification({title: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} enviou uma mensagem`, body: text.length > 100 ? text.slice(0,100)+'…' : text, type:'chat'});
                }
                input.value = ''; chatReplyTo = null; setTyping(false);
                await updateDoc(doc(db,'relationships',coupleId), { 'stats.synergy': increment(0.25) }).catch(()=>{});
            } catch(e) { console.error(e); showToast('Não foi possível enviar a mensagem.', 'error'); }
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

        window.sendChatImage = async (e) => {
            const file = e.target.files?.[0]; if (!file || !coupleData) return;
            if (!file.type.startsWith('image/')) return showToast('Selecione uma imagem.', 'error');
            if (file.size > 12 * 1024 * 1024) return showToast('A imagem original deve ter até 12 MB.', 'error');
            try {
                showToast('Preparando imagem...', 'info');
                // Sem Firebase Storage: reduz a imagem no aparelho e salva o Data URL no Firestore.
                const dataUrl = await compressChatImage(file);
                const finalBytes = dataUrlBytes(dataUrl);
                if (finalBytes > CHAT_IMAGE_TARGET_BYTES) return showToast('A imagem não pôde ser reduzida para um tamanho seguro.', 'error');
                await addDoc(chatCollection(), {
                    senderId: currentUser.uid, type: 'image', mediaUrl: dataUrl, text: '', timestamp: Date.now(),
                    replyTo: chatReplyTo ? {id: chatReplyTo.id, text: chatReplyTo.text || 'Imagem', senderId: chatReplyTo.senderId} : null,
                    reactions: {}, readBy: {[currentUser.uid]: true}
                });
                await createPartnerNotification({
                    title: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} enviou uma foto`,
                    body: '📷 Abra o Elo para ver a foto.', type: 'chat_image'
                });
                chatReplyTo = null;
                showToast(`Foto enviada! ❤️ (${Math.round(finalBytes / 1024)} KB)`, 'success');
                await updateDoc(doc(db, 'relationships', coupleId), {'stats.synergy': increment(0.5)}).catch(()=>{});
            } catch(e) {
                console.error(e); showToast('Não foi possível enviar a imagem.', 'error');
            }
            e.target.value = '';
        };

        window.shareChatVoucher = id => { const item=(coupleData.inventory||[]).find(x=>x.id===id); if(!item)return; window.sendSpecialChat(`🎁 ${item.title || 'Voucher'} — enviado pelo seu amor ❤️`,'voucher'); };
        window.sendSpecialChat = async (text,type='special') => { try { await addDoc(chatCollection(),{senderId:currentUser.uid,type,text,timestamp:Date.now(),reactions:{},readBy:{[currentUser.uid]:true}}); }catch(e){showToast('Não foi possível enviar.','error');} };

        const renderChatOnly = () => {
            if (window.activeTab !== 'chat') return;
            const main=document.getElementById('main-content'); if(!main)return;
            const users=coupleData?.users||{}; const partnerUid=Object.keys(users).find(id=>id!==currentUser.uid); const partner=partnerUid?users[partnerUid]:null;
            const typing=partner?.typing; const online=partner?.lastSeen && Date.now()-Number(partner.lastSeen)<90000;
            const formatTime=t=>new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
            const reactionsFor=m=>Object.values(m.reactions||{}).filter(Boolean).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{});
            const msgHTML=chatMessages.map(m=>{
                const isMe=m.senderId===currentUser.uid; const sender=users[m.senderId]?.name||'Elo';
                const reply=m.replyTo?`<div class="mb-2 p-2 rounded-lg bg-black/10 border-l-2 border-white/40 text-[10px] opacity-80">${escapeHTML(m.replyTo.text||'Mensagem')}</div>`:'';
                let content='';
                if(m.type==='image') content=`<img src="${escapeHTML(m.mediaUrl||m.text)}" class="rounded-xl max-w-full h-auto max-h-64 border border-white/10 cursor-zoom-in" onclick="window.open('${escapeHTML(m.mediaUrl||m.text)}','_blank')">`;
                else if(m.type==='voucher') content=`<div class="rounded-xl bg-black/10 p-3"><div class="font-black">${escapeHTML(m.text)}</div><div class="text-[10px] opacity-70 mt-1">Voucher do Elo</div></div>`;
                else content=escapeHTML(m.text).replace(/\n/g,'<br>');
                const reactions=reactionsFor(m); const reactHTML=Object.entries(reactions).map(([e,n])=>`<button onclick="reactChatMessage('${m.id}','${e}')" class="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px]">${e} ${n}</button>`).join('');
                const menu=`<button onclick="favoriteChatMessage('${m.id}')" class="text-slate-400 hover:text-yellow-400">⭐</button><button onclick="pinChatMessage('${m.id}')" class="text-slate-400 hover:text-pink-400">📌</button>${isMe?`<button onclick="editChatMessage('${m.id}')" class="text-slate-400 hover:text-white">✏️</button><button onclick="deleteChatMessage('${m.id}')" class="text-slate-400 hover:text-red-400">🗑️</button>`:''}`;
                return `<div class="group max-w-[88%] ${isMe?'self-end':'self-start'}"><div class="flex items-end gap-1 ${isMe?'justify-end':''}"><div class="rounded-2xl p-3 text-sm shadow-sm ${isMe?'bg-pink-600 text-white rounded-tr-sm':'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'}">${reply}${content}<div class="flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe?'text-pink-200':'text-slate-500'}">${formatTime(m.timestamp)} ${m.edited?'· editada':''} ${isMe?`· ${Object.keys(m.readBy||{}).length>1?'✓✓':'✓'}`:''}</div></div><div class="opacity-0 group-hover:opacity-100 transition flex gap-1 text-[10px]"><button onclick="reactChatMessage('${m.id}','❤️')">❤️</button><button onclick="reactChatMessage('${m.id}','😂')">😂</button><button onclick="setChatReply('${m.id}')">↩️</button>${menu}</div></div>${reactHTML?`<div class="flex gap-1 mt-1 ${isMe?'justify-end':''}">${reactHTML}</div>`:''}</div>`;
            }).join('');
            main.innerHTML=`<div class="flex flex-col h-[calc(100dvh-180px)] relative animate-fade-in"><div class="shrink-0 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 mb-2 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center"><i class="ph-fill ph-heart text-xl"></i></div><div class="flex-1"><p class="font-black text-white text-sm">${escapeHTML(partner?.name||'Seu amor')}</p><p class="text-[10px] ${online?'text-emerald-400':'text-slate-500'}">${typing?'digitando...':online?'online agora':partner?.lastSeen?'visto recentemente':'offline'}</p></div><button onclick="searchChatMessages()" class="w-9 h-9 rounded-xl bg-slate-800 text-slate-300"><i class="ph-bold ph-magnifying-glass"></i></button></div><div class="flex-1 overflow-y-auto space-y-3 p-2 hide-scrollbar flex flex-col" id="chat-messages">${msgHTML||'<div class="m-auto text-slate-500 text-sm text-center"><i class="ph-fill ph-chat-teardrop-text text-3xl mb-2"></i><br>Mande a primeira mensagem!</div>'}</div>${chatReplyTo?`<div class="shrink-0 p-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 flex items-center gap-2"><div class="flex-1 truncate">↩️ Respondendo: <b class="text-white">${escapeHTML(chatReplyTo.text||'Imagem')}</b></div><button onclick="cancelChatReply()">✕</button></div>`:''}<div class="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-2 flex gap-2 mt-2 items-center shadow-lg"><label class="w-10 h-10 bg-slate-800 text-pink-500 rounded-xl flex items-center justify-center cursor-pointer shrink-0"><i class="ph-bold ph-camera text-lg"></i><input type="file" accept="image/*" capture="environment" class="hidden" onchange="sendChatImage(event)"></label><input id="chat-input" type="text" placeholder="Digite uma mensagem..." class="flex-1 bg-slate-950 rounded-xl px-4 py-2 text-white text-sm outline-none border border-slate-800" oninput="setTyping(true)" onkeypress="if(event.key==='Enter') sendChatMessage()"><button onclick="sendChatMessage()" class="w-10 h-10 bg-pink-600 text-white rounded-xl flex items-center justify-center shrink-0"><i class="ph-bold ph-paper-plane-right"></i></button></div></div>`;
            const c=document.getElementById('chat-messages'); if(c)c.scrollTop=c.scrollHeight;
        };

        const partnerUidOf = () => {
            const users = coupleData?.users || {};
            return Object.keys(users).find(id => id !== currentUser?.uid) || null;
        };

        const createPartnerNotification = async ({title, body, type='system', data={}}) => {
            const recipientUid = partnerUidOf();
            if (!recipientUid || !coupleId || !currentUser) return;
            try {
                await addDoc(collection(db, 'relationships', coupleId, 'notifications'), {
                    recipientUid,
                    senderUid: currentUser.uid,
                    senderName: coupleData?.users?.[currentUser.uid]?.name || currentUser.displayName || 'Seu amor',
                    title, body, type, data,
                    notificationCategory: type || 'system',
                    createdAt: Date.now(), read: false
                });
            } catch (e) { console.warn('Notificação do casal:', e); }
        };

        const markNotificationRead = async id => {
            try { await updateDoc(doc(db, 'relationships', coupleId, 'notifications', id), {read:true}); } catch(e) {}
        };

        const startNotificationSync = () => {
            if (!coupleId || !currentUser) return;
            if (unsubscribeNotifications) unsubscribeNotifications();
            unsubscribeNotifications = onSnapshot(collection(db, 'relationships', coupleId, 'notifications'), snap => {
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
            openGenericModal(`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🔔 Central</p><h3 class="text-xl font-black text-white">Notificações</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><button onclick="enablePushNotifications()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">🔔 Ativar notificações no aparelho</button><button onclick="openNotificationSettings()" class="w-full bg-slate-800 border border-slate-700 text-white font-black py-3 rounded-xl">⚙️ Configurar notificações</button><div class="space-y-2">${list.map(n=>`<button onclick="markNotificationRead('${n.id}')" class="w-full text-left p-3 rounded-2xl border ${n.read?'border-slate-800 bg-slate-900':'border-pink-500/30 bg-pink-500/10'}"><p class="text-sm font-black text-white">${escapeHTML(n.title||'Elo')}</p><p class="text-xs text-slate-300 mt-1">${escapeHTML(n.body||'')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(n.createdAt||Date.now()).toLocaleString('pt-BR')}</p></button>`).join('') || '<p class="text-sm text-slate-500 text-center py-6">Nenhuma notificação ainda.</p>'}</div></div>`);
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
                ['system','✨ Sistema','Avisos gerais do Elo']
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
            if (!messagingSupported || pushInitialized) return;
            try { onMessage(messaging, payload => { const n = payload.notification || payload.data || {}; showToast(`🔔 ${n.title || 'Elo'}${n.body ? ': '+n.body : ''}`, 'info'); }); } catch(e) { console.warn('FCM foreground:', e); }
        };

        window.requestQuestApproval = async (questId) => {
            if (!coupleData) return;
            const quest = (window.ALL_QUESTS || []).find(q => String(q.id) === String(questId));
            await updateDoc(doc(db, 'relationships', coupleId), {
                [`quests.${questId}_${currentUser.uid}`]: 'pending_approval'
            });
            await createPartnerNotification({ title: '🎯 Nova missão para aprovar', body: `${coupleData?.users?.[currentUser.uid]?.name || 'Seu amor'} concluiu: ${quest?.title || 'uma missão'}.`, type: 'quest', data: {questId} });
            showToast("Aguardando parceiro aprovar!", "info");
        };

        window.approveQuest = async (questId, partnerId, reward) => {
            if (!coupleData) return;
            await updateDoc(doc(db, 'relationships', coupleId), {
                [`quests.${questId}_${partnerId}`]: 'completed',
                'stats.coins': increment(reward),
                logs: arrayUnion({ id: Date.now().toString(), text: `Missão Aprovada! +${reward} Coins 🌟`, timestamp: Date.now(), type: 'system' })
            });
            await createPartnerNotification({ title: '🏆 Missão aprovada!', body: `Sua missão foi aprovada e você ganhou ${reward} Elo Coins.`, type: 'quest_approved', data: {questId, reward} });
            showToast("Aprovado! Elo Coins depositados.", "success");
        };

        window.switchTab = (tab) => { activeTab = tab; window.activeTab = tab; document.body.dataset.eloTab = tab; if(tab==='chat') markChatRead(); updateUI(); if(tab==='chat') setTimeout(renderChatOnly,30); };
        window.setStoreFilter = (cat) => { storeCategoryFilter = cat; updateUI(); };

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
            const confirmed = confirm(
                '⚠️ ENCERRAR ESTE ELO?\n\n' +
                'Esta ação é definitiva. O Elo será apagado para os dois e TODO o progresso será perdido: ' +
                'chama, sinergia, moedas, inventário, missões, conquistas, mensagens, notificações e momentos.\n\n' +
                'Depois disso, vocês poderão criar ou entrar em outro Elo.\n\n' +
                'Deseja realmente continuar?'
            );
            if (!confirmed) return;

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
                if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }

                // Excluir o documento pai não exclui as subcoleções no Firestore.
                await deleteSubcollectionDocs(oldCoupleId, 'messages');
                await deleteSubcollectionDocs(oldCoupleId, 'notifications');
                await deleteSubcollectionDocs(oldCoupleId, 'moments');
                await deleteDoc(relationshipRef);
                await setDoc(doc(db, 'userProfiles', currentUser.uid), {coupleId: null, updatedAt: Date.now()}, {merge: true});

                localStorage.removeItem('elo_coupleId');
                localStorage.removeItem('elo_chat_last_seen');
                coupleId = null; coupleData = null; chatMessages = []; chatInitialized = false;
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

                ${createdAt ? `<p class="text-center text-[10px] text-slate-600">Elo criado em ${createdAt.toLocaleDateString('pt-BR')}</p>` : ''}
                ${partner ? '' : `<button onclick="copyInviteLink()" class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black py-3.5 rounded-xl shadow-lg active:scale-95">🔗 Copiar link direto do convite</button>`}
                ${partner ? '' : `<button onclick="copyEloCode()" class="w-full bg-slate-800 text-white font-black py-3 rounded-xl border border-slate-700 active:scale-95">Copiar código de 4 dígitos</button>`}
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
        window.copyEloCode = async () => {
            if (!coupleId) return;
            try { await navigator.clipboard.writeText(coupleId); showToast('Código do Elo copiado!', 'success'); }
            catch { showToast(`Seu código é ${coupleId}`, 'info'); }
        };
        window.shareElo = async () => {
            if (!coupleId) return;
            const myName = coupleData?.users?.[currentUser.uid]?.name || 'seu amor';
            const inviteUrl = getInviteUrl(coupleId);
            const text = `💕 ${myName} te convidou para entrar no Elo!\n\nClique neste link para aceitar o convite:\n${inviteUrl}\n\nEntre com sua conta Google e o Elo tentará conectar vocês automaticamente. ❤️`;
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
        window.unlockAchievement = async id => { if(!coupleData || coupleData.achievements?.[id]) return; try { await updateDoc(doc(db,'relationships',coupleId),{[`achievements.${id}`]:Date.now(),logs:arrayUnion({id:Date.now().toString(),text:`Conquista desbloqueada! 🏆`,timestamp:Date.now(),type:'achievement'})}); showToast('🏆 Conquista desbloqueada!','reward'); }catch(e){} };
        const evaluateAchievements = async data => {
            const a=getAchievements(data); const streak=getStreakData(data).current||0; const synergy=Number(data?.stats?.synergy||0); const coins=Number(data?.stats?.coins||0); const quests=countCompletedQuests(data); const msgs=chatMessages.length;
            const checks={first_message:msgs>0,first_moment:(data?.moments||[]).length>0,streak_7:streak>=7,streak_30:streak>=30,quests_10:quests>=10,synergy_80:synergy>=80,coins_1000:coins>=1000};
            for(const [id,ok] of Object.entries(checks)) if(ok&&!a[id]) await unlockAchievement(id);
        };
        window.openActivityModal = () => {
            localStorage.setItem('elo_activity_seen', String(Date.now()));
            const logs=(coupleData?.logs||[]).slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,40);
            const achievements=getAchievements(coupleData);
            const html=`<div class="space-y-3"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">Central</p><h3 class="text-xl font-black text-white">Atividades & Conquistas</h3></div><button onclick="openNotificationCenter()" class="mr-2 text-xs font-black text-pink-400">🔔 Notificações</button><button onclick="closeGenericModal()" class="w-9 h-9 rounded-full bg-slate-800 text-slate-400"><i class="ph-bold ph-x"></i></button></div><div class="grid grid-cols-2 gap-2">${ACHIEVEMENTS.map(a=>`<div class="rounded-2xl p-3 border ${achievements[a[0]]?'border-yellow-500/30 bg-yellow-500/10':'border-slate-800 bg-slate-900'}"><div class="text-xl">${achievements[a[0]]?'🏆':'🔒'}</div><p class="text-xs font-black text-white mt-1">${a[1]}</p><p class="text-[9px] text-slate-500 mt-1">${a[2]}</p></div>`).join('')}</div><div class="space-y-2">${logs.map(l=>`<div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><p class="text-xs text-slate-200">${escapeHTML(l.text||'Atividade')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(l.timestamp||Date.now()).toLocaleString('pt-BR')}</p></div>`).join('')||'<p class="text-sm text-slate-500 text-center py-6">Nenhuma atividade ainda.</p>'}</div></div>`;
            openGenericModal(html);
        };
        window.openGenericModal = html => { let m=document.getElementById('generic-modal'); if(!m){m=document.createElement('div');m.id='generic-modal';m.className='fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center';document.body.appendChild(m);} m.innerHTML=`<div class="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl">${html}</div>`; };
        window.closeGenericModal=()=>document.getElementById('generic-modal')?.remove();
        const QUESTIONS=['Qual foi o momento em que você percebeu que estava apaixonado?','Qual viagem você gostaria de fazer comigo?','Qual é meu prato favorito?','Quem sobreviveria mais tempo em uma ilha deserta?','Qual carinho você mais gosta de receber?','Qual sonho você quer realizar comigo?','Qual música lembra nosso relacionamento?','Qual foi nosso encontro mais inesquecível?'];
        window.openDailyQuestion=()=>{ const idx=Math.floor(Date.now()/86400000)%QUESTIONS.length; const q=QUESTIONS[idx]; const saved=coupleData?.dailyQuestion?.date===new Date().toISOString().slice(0,10); openGenericModal(`<div class="space-y-4"><button onclick="closeGenericModal()" class="float-right text-slate-500">✕</button><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">💭 Pergunta do casal</p><h3 class="text-2xl font-black text-white">${escapeHTML(q)}</h3><textarea id="daily-answer" class="w-full h-28 bg-slate-900 border border-slate-800 rounded-2xl p-3 text-white text-sm" placeholder="Escreva sua resposta..."></textarea><button onclick="saveDailyAnswer('${encodeURIComponent(q)}')" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Salvar resposta</button></div>`); };
        window.saveDailyAnswer=async encoded=>{const answer=document.getElementById('daily-answer')?.value.trim();if(!answer)return;const date=new Date().toISOString().slice(0,10);try{await updateDoc(doc(db,'relationships',coupleId),{[`dailyQuestion.answers.${currentUser.uid}`]:answer,'dailyQuestion.question':decodeURIComponent(encoded),'dailyQuestion.date':date,logs:arrayUnion({id:Date.now().toString(),text:'Nova resposta na Pergunta do Dia 💭',timestamp:Date.now(),type:'question'})});closeGenericModal();showToast('Resposta salva! ❤️','success');}catch(e){showToast('Não foi possível salvar.','error')}};
        const QUICK_GAME_ROUNDS=[
            ['Praia 🏖️','Montanha 🏔️'],['Pizza 🍕','Hambúrguer 🍔'],['Filme 🎬','Série 📺'],['Viagem ✈️','Ficar em casa 🏠'],
            ['Acordar cedo ☀️','Dormir até tarde 😴'],['Doce 🍫','Salgado 🍟'],['Abraço 🤗','Beijo 💋'],['Dia 🌞','Noite 🌙'],
            ['Planejar 📋','Improvisar 🎲'],['Mar 🏖️','Piscina 🏊'],['Café ☕','Chá 🍵'],['Romance 💕','Comédia 😂']
        ];
        const quickGameRef=()=>doc(db,'relationships',coupleId);
        const quickGameHtml=game=>{
            const choices=game?.choices||{}; const myChoice=choices[currentUser?.uid]||null;
            const ids=Object.keys(coupleData?.users||{}); const partnerUid=ids.find(id=>id!==currentUser?.uid); const partnerChoice=partnerUid?choices[partnerUid]:null;
            const both=!!myChoice&&!!partnerChoice; const same=both&&myChoice===partnerChoice;
            const opts=game?.options||QUICK_GAME_ROUNDS[0];
            return `<div id="quick-game-content" class="text-center space-y-4">
                <div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">🎲 Jogo rápido</p><h3 class="text-2xl font-black text-white">Isso ou Aquilo</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div>
                <p class="text-sm text-slate-300">Escolham sem ver a resposta do outro.</p>
                <div class="grid grid-cols-2 gap-3">${opts.map((o,i)=>`<button ${myChoice?'disabled':''} onclick="chooseCoupleGame(${i})" class="p-4 rounded-2xl border ${myChoice===i?'border-pink-500 bg-pink-500/20':'border-slate-800 bg-slate-900'} text-white font-black text-sm disabled:opacity-100">${escapeHTML(o)}</button>`).join('')}</div>
                ${myChoice?`<p class="text-xs text-slate-400">Você escolheu <strong class="text-white">${escapeHTML(opts[myChoice])}</strong>. ${partnerChoice?'Seu amor já respondeu!':'Aguardando seu amor…'}</p>`:'<p class="text-xs text-slate-500">Cada um escolhe uma opção no próprio celular.</p>'}
                ${both?`<div class="rounded-2xl p-4 ${same?'bg-pink-500/10 border-pink-500/30':'bg-slate-900 border-slate-800'} border"><div class="text-3xl mb-2">${same?'💖':'😄'}</div><p class="font-black text-white">${same?'Vocês escolheram igual!':'Cada um escolheu uma opção diferente.'}</p><p class="text-xs text-slate-400 mt-1">Você: ${escapeHTML(opts[myChoice])} · Seu amor: ${escapeHTML(opts[partnerChoice])}</p></div><button onclick="newCoupleGame()" class="w-full bg-pink-600 text-white font-black py-3 rounded-xl">Jogar outra rodada</button>`:''}
            </div>`;
        };
        const renderCoupleGameModal=()=>{ if(document.getElementById('quick-game-content') && coupleData?.quickGame) document.getElementById('quick-game-content').outerHTML=quickGameHtml(coupleData.quickGame); };
        window.openCoupleGame=async()=>{
            if(!coupleId||!coupleData)return;
            if(!coupleData.quickGame || coupleData.quickGame.status==='done') await newCoupleGame(); else openGenericModal(quickGameHtml(coupleData.quickGame));
        };
        window.newCoupleGame=async()=>{
            const options=QUICK_GAME_ROUNDS[Math.floor(Math.random()*QUICK_GAME_ROUNDS.length)];
            try{ await updateDoc(quickGameRef(),{quickGame:{id:Date.now().toString(),options,choices:{},status:'open',createdAt:Date.now(),createdBy:currentUser.uid}}); openGenericModal(quickGameHtml({options,choices:{},status:'open'})); }
            catch(e){console.error(e);showToast('Não foi possível iniciar o jogo.','error');}
        };
        window.chooseCoupleGame=async index=>{
            const game=coupleData?.quickGame; if(!game||game.status==='done'||game.choices?.[currentUser.uid]!==undefined)return;
            try{
                const ids=Object.keys(coupleData?.users||{}); const partnerUid=ids.find(id=>id!==currentUser.uid);
                const updates={[`quickGame.choices.${currentUser.uid}`]:index};
                if(partnerUid && game.choices?.[partnerUid]!==undefined){updates['quickGame.status']='done';updates['quickGame.finishedAt']=Date.now();}
                await updateDoc(quickGameRef(),updates);
                const next={...game,choices:{...(game.choices||{}),[currentUser.uid]:index},status:partnerUid&&game.choices?.[partnerUid]!==undefined?'done':'open'};
                coupleData={...coupleData,quickGame:next}; openGenericModal(quickGameHtml(next));
            }catch(e){console.error(e);showToast('Não foi possível registrar sua escolha.','error');}
        };
        const updateNotificationDot=()=>{const dot=document.getElementById('notification-dot');const n=(coupleData?.logs||[]).filter(l=>(l.timestamp||0)>Number(localStorage.getItem('elo_activity_seen')||0)).length;if(dot){dot.textContent=n>9?'9+':String(n);dot.classList.toggle('hidden',!n);dot.classList.toggle('flex',!!n);}};

        window.openMomentsModal = () => {
            const moments=(coupleData?.moments||[]).slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
            openGenericModal(`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">📸 Privado do casal</p><h3 class="text-xl font-black text-white">Nossos Momentos</h3><p class="text-[9px] text-slate-500 mt-1">Fotos comprimidas no aparelho, sem Firebase Storage.</p></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><label class="w-full flex items-center justify-center gap-2 bg-pink-600 text-white font-black py-3 rounded-xl cursor-pointer"><i class="ph-bold ph-camera"></i> Adicionar momento<input type="file" accept="image/*" class="hidden" onchange="addMoment(event)"></label><div class="grid grid-cols-2 gap-2">${moments.map(m=>`<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><img src="${escapeHTML(m.url)}" loading="lazy" class="w-full aspect-square object-cover"><div class="p-2"><p class="text-xs text-white font-bold">${escapeHTML(m.caption||'Momento de vocês ❤️')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(m.timestamp).toLocaleDateString('pt-BR')} · ${Math.round((m.bytes||0)/1024)} KB</p></div></div>`).join('')||'<div class="col-span-2 text-center text-sm text-slate-500 py-8">Adicionem a primeira memória de vocês ❤️</div>'}</div></div>`);
        };
        window.addMoment = async e => {
            const file=e.target.files?.[0]; e.target.value='';
            if(!file||!coupleData)return;
            if(!file.type.startsWith('image/')) return showToast('Selecione uma imagem.','error');
            if(file.size>12*1024*1024)return showToast('A imagem original deve ter até 12 MB.','error');
            try{
                showToast('Preparando momento...', 'info');
                const dataUrl=await compressChatImage(file);
                const bytes=dataUrlBytes(dataUrl);
                const caption=prompt('Legenda do momento (opcional):','Momento de vocês ❤️')||'Momento de vocês ❤️';
                await addDoc(collection(db,'relationships',coupleId,'moments'),{url:dataUrl,caption:caption.slice(0,160),timestamp:Date.now(),senderId:currentUser.uid,bytes});
                await updateDoc(doc(db,'relationships',coupleId),{logs:arrayUnion({id:Date.now().toString(),text:'Novo momento 📸',timestamp:Date.now(),type:'moment'})}).catch(()=>{});
                showToast(`Momento salvo! ❤️ (${Math.round(bytes/1024)} KB)`,'success');
                openMomentsModal();
            }catch(err){console.error(err);showToast('Não foi possível salvar o momento.','error');}
        };
        window.openHistoryModal = () => { const logs=(coupleData?.logs||[]).slice().sort((a,b)=>(a.timestamp||0)-(b.timestamp||0)); openGenericModal(`<div class="space-y-4"><div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">📖 Linha do tempo</p><h3 class="text-xl font-black text-white">Nossa História</h3></div><button onclick="closeGenericModal()" class="text-slate-500">✕</button></div><div class="space-y-3">${logs.map((l,i)=>`<div class="relative pl-7"><div class="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-pink-500"></div>${i<logs.length-1?'<div class="absolute left-1.5 top-4 bottom-[-14px] w-px bg-slate-800"></div>':''}<p class="text-[9px] text-slate-500">${new Date(l.timestamp||Date.now()).toLocaleString('pt-BR')}</p><p class="text-sm font-bold text-white mt-1">${escapeHTML(l.text||'Acontecimento')}</p></div>`).join('')||'<p class="text-sm text-slate-500">A história de vocês aparecerá aqui.</p>'}</div></div>`); };
        window.searchChatMessages = () => { const term=prompt('Pesquisar no chat:'); if(!term)return; const found=chatMessages.filter(m=>(m.text||'').toLowerCase().includes(term.toLowerCase()));openGenericModal(`<div class="space-y-3"><div class="flex justify-between"><h3 class="font-black text-white">Resultados para “${escapeHTML(term)}”</h3><button onclick="closeGenericModal()">✕</button></div>${found.map(m=>`<div class="bg-slate-900 border border-slate-800 rounded-xl p-3"><p class="text-sm text-white">${escapeHTML(m.text||'Imagem')}</p><p class="text-[9px] text-slate-500 mt-1">${new Date(m.timestamp).toLocaleString('pt-BR')}</p></div>`).join('')||'<p class="text-sm text-slate-500 py-6 text-center">Nenhuma mensagem encontrada.</p>'}</div>`); };
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
            if (myData.photoUrl) { hAvatar.src = myData.photoUrl; hAvatar.classList.remove('hidden'); hInitial.classList.add('hidden'); } 
            else { hAvatar.classList.add('hidden'); hInitial.classList.remove('hidden'); hInitial.textContent = myData.name.charAt(0).toUpperCase(); }
            document.getElementById('header-name').textContent = myData.name;
            document.getElementById('header-coins').textContent = stats.coins;
            document.getElementById('header-streak').textContent = streak.current || 0;

            document.querySelectorAll('.nav-btn').forEach(b => b.className = 'nav-btn flex flex-col items-center gap-1 p-2 text-slate-500 transition-colors w-16');
            document.getElementById(`nav-${activeTab}`).classList.add('text-pink-500');

            const main = document.getElementById('main-content');
            let html = '';

            if (activeTab === 'home') {
                const synergy = Number(stats.synergy ?? 50);
                const nextMilestone = getNextMilestone(streak.current || 0);
                const streakProgress = Math.min(100, Math.max(0, ((streak.current || 0) / nextMilestone) * 100));
                const partnerCheckedToday = partnerData?.lastCheckInDate === today;
                const statusText = !partnerData
                    ? 'Conecte seu amor para começar a Chama.'
                    : streak.bothChecked
                        ? 'Vocês dois fizeram a parte de hoje. Chama mantida!'
                        : myCheckedToday
                            ? `${escapeHTML(partnerData.name)} ainda precisa fazer o check-in.`
                            : 'Faça seu check-in e ajude a manter a Chama acesa.';

                html = `
                    <div class="space-y-4 animate-fade-in pb-4">
                        <div class="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 shadow-2xl">
                            <div class="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-pink-500/10 blur-2xl"></div>
                            <div class="absolute -left-20 bottom-0 w-56 h-56 rounded-full bg-purple-500/10 blur-2xl"></div>
                            <div class="relative z-10 p-5">
                                <div class="flex items-start justify-between gap-4">
                                    <div>
                                        <p class="text-[10px] uppercase tracking-[0.25em] font-black text-pink-400">Nosso Elo</p>
                                        <h2 class="text-2xl font-black text-white mt-1">${escapeHTML(myData.name || 'Você')} <span class="text-pink-400">&</span> ${partnerData ? escapeHTML(partnerData.name) : 'seu amor'}</h2>
                                        <p class="text-xs text-slate-400 mt-1">${statusText}</p>
                                    </div>
                                    <button onclick="openCoupleModal()" class="shrink-0 w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 text-pink-400 flex items-center justify-center hover:bg-slate-700 active:scale-95"><i class="ph-fill ph-heart"></i></button>
                                </div>

                                <div class="relative h-52 mt-5 rounded-3xl bg-gradient-to-t from-slate-950/90 via-slate-900/20 to-transparent overflow-hidden border border-white/5 flex items-end justify-between px-8 pb-4">
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
                            </div>
                        </div>

                        ${!partnerData ? `
                            <div class="bg-gradient-to-br from-indigo-900/80 to-slate-900 rounded-3xl p-5 border border-indigo-500/30 shadow-lg">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center border border-indigo-500/20"><i class="ph-fill ph-link-simple text-2xl"></i></div>
                                    <div class="flex-1"><h3 class="font-black text-white">Seu Elo está esperando</h3><p class="text-xs text-indigo-200/80 mt-0.5">Compartilhe o código para seu amor entrar.</p></div>
                                </div>
                                <button onclick="openCoupleModal()" class="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl active:scale-95">Ver código do Elo</button>
                            </div>
                        ` : `
                            <div class="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-lg">
                                <div class="flex items-center justify-between gap-3 mb-4">
                                    <div><p class="text-[10px] uppercase tracking-[0.2em] font-black text-orange-400">Chama do casal</p><h3 class="text-3xl font-black text-white flex items-center gap-2 mt-1"><i class="ph-fill ph-fire text-orange-500"></i>${streak.current || 0}<span class="text-sm text-slate-500 mt-2">dias</span></h3></div>
                                    <div class="text-right"><p class="text-[9px] uppercase font-black text-slate-500">Recorde</p><p class="text-lg font-black text-pink-400">${streak.longest || 0}</p></div>
                                </div>
                                <div class="h-2 bg-slate-800 rounded-full overflow-hidden mb-2"><div class="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 rounded-full" style="width:${streakProgress}%"></div></div>
                                <div class="flex justify-between text-[9px] font-bold text-slate-500 mb-4"><span>Agora: ${streak.current || 0}</span><span>Próximo marco: ${nextMilestone}</span></div>
                                <div class="grid grid-cols-2 gap-2 mb-4">
                                    <div class="bg-slate-950 rounded-xl p-3 border border-slate-800"><p class="text-[9px] uppercase font-black text-slate-500">${escapeHTML(myData.name || 'Você')}</p><p class="text-sm font-black ${myCheckedToday ? 'text-emerald-400' : 'text-amber-400'}">${myCheckedToday ? '✓ Fez hoje' : '○ Falta fazer'}</p></div>
                                    <div class="bg-slate-950 rounded-xl p-3 border border-slate-800"><p class="text-[9px] uppercase font-black text-slate-500">${escapeHTML(partnerData.name)}</p><p class="text-sm font-black ${partnerCheckedToday ? 'text-emerald-400' : 'text-slate-400'}">${partnerCheckedToday ? '✓ Fez hoje' : '○ Ainda não'}</p></div>
                                </div>
                                ${!myCheckedToday ? `<button onclick="checkInToday(this)" class="streak-checkin-btn w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 text-white font-black py-3.5 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><i class="ph-fill ph-fire text-xl"></i> Manter a Chama Hoje</button>` : `<div class="w-full ${streak.bothChecked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-300'} border font-bold py-3.5 rounded-xl text-center text-sm">${streak.bothChecked ? '🔥 Chama mantida! Vocês fizeram o dia.' : '❤️ Sua parte está feita. Aguardando seu amor.'}</div>`}
                            </div>
                        `}

                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg"><div class="flex items-center gap-2"><i class="ph-fill ph-heart-half text-pink-400"></i><span class="text-[10px] uppercase tracking-widest font-black text-slate-500">Sinergia</span></div><p class="text-2xl font-black text-white mt-2">${synergy}<span class="text-xs text-slate-500 ml-1">pts</span></p></div>
                            <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg"><div class="flex items-center gap-2"><i class="ph-fill ph-coin text-yellow-400"></i><span class="text-[10px] uppercase tracking-widest font-black text-slate-500">Elo Coins</span></div><p class="text-2xl font-black text-white mt-2">${Number(stats.coins || 0).toLocaleString('pt-BR')}</p></div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="openDailyQuestion()" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left"><span class="text-xl">💭</span><p class="font-black text-white text-sm mt-2">Pergunta do dia</p><p class="text-[9px] text-slate-500">Conheçam-se melhor</p></button>
                            <button onclick="openCoupleGame()" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left"><span class="text-xl">🎲</span><p class="font-black text-white text-sm mt-2">Jogo rápido</p><p class="text-[9px] text-slate-500">Isso ou aquilo</p></button>
                        </div>
                        <div class="grid grid-cols-2 gap-2"><button onclick="openMomentsModal()" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left"><span class="text-xl">📸</span><p class="font-black text-white text-sm mt-2">Nossos momentos</p><p class="text-[9px] text-slate-500">Guardem suas memórias</p></button><button onclick="openHistoryModal()" class="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left"><span class="text-xl">📖</span><p class="font-black text-white text-sm mt-2">Nossa história</p><p class="text-[9px] text-slate-500">Linha do tempo do casal</p></button></div>

                        <button onclick="openActivityModal()" class="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-[0.99]"><div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center"><i class="ph-fill ph-trophy text-xl"></i></div><div class="text-left"><p class="font-black text-white">Conquistas & atividades</p><p class="text-[10px] text-slate-500">Veja o que vocês já desbloquearam</p></div></div><i class="ph-bold ph-caret-right text-slate-500"></i></button>

                        <button onclick="openCoupleModal()" class="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg active:scale-[0.99]">
                            <div class="flex items-center gap-3"><div class="w-11 h-11 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center"><i class="ph-fill ph-heart-straight text-xl"></i></div><div class="text-left"><p class="font-black text-white">Nosso Elo</p><p class="text-[10px] text-slate-500">Código, status e detalhes do casal</p></div></div><i class="ph-bold ph-caret-right text-slate-500"></i>
                        </button>
                    </div>`;
            }
            else if (activeTab === 'store') {
                const cats = [
                    {id:'todos', icon:'squares-four', name:'Tudo'}, {id:'tarefas', icon:'broom', name:'Tarefas'},
                    {id:'mimos', icon:'gift', name:'Mimos'}, {id:'experiencias', icon:'ticket', name:'Rolês'},
                    {id:'buffs', icon:'sparkle', name:'Buffs'}, {id:'controle', icon:'game-controller', name:'Controle'},
                    {id:'coringas', icon:'magic-wand', name:'Coringas'}, {id:'lembrancas', icon:'camera', name:'Recordar'},
                    {id:'epicos', icon:'crown', name:'Épicos'}
                ];
                
                html = `
                    <div class="space-y-4 animate-fade-in flex flex-col h-[calc(100dvh-180px)]">
                        <div class="shrink-0 flex gap-2 overflow-x-auto pb-3 pt-1 px-1 custom-scrollbar">
                            ${cats.map(c => `
                                <button onclick="setStoreFilter('${c.id}')" class="shrink-0 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${storeCategoryFilter === c.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-800'}">
                                    <i class="ph-fill ph-${c.icon}"></i> ${c.name}
                                </button>
                            `).join('')}
                        </div>
                        <div class="flex-1 overflow-y-auto space-y-3 hide-scrollbar pb-4 pr-1">
                            ${STORE_ITEMS.filter(i => storeCategoryFilter === 'todos' || i.category === storeCategoryFilter).map(item => `
                                <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex gap-4 items-center">
                                    <div class="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                        <i class="ph-fill ph-bag text-2xl"></i>
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="font-bold text-slate-200 text-sm leading-tight">${item.title}</h4>
                                        <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1">${item.desc}</p>
                                        <div class="flex items-center gap-1 mt-1.5"><i class="ph-fill ph-coin text-yellow-400 text-xs"></i><span class="text-xs font-black text-yellow-400">${item.price}</span></div>
                                    </div>
                                    <button onclick="buyStoreItem('${item.id}', ${item.price}, '${item.title}')" class="bg-slate-100 hover:bg-white text-slate-900 px-3 py-2 rounded-xl text-xs font-black shrink-0 shadow-md active:scale-95 transition-all">Comprar</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }
            else if (activeTab === 'chat') {
                const msgs = coupleData.messages || [];
                html = `
                <div class="flex flex-col h-[calc(100dvh-180px)] animate-fade-in relative">
                    <div class="flex-1 overflow-y-auto space-y-3 p-2 hide-scrollbar flex flex-col" id="chat-messages">
                        ${msgs.map(m => {
                            const isMe = m.senderId === currentUser.uid;
                            let contentHTML = m.type === 'image' 
                                ? `<img src="${m.text}" class="rounded-xl max-w-full h-auto mb-1 border border-white/10" onclick="window.open('${m.text}', '_blank')" style="cursor:zoom-in; max-height: 200px;"/>`
                                : m.text;
                            
                            return `<div class="max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${isMe ? 'bg-pink-600 text-white self-end rounded-tr-sm' : 'bg-slate-800 text-slate-200 self-start border border-slate-700 rounded-tl-sm'}">
                                ${contentHTML}
                                <div class="text-[9px] ${isMe ? 'text-pink-200' : 'text-slate-500'} text-right mt-1">${new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                            </div>`;
                        }).join('')}
                        ${msgs.length === 0 ? `<div class="m-auto text-slate-500 text-sm text-center"><i class="ph-fill ph-chat-teardrop-text text-3xl mb-2"></i><br>Mande a primeira mensagem!</div>` : ''}
                    </div>
                    <div class="shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-2 flex gap-2 mt-2 items-center shadow-lg">
                        <label class="w-10 h-10 bg-slate-800 text-pink-500 hover:text-white rounded-xl flex items-center justify-center hover:bg-pink-600 active:scale-95 transition-all cursor-pointer shrink-0">
                            <i class="ph-bold ph-camera text-lg"></i>
                            <input type="file" accept="image/*" capture="environment" class="hidden" onchange="sendChatImage(event)" />
                        </label>
                        <input id="chat-input" type="text" placeholder="Digite uma mensagem..." class="flex-1 bg-slate-950 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-pink-500 border border-slate-800" onkeypress="if(event.key === 'Enter') sendChatMessage()">
                        <button onclick="sendChatMessage()" class="w-10 h-10 bg-pink-600 text-white rounded-xl flex items-center justify-center hover:bg-pink-500 active:scale-95 transition-all shrink-0"><i class="ph-bold ph-paper-plane-right"></i></button>
                    </div>
                </div>`;
                setTimeout(() => { const c = document.getElementById('chat-messages'); if(c) c.scrollTop = c.scrollHeight; }, 50);
            }
            else if (activeTab === 'quests') {
                html = `
                <div class="space-y-4 animate-fade-in pb-4">
                    <div class="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-4 text-white shadow-lg mb-4">
                        <h2 class="font-black text-lg flex items-center gap-2"><i class="ph-fill ph-target"></i> Missões Diárias</h2>
                        <p class="text-xs text-white/80 mt-1">Cumpra tarefas, aguarde a aprovação do par e fature Elo Coins!</p>
                    </div>
                    <div class="space-y-3">
                        ${DAILY_QUESTS.map(q => {
                            const myState = coupleData.quests?.[`${q.id}_${currentUser.uid}`];
                            const partnerState = partnerUid ? coupleData.quests?.[`${q.id}_${partnerUid}`] : null;
                            
                            let btnHTML = `<button onclick="requestQuestApproval('${q.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl border border-slate-700 transition-colors shadow-md active:scale-95"><i class="ph-bold ph-check"></i></button>`;
                            
                            if (myState === 'pending_approval') btnHTML = `<div class="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-[10px] font-bold text-center">Aguardando<br>Parceiro</div>`;
                            if (myState === 'completed') btnHTML = `<div class="p-2 text-green-500"><i class="ph-fill ph-check-circle text-3xl"></i></div>`;

                            let partnerApproveHTML = '';
                            if (partnerState === 'pending_approval' && partnerData) {
                                partnerApproveHTML = `<div class="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                                    <span class="text-[11px] text-slate-300 font-bold">${partnerData.name} disse que fez. Aprovar?</span>
                                    <button onclick="approveQuest('${q.id}', '${partnerUid}', ${q.reward})" class="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg shadow-md text-xs font-black active:scale-95 transition-all">Aprovar</button>
                                </div>`;
                            }

                            return `
                            <div class="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col gap-2">
                                <div class="flex justify-between items-center gap-4">
                                    <div class="flex-1">
                                        <h4 class="font-bold text-sm ${myState === 'completed' ? 'line-through text-slate-600' : 'text-slate-200'}">${q.title}</h4>
                                        <div class="flex items-center gap-1 mt-1 text-yellow-400"><i class="ph-fill ph-coin text-xs"></i><span class="text-xs font-black">+${q.reward} Coins</span></div>
                                    </div>
                                    <div class="shrink-0">${btnHTML}</div>
                                </div>
                                ${partnerApproveHTML}
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }
            else if (activeTab === 'inventory') {
                const myItems = (coupleData.inventory || []).filter(i => i.owner === currentUser.uid && i.status === 'available');
                html = `
                <div class="space-y-4 animate-fade-in pb-4">
                    <h2 class="font-black text-xl text-white mb-4 flex items-center gap-2"><i class="ph-fill ph-backpack text-pink-500"></i> Minha Bolsa</h2>
                    ${myItems.length === 0 ? `<div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-500"><i class="ph-fill ph-ghost text-4xl mb-3 mx-auto"></i><p class="text-sm font-bold">Sua bolsa está vazia.</p><p class="text-xs mt-1">Compre mimos na loja!</p></div>` : ''}
                    <div class="space-y-3">
                        ${myItems.map(item => `
                            <div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 border border-pink-500/20 shadow-lg flex items-center gap-4">
                                <div class="w-12 h-12 bg-pink-500/10 rounded-xl border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0"><i class="ph-fill ph-gift text-2xl"></i></div>
                                <div class="flex-1">
                                    <h4 class="font-bold text-slate-100 text-sm leading-tight">${item.title}</h4>
                                    <p class="text-[10px] text-slate-400 mt-0.5">Voucher guardado</p>
                                </div>
                                <button onclick="useInventoryItem('${item.id}', '${item.title}')" class="bg-pink-600 hover:bg-pink-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all">Usar Mimo</button>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }

            main.innerHTML = html;
            updateChatBadge();
            updateNotificationDot();
            if (window.activeTab === 'chat') setTimeout(renderChatOnly, 0);
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
                            coupleData = snap.data();
                            const users = coupleData.users || {};
                            const updates = {};

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
                                    coupleData = {
                                        ...coupleData,
                                        ...Object.fromEntries(
                                            Object.entries(updates).filter(([k]) => !k.startsWith('users.'))
                                        )
                                    };
                                } catch (e) {
                                    console.warn('Migração da Chama:', e);
                                }
                            }

                            const renderData = JSON.parse(JSON.stringify(coupleData));
                            Object.values(renderData.users || {}).forEach(u => { delete u.typing; delete u.lastSeen; });
                            delete renderData.messages;
                            const signature = JSON.stringify(renderData);
                            if (signature !== lastRelationshipRenderSignature) { lastRelationshipRenderSignature = signature; updateUI(); }
                            updateNotificationDot();
                            if (!chatInitialized) { chatInitialized = true; startChatSync(); }
                            if (unsubscribeMoments) { unsubscribeMoments(); unsubscribeMoments = null; }
                            unsubscribeMoments = onSnapshot(query(collection(db,'relationships',coupleId,'moments'), orderBy('timestamp','desc')), msnap => {
                                coupleData = {...coupleData, moments: msnap.docs.map(d => ({id:d.id,...d.data()}))};
                                if (document.getElementById('generic-modal') && document.getElementById('generic-modal').innerText.includes('Nossos Momentos')) openMomentsModal();
                            }, err => console.warn('Sincronização dos momentos:', err));
                            startNotificationSync();
                            initForegroundPush();
                            evaluateAchievements(coupleData);
                        } else {
                            localStorage.removeItem('elo_coupleId');
                            coupleId = null;
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
            document.getElementById('loading-screen').classList.add('hidden');
            currentUser = u || null;
            updateGoogleAccountUI(currentUser);
            updateInviteUI();

            if (!u) {
                coupleId = '';
                coupleData = null;
                document.getElementById('main-header').classList.add('hidden');
                document.getElementById('main-content').classList.add('hidden');
                document.getElementById('main-nav').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
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
                    return;
                }

                if (inviteCode && !inviteAutoJoinInProgress) {
                    inviteAutoJoinInProgress = true;
                    const input = document.getElementById('elo-code');
                    if (input) input.value = inviteCode;
                    const nameInput = document.getElementById('user-name');
                    if (nameInput && !nameInput.value.trim()) nameInput.value = u.displayName || '';
                    await joinElo(inviteCode);
                    return;
                }

                document.getElementById('auth-screen').classList.remove('hidden');
                const nameInput = document.getElementById('user-name');
                if (nameInput && !nameInput.value.trim()) nameInput.value = u.displayName || '';
            } catch (err) {
                console.error('Erro ao iniciar sessão:', err);
                document.getElementById('auth-screen').classList.remove('hidden');
                showToast('Não foi possível carregar sua conta. Tente novamente.', 'error');
            }
        });
    
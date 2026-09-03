// Elo V36.11.18 · contraste completo do tema Museu em telas claras.
const VERSION='36.11.18';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,museumContrastV2:true};

const style=document.createElement('style');
style.textContent=`
/* Museu é um tema claro: superfícies claras usam tinta marrom, não tipografia branca. */
body.elo-theme-museum{color:#3d2b1f!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]),
body.elo-theme-museum #profile-modal>div,
body.elo-theme-museum #generic-modal>div{color:#3d2b1f!important}

body.elo-theme-museum #profile-modal>div,
body.elo-theme-museum #generic-modal>div{background:#f3ede4!important;border-color:#c8ad8a!important}
body.elo-theme-museum #profile-modal .bg-slate-950,
body.elo-theme-museum #generic-modal .bg-slate-950{background-color:#e8dfd0!important}
body.elo-theme-museum #profile-modal .bg-slate-900,
body.elo-theme-museum #generic-modal .bg-slate-900{background-color:#f3ede4!important}
body.elo-theme-museum #profile-modal .bg-slate-800,
body.elo-theme-museum #generic-modal .bg-slate-800{background-color:#e3d5c1!important}
body.elo-theme-museum #profile-modal .border-slate-800,
body.elo-theme-museum #profile-modal .border-slate-700,
body.elo-theme-museum #generic-modal .border-slate-800,
body.elo-theme-museum #generic-modal .border-slate-700{border-color:#c7aa85!important}

body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-white,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-50,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-100,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-200,
body.elo-theme-museum #profile-modal .text-white,
body.elo-theme-museum #profile-modal .text-slate-50,
body.elo-theme-museum #profile-modal .text-slate-100,
body.elo-theme-museum #profile-modal .text-slate-200,
body.elo-theme-museum #generic-modal .text-white,
body.elo-theme-museum #generic-modal .text-slate-50,
body.elo-theme-museum #generic-modal .text-slate-100,
body.elo-theme-museum #generic-modal .text-slate-200{color:#352419!important}

body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-300,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-400,
body.elo-theme-museum #profile-modal .text-slate-300,
body.elo-theme-museum #profile-modal .text-slate-400,
body.elo-theme-museum #generic-modal .text-slate-300,
body.elo-theme-museum #generic-modal .text-slate-400{color:#654f3c!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-500,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-600,
body.elo-theme-museum #profile-modal .text-slate-500,
body.elo-theme-museum #profile-modal .text-slate-600,
body.elo-theme-museum #generic-modal .text-slate-500,
body.elo-theme-museum #generic-modal .text-slate-600{color:#7b654f!important}

/* Botões/selos realmente coloridos continuam com texto claro. */
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) [class*="bg-pink-"] .text-white,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) [class*="bg-purple-"] .text-white,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) [class*="bg-red-"] .text-white,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) [class*="bg-emerald-"] .text-white,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) button[class*="bg-pink-"] ,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) button[class*="bg-purple-"] ,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) button[class*="bg-red-"] ,
body.elo-theme-museum :is(#main-content,#profile-modal,#generic-modal) button[class*="bg-emerald-"]{color:#fff!important}

/* Inputs claros do Museu precisam de cursor/texto escuro e placeholder visível. */
body.elo-theme-museum #profile-modal input,
body.elo-theme-museum #profile-modal textarea,
body.elo-theme-museum #generic-modal input,
body.elo-theme-museum #generic-modal textarea,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) input,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) textarea{color:#352419!important;caret-color:#8b5e34}
body.elo-theme-museum #profile-modal input::placeholder,
body.elo-theme-museum #profile-modal textarea::placeholder,
body.elo-theme-museum #generic-modal input::placeholder,
body.elo-theme-museum #generic-modal textarea::placeholder,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) input::placeholder,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) textarea::placeholder{color:#8a735d!important;opacity:1}

/* Chat: fundo é claro, mas cada bolha mantém seu próprio contraste. */
body.elo-theme-museum #chat-messages{color:#3d2b1f!important}
body.elo-theme-museum #chat-messages .elo-message-row:not(.is-mine) .text-white,
body.elo-theme-museum #chat-messages .elo-message-row:not(.is-mine) .text-slate-100,
body.elo-theme-museum #chat-messages .elo-message-row:not(.is-mine) .text-slate-200{color:#352419!important}

/* O Theme Studio é deliberadamente escuro e não herda a tinta do Museu. */
body.elo-theme-museum #elo-theme-studio-v2,
body.elo-theme-museum #elo-theme-studio-v2 *{color:revert-layer}
body.elo-theme-museum #elo-theme-studio-v2 .elo-ts-head h3,
body.elo-theme-museum #elo-theme-studio-v2 .elo-ts-row{color:#fff!important}
body.elo-theme-museum #elo-theme-studio-v2 .elo-ts-head p,
body.elo-theme-museum #elo-theme-studio-v2 .elo-ts-row small{color:#94a3b8!important}
`;
document.head.appendChild(style);
console.info('[Elo] V36.11.18 · contraste claro/escuro do Museu corrigido.');

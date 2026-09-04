// Elo V36.12 RC2 · temas estáveis + distribuição Android isolada do boot principal.
import './app-fluidity-core-v36-11-14.js';
import './app-fluidity-hotfix-v36-11-16.js';
import './app-fluidity-hotfix-v36-11-17.js';
import './app-fluidity-hotfix-v36-11-18.js';
import './app-fluidity-hotfix-v36-11-19.js';
import './app-fluidity-hotfix-v36-11-20.js';
import './app-fluidity-hotfix-v36-11-22.js';
import './app-fluidity-hotfix-v36-11-27.js';

// A distribuição Android é complementar e nunca pode travar a inicialização do Elo.
// Carregamos depois do boot principal e isolamos qualquer falha de rede/Firebase.
setTimeout(() => {
  import('./android-rc2-guard.js').catch(error => console.warn('[Elo] Android guard indisponível:', error));
  import('./android-distribution-v36-12.js').catch(error => console.warn('[Elo] Distribuição Android indisponível:', error));
}, 1200);

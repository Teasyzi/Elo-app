// Elo V36.12 RC6 · temas estáveis + auth original preservado + restauração segura do vínculo.
import './app-fluidity-core-v36-11-14.js';
import './app-fluidity-hotfix-v36-11-16.js';
import './app-fluidity-hotfix-v36-11-17.js';
import './app-fluidity-hotfix-v36-11-18.js';
import './app-fluidity-hotfix-v36-11-19.js';
import './app-fluidity-hotfix-v36-11-20.js';
import './app-fluidity-hotfix-v36-11-22.js';
import './app-fluidity-hotfix-v36-11-27.js';
import './app-fluidity-hotfix-v36-12-theme-exit.js';
import './app-fluidity-hotfix-v36-12-session-restore.js';
import './app-fluidity-hotfix-v36-12-login-stability.js';

// O fluxo de autenticação continua sob responsabilidade do app.js/Firebase Web SDK.
// O hotfix acima apenas troca a implementação nativa do seletor Google no Android.
// Os módulos Android de distribuição só carregam depois que o Firebase Auth entregou um usuário.
function loadAndroidSidecarsAfterAuth(){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    const user=window.currentUser;
    const appVisible=!document.getElementById('main-content')?.classList.contains('hidden');
    if(user?.uid||appVisible){
      clearInterval(timer);
      import('./android-rc2-guard.js').catch(error=>console.warn('[Elo] Android guard indisponível:',error));
      import('./android-distribution-v36-12.js').catch(error=>console.warn('[Elo] Distribuição Android indisponível:',error));
      return;
    }
    if(attempts>=120)clearInterval(timer);
  },500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAndroidSidecarsAfterAuth,{once:true});
else loadAndroidSidecarsAfterAuth();

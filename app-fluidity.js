// Elo V36.12 RC2 · temas estáveis + auth original preservado + Android isolado do login.
import './app-fluidity-core-v36-11-14.js';
import './app-fluidity-hotfix-v36-11-16.js';
import './app-fluidity-hotfix-v36-11-17.js';
import './app-fluidity-hotfix-v36-11-18.js';
import './app-fluidity-hotfix-v36-11-19.js';
import './app-fluidity-hotfix-v36-11-20.js';
import './app-fluidity-hotfix-v36-11-22.js';
import './app-fluidity-hotfix-v36-11-27.js';
import './app-fluidity-hotfix-v36-12-theme-exit.js';

// Importante: o fluxo de autenticação fica 100% sob responsabilidade do app.js.
// Os módulos Android NÃO carregam durante a tela de login; eles só entram depois
// que o Firebase Auth já entregou um usuário real. Assim nenhuma ponte RC2 pode
// competir com popup, persistência ou restauração de sessão no Chrome mobile.
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
    // Não fica rodando para sempre na tela de login.
    if(attempts>=120)clearInterval(timer);
  },500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadAndroidSidecarsAfterAuth,{once:true});
else loadAndroidSidecarsAfterAuth();

// Elo V36.12 RC2 · o Studio V2 é a única interface válida de temas.
// Impede que sair de uma prévia ressuscite o modal legado descartado.
const VERSION='36.12-theme-exit';
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),themeStudioV2Only:true};

let reopening=false;
function legacyThemeModal(){
  const modal=document.getElementById('generic-modal');
  return modal?.querySelector?.('.elo-theme-studio') ? modal : null;
}
function v2Visible(){
  const studio=document.getElementById('elo-theme-studio-v2');
  if(!studio)return false;
  const host=studio.closest?.('[id],[role="dialog"]')||studio;
  return !host.classList.contains('hidden');
}
function killLegacyAndRestoreV2(){
  const legacy=legacyThemeModal();
  if(!legacy)return false;
  try{window.closeGenericModal?.()}catch(_){legacy.classList.add('hidden')}
  // Ao sair da prévia, o fluxo antigo tentava voltar ao Studio legado. Voltamos ao V2.
  if(!v2Visible()&&!reopening&&typeof window.openThemeStudioV2==='function'){
    reopening=true;
    queueMicrotask(()=>{
      try{window.openThemeStudioV2()}catch(err){console.warn('[Elo] reabrir Studio V2',err)}
      setTimeout(()=>{reopening=false},120);
    });
  }
  return true;
}
function install(){
  killLegacyAndRestoreV2();
  const observer=new MutationObserver(()=>killLegacyAndRestoreV2());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  // Captura também o clique de saída da prévia; o legado costuma nascer no mesmo ciclo/evento.
  document.addEventListener('click',()=>setTimeout(killLegacyAndRestoreV2,0),true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
console.info('[Elo] V36.12 · Studio de temas V2 exclusivo; seletor legado bloqueado.');

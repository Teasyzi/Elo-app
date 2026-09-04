// Elo V36.12 RC2 · Studio V2 exclusivo + restauração exata do tema após prévia.
const VERSION='36.12-theme-exit-v2';
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),themeStudioV2Only:true,themePreviewRestore:true};

let reopening=false;
let previewSnapshot='';
const uid=()=>window.currentUser?.uid||'';
const themeKey=()=>`elo_theme_${uid()||'device'}`;

function currentPersistedTheme(){
  return localStorage.getItem(themeKey())||'akai';
}
function rememberThemeBeforePreview(){
  previewSnapshot=currentPersistedTheme();
  sessionStorage.setItem('elo_theme_before_preview',previewSnapshot);
}
function restoreThemeBeforePreview(){
  const id=previewSnapshot||sessionStorage.getItem('elo_theme_before_preview')||'';
  if(!id)return false;
  // A prévia nunca deve alterar a escolha persistida. Regravamos a escolha anterior
  // antes de reaplicar visualmente, evitando fallback indevido para Akai Ito.
  localStorage.setItem(themeKey(),id);
  try{window.applyEloTheme?.(id)}catch(err){console.warn('[Elo] restaurar tema após prévia',err)}
  sessionStorage.removeItem('elo_theme_before_preview');
  previewSnapshot='';
  return true;
}
function legacyThemeModal(){
  const modal=document.getElementById('generic-modal');
  return modal?.querySelector?.('.elo-theme-studio') ? modal : null;
}
function v2Visible(){
  const studio=document.getElementById('elo-theme-studio-v2');
  return !!studio?.isConnected;
}
function killLegacyAndRestoreV2(){
  const legacy=legacyThemeModal();
  if(!legacy)return false;
  restoreThemeBeforePreview();
  try{window.closeGenericModal?.()}catch(_){legacy.classList.add('hidden')}
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
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-preview-theme]')) rememberThemeBeforePreview();
    setTimeout(killLegacyAndRestoreV2,0);
  },true);
  const observer=new MutationObserver(()=>killLegacyAndRestoreV2());
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
console.info('[Elo] V36.12 · saída da prévia restaura exatamente o tema anterior.');

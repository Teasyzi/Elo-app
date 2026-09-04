// Elo V36.11.27 · Celestial temporariamente suspenso para estabilizar o app.
const VERSION='36.11.27';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,celestialTemporarilyDisabled:true};

const uid=()=>window.currentUser?.uid||'';
const themeKey=()=>`elo_theme_${uid()||'device'}`;

function removeCelestialRows(){
  document.querySelectorAll('[data-theme-id="celestial"],[data-preview-theme="celestial"],[data-buy-theme="celestial"]').forEach(el=>{
    const row=el.closest?.('[data-theme-id]')||el;
    row.remove();
  });
}

async function fallbackFromCelestial(){
  const key=themeKey();
  const saved=localStorage.getItem(key);
  const active=document.body?.classList.contains('elo-theme-celestial');
  if(saved!=='celestial'&&!active)return false;
  localStorage.setItem(key,'akai');
  try{
    if(typeof window.selectEloTheme==='function')await window.selectEloTheme('akai');
    else if(typeof window.applyEloTheme==='function')window.applyEloTheme('akai');
  }catch(err){console.warn('[Elo] fallback do Celestial para Akai',err)}
  document.body?.classList.remove('elo-theme-celestial');
  document.getElementById('elo-theme-fx')?.classList.remove('elo-gravity-surge','is-gravity-active');
  return true;
}

function installThemeGuard(){
  const select=window.selectEloTheme;
  if(typeof select==='function'&&!select.__eloCelestialDisabled){
    const original=select;
    const wrapped=async id=>{
      if(id==='celestial')return false;
      return original(id);
    };
    wrapped.__eloCelestialDisabled=true;
    window.selectEloTheme=wrapped;
  }
  const open=window.openThemeStudioV2;
  if(typeof open==='function'&&!open.__eloCelestialDisabled){
    const original=open;
    const wrapped=(...args)=>{
      const result=original(...args);
      queueMicrotask(removeCelestialRows);
      setTimeout(removeCelestialRows,40);
      return result;
    };
    wrapped.__eloCelestialDisabled=true;
    window.openThemeStudioV2=wrapped;
  }
}

function disableCelestialRuntime(){
  installThemeGuard();
  removeCelestialRows();
  fallbackFromCelestial();
  window.reactCelestialBlackHole=()=>false;
}

function boot(){disableCelestialRuntime()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
const observer=new MutationObserver(()=>removeCelestialRows());
if(document.body)observer.observe(document.body,{childList:true,subtree:true});
else document.addEventListener('DOMContentLoaded',()=>observer.observe(document.body,{childList:true,subtree:true}),{once:true});
setTimeout(disableCelestialRuntime,500);
setTimeout(disableCelestialRuntime,1400);
setTimeout(disableCelestialRuntime,3000);
setTimeout(disableCelestialRuntime,6000);
window.addEventListener('pageshow',()=>setTimeout(disableCelestialRuntime,80));
console.info('[Elo] V36.11.27 · tema Celestial suspenso temporariamente; fallback para Akai.');

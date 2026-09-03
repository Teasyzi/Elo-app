// Elo V36.11.15 · hotfix de uso: Temas confiáveis, Museu legível, gravidade V8 e menos churn de DOM.
const VERSION='36.11.15';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleV8:true,blackHoleFixedTarget:true,themeStudioReliable:true,museumReadability:true,mainObserverReduced:true};

const hotfixStyle=document.createElement('style');
hotfixStyle.textContent=`
/* Museu: superfícies claras precisam de tipografia escura e contraste real. */
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]){color:#3f2b1e!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-white,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-100,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-200{color:#352419!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-300,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-400{color:#66513f!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-500,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .text-slate-600{color:#806a55!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .bg-slate-950{background-color:#e8dfd0!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .bg-slate-900{background-color:#f3ede4!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .bg-slate-800{background-color:#e5d8c6!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .border-slate-800,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) .border-slate-700{border-color:#c6aa88!important}
body.elo-theme-museum #main-header .text-white,body.elo-theme-museum #main-nav .text-white{color:#352419!important}
body.elo-theme-museum #main-header .text-slate-400,body.elo-theme-museum #main-nav .text-slate-400,
body.elo-theme-museum #main-header .text-slate-500,body.elo-theme-museum #main-nav .text-slate-500{color:#715b47!important}

/* Clones da gravidade ficam presos ao viewport; nenhum RAF externo consegue mudar o destino. */
.elo-gravity-v8-clone{position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;pointer-events:none!important;z-index:2147481800!important;animation:none!important;transition:none!important;will-change:transform,opacity,filter!important}
`;
document.head.appendChild(hotfixStyle);

let themeOpening=false;
function themeButtons(){return document.querySelectorAll('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child')}
function unlockThemeButtons(){themeButtons().forEach(btn=>{btn.dataset.eloSingleTap='0';btn.dataset.eloLastTap='0';btn.disabled=false})}
function openThemeStudioReliable(){
 if(themeOpening)return;
 themeOpening=true;
 unlockThemeButtons();
 const modal=document.getElementById('generic-modal');
 if(modal)modal.classList.add('hidden');
 const open=()=>{try{if(typeof window.openThemeStudio==='function')window.openThemeStudio()}catch(e){console.error('[Elo] Abrir temas:',e)}};
 open();
 setTimeout(()=>{
   const m=document.getElementById('generic-modal');
   if(m?.classList.contains('hidden'))open();
   unlockThemeButtons();
   themeOpening=false;
 },720);
}
/* O guard antigo trabalha em click. No pointerup zeramos o marcador antes do click seguinte. */
document.addEventListener('pointerup',e=>{const btn=e.target.closest?.('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child');if(btn){btn.dataset.eloSingleTap='0';btn.dataset.eloLastTap='0'}},true);
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child');
 if(!btn)return;
 e.preventDefault();e.stopImmediatePropagation();
 btn.dataset.eloSingleTap='0';btn.dataset.eloLastTap='0';
 openThemeStudioReliable();
},true);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){
 const core=hole?.querySelector?.('.elo-black-hole-core');
 const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();
 return{x:r.left+r.width/2,y:r.top+r.height/2};
}
function gravityCloneAnimation(source,hx,hy,index){
 const r=source.getBoundingClientRect();
 if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const comet=source.classList.contains('elo-space-comet');
 const side=index%2?1:-1,px=-dy/dist,py=dx/dist,bend=Math.min(comet?86:54,dist*(comet?.13:.085))*side;
 const angle=Math.atan2(dy,dx)*180/Math.PI;
 const clone=source.cloneNode(true);
 clone.removeAttribute('id');clone.classList.add('elo-gravity-v8-clone');
 Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,transform:'none',visibility:'visible',opacity:getComputedStyle(source).opacity||'1'});
 document.body.appendChild(clone);
 const previousVisibility=source.style.visibility;source.style.visibility='hidden';
 const at=(p,t)=>`translate3d(${dx*p+px*bend*t}px,${dy*p+py*bend*t}px,0) rotate(${angle}deg)`;
 const duration=(comet?3300:2550)+Math.min(comet?1900:1300,dist*(comet?1.45:1.05))+(index%5)*36;
 try{
   const animation=clone.animate([
    {transform:`translate3d(0,0,0) rotate(${angle}deg) scale(1,1)`,opacity:.96,filter:'brightness(1)',offset:0},
    {transform:`${at(.035,.28)} scale(1.02,.99)`,opacity:.98,filter:'brightness(1.03)',offset:.24},
    {transform:`${at(.13,.58)} scale(${comet?'1.08,.95':'1.06,.95'})`,opacity:1,filter:'brightness(1.08)',offset:.49},
    {transform:`${at(.34,.64)} scale(${comet?'1.25,.80':'1.32,.78'})`,opacity:1,filter:'brightness(1.16)',offset:.69},
    {transform:`${at(.62,.40)} scale(${comet?'1.65,.58':'1.85,.52'})`,opacity:.95,filter:'brightness(1.28)',offset:.84},
    {transform:`${at(.86,.12)} scale(${comet?'2.7,.28':'3.2,.22'})`,opacity:.72,filter:'brightness(1.5) blur(.18px)',offset:.94},
    {transform:`translate3d(${dx}px,${dy}px,0) rotate(${angle}deg) scale(${comet?'4.6,.08':'5.5,.05'})`,opacity:0,filter:'brightness(1.9) blur(.65px)',offset:1}
   ],{duration,easing:'linear',fill:'forwards'});
   return animation.finished.catch(()=>{}).finally(()=>{clone.remove();source.style.visibility=previousVisibility});
 }catch(_){clone.remove();source.style.visibility=previousVisibility;return Promise.resolve()}
}
function pullV8(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV8==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const {x:hx,y:hy}=holeCenter(hole);
 fx.dataset.eloGravityV8='1';hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
 const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?16:30);
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>gravityCloneAnimation(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV8;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});
 return true;
}
function installGravityV8(){const fn=event=>pullV8(event);fn.__eloBhV7=true;fn.__eloBhV8=true;window.reactCelestialBlackHole=fn}

function reduceObserverChurn(){
 const main=document.getElementById('main-content'),observer=window.ELO_FLUIDITY?.stats?.mainObserver;
 if(!main||!observer||observer.__eloReduced)return;
 try{observer.disconnect();observer.observe(main,{childList:true,subtree:false});observer.__eloReduced=true}catch(_){}
}
function refreshHotfix(){unlockThemeButtons();installGravityV8();reduceObserverChurn()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshHotfix,{once:true});else refreshHotfix();
setTimeout(refreshHotfix,900);setTimeout(refreshHotfix,2200);
console.info('[Elo] V36.11.15 · Temas confiáveis + Museu legível + gravidade V8 + observer reduzido.');

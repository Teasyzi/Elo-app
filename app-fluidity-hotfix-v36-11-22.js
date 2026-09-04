// Elo V36.11.22 · volta ao puxão clássico do Celestial + reaplica o tema salvo após login/reload.
const VERSION='36.11.22';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleClassicPull:true,themePersistenceFix:true};

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}

// Retoma a animação V7 que era mais simples e agradável: curva de atração + espaguetificação progressiva.
function classicGravityAnimation(el,hx,hy,index){
 const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const comet=el.classList.contains('elo-space-comet'),angle=Math.atan2(dy,dx)*180/Math.PI,side=index%2?1:-1;
 const px=-dy/dist,py=dx/dist,bend=Math.min(comet?92:64,dist*(comet?.145:.105))*side;
 const duration=(comet?3000:2350)+Math.min(comet?1900:1350,dist*(comet?1.42:1.08))+(index%5)*40;
 const delay=Math.min(180,(index%7)*20),startOpacity=getComputedStyle(el).opacity||'1';
 const at=(p,t)=>`${dx*p+px*bend*t}px ${dy*p+py*bend*t}px`;
 try{return el.animate([
  {translate:'0px 0px',rotate:'0deg',scale:'1 1',opacity:startOpacity,filter:'brightness(1)',offset:0},
  {translate:at(.06,.38),rotate:`${angle*.05}deg`,scale:'1.01 .99',opacity:.99,filter:'brightness(1.02)',offset:.24},
  {translate:at(.18,.62),rotate:`${angle*.15}deg`,scale:comet?'1.06 .95':'1.05 .96',opacity:1,filter:'brightness(1.06)',offset:.48},
  {translate:at(.42,.60),rotate:`${angle*.36}deg`,scale:comet?'1.20 .82':'1.26 .80',opacity:1,filter:'brightness(1.14)',offset:.70},
  {translate:at(.70,.34),rotate:`${angle*.68}deg`,scale:comet?'1.62 .58':'1.82 .54',opacity:.94,filter:'brightness(1.28)',offset:.85},
  {translate:at(.90,.10),rotate:`${angle*.92}deg`,scale:comet?'2.55 .30':'2.95 .25',opacity:.67,filter:'brightness(1.48) blur(.18px)',offset:.95},
  {translate:`${dx}px ${dy}px`,rotate:`${angle}deg`,scale:comet?'3.7 .11':'4.4 .08',opacity:0,filter:'brightness(1.75) blur(.5px)',offset:1}
 ],{duration,delay,easing:'cubic-bezier(.22,.64,.24,1)',fill:'none'}).finished.catch(()=>{})}catch(_){return Promise.resolve()}
}
function pullClassic(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityClassic==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityClassic='1';hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible),particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?16:30);
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>classicGravityAnimation(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityClassic;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});return true;
}
function installClassicGravity(){const fn=e=>pullClassic(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;fn.__eloBhV12=true;fn.__eloBhClassic=true;window.reactCelestialBlackHole=fn}

function currentThemeKey(){const id=window.currentUser?.uid;if(id)return`elo_theme_${id}`;return''}
function bodyHasTheme(id){if(!id)return false;if(id==='custom')return document.body?.classList.contains('elo-theme-custom');return document.body?.classList.contains(`elo-theme-${id}`)}
function reapplyPersistedTheme(){
 const key=currentThemeKey();if(!key||typeof window.applyEloTheme!=='function')return false;
 const selected=localStorage.getItem(key)||'akai';
 if(!bodyHasTheme(selected)){try{window.applyEloTheme(selected)}catch(err){console.warn('[Elo] reaplicar tema salvo',err)}}
 return true;
}
function startThemeRestore(){
 let tries=0;const timer=setInterval(()=>{tries++;reapplyPersistedTheme();if(tries>=24)clearInterval(timer)},250);
 setTimeout(reapplyPersistedTheme,120);setTimeout(reapplyPersistedTheme,900);setTimeout(reapplyPersistedTheme,2200);
}
window.addEventListener('pageshow',()=>setTimeout(reapplyPersistedTheme,80));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(reapplyPersistedTheme,80)});

function boot(){installClassicGravity();startThemeRestore()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
// V20 instala sua gravidade com atraso; estes reforços garantem que a clássica seja a última ativa.
setTimeout(installClassicGravity,1900);setTimeout(installClassicGravity,2700);setTimeout(reapplyPersistedTheme,3200);
console.info('[Elo] V36.11.22 · gravidade clássica restaurada + persistência de tema corrigida.');

// Elo V36.11.23 · Celestial: todos os objetos visíveis são atraídos e a queda fica mais lenta.
const VERSION='36.11.23';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleClassicPullV2:true,blackHolePullAll:true,blackHoleSlower:true};

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}

function slowClassicGravity(el,hx,hy,index){
 const r=el.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const comet=el.classList.contains('elo-space-comet'),angle=Math.atan2(dy,dx)*180/Math.PI,side=index%2?1:-1;
 const px=-dy/dist,py=dx/dist;
 // Mantém o puxão clássico, mas com curva menor para que todos terminem claramente dentro do horizonte.
 const bend=Math.min(comet?78:52,dist*(comet?.12:.085))*side;
 // ~30% mais lento que V36.11.22, sem virar uma animação arrastada demais.
 const duration=(comet?4000:3150)+Math.min(comet?2450:1750,dist*(comet?1.78:1.34))+(index%6)*45;
 const delay=Math.min(260,(index%9)*24),startOpacity=getComputedStyle(el).opacity||'1';
 const at=(p,t)=>`${dx*p+px*bend*t}px ${dy*p+py*bend*t}px`;
 try{return el.animate([
  {translate:'0px 0px',rotate:'0deg',scale:'1 1',opacity:startOpacity,filter:'brightness(1)',offset:0},
  {translate:at(.045,.34),rotate:`${angle*.035}deg`,scale:'1.01 .995',opacity:.99,filter:'brightness(1.01)',offset:.20},
  {translate:at(.13,.54),rotate:`${angle*.10}deg`,scale:comet?'1.04 .97':'1.035 .975',opacity:1,filter:'brightness(1.04)',offset:.40},
  {translate:at(.29,.62),rotate:`${angle*.24}deg`,scale:comet?'1.10 .91':'1.13 .90',opacity:1,filter:'brightness(1.08)',offset:.60},
  {translate:at(.53,.50),rotate:`${angle*.48}deg`,scale:comet?'1.28 .76':'1.38 .72',opacity:.99,filter:'brightness(1.16)',offset:.77},
  {translate:at(.76,.28),rotate:`${angle*.73}deg`,scale:comet?'1.64 .54':'1.84 .48',opacity:.91,filter:'brightness(1.28)',offset:.89},
  {translate:at(.92,.08),rotate:`${angle*.93}deg`,scale:comet?'2.35 .31':'2.70 .26',opacity:.62,filter:'brightness(1.45) blur(.16px)',offset:.97},
  {translate:`${dx}px ${dy}px`,rotate:`${angle}deg`,scale:comet?'3.2 .14':'3.7 .10',opacity:0,filter:'brightness(1.62) blur(.42px)',offset:1}
 ],{duration,delay,easing:'cubic-bezier(.18,.56,.22,1)',fill:'none'}).finished.catch(()=>{})}catch(_){return Promise.resolve()}
}

function pullAllClassic(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityAll==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityAll='1';
 hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
 // Sem slice: todas as partículas DOM visíveis participam da atração.
 const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible);
 const targets=[...comets,...particles];
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled(targets.map((el,i)=>slowClassicGravity(el,hx,hy,i))).finally(()=>{
  delete fx.dataset.eloGravityAll;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active');
 });
 return true;
}

function install(){
 const fn=e=>pullAllClassic(e);
 fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;fn.__eloBhV12=true;fn.__eloBhClassic=true;fn.__eloBhClassicV2=true;
 window.reactCelestialBlackHole=fn;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
// Os hotfixes anteriores também reforçam seus hooks com atraso; este fica por último.
setTimeout(install,2000);setTimeout(install,2900);setTimeout(install,3800);
console.info('[Elo] V36.11.23 · todos os objetos visíveis são puxados para o horizonte, em ritmo mais lento.');

// Elo V36.11.19 · gravidade V10 suave + contraste forte da HOME no tema Museu.
const VERSION='36.11.19';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleV10:true,blackHoleSmoothSpiral:true,museumHomeContrast:true};

const style=document.createElement('style');
style.textContent=`
/* Museu V3: a HOME é clara, então a tipografia precisa ser explicitamente escura. */
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]),
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(h1,h2,h3,h4,h5,h6,p,span,small,strong,b,em,label,div,a,button){color:#3a281d!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(.text-slate-300,.text-slate-400,.text-slate-500,.text-slate-600){color:#6b5542!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(.text-pink-300,.text-pink-400,.text-pink-500){color:#9f365f!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(.text-amber-300,.text-amber-400,.text-yellow-300,.text-yellow-400){color:#8a5a18!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(.text-emerald-300,.text-emerald-400,.text-green-300,.text-green-400){color:#356447!important}
/* Botões e badges realmente escuros/coloridos preservam texto claro. */
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-pink-"],
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-purple-"],
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-red-"],
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-emerald-"],
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-slate-9"],
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-slate-8"]{color:#fff!important}
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-pink-"] *,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-purple-"] *,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-red-"] *,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-emerald-"] *,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-slate-9"] *,
body.elo-theme-museum #main-content:not([data-elo-fluid-tab="chat"]) :is(button,a,[role="button"])[class*="bg-slate-8"] *{color:#fff!important}
/* Cometas V10: clone preso ao viewport, sem animação própria concorrendo. */
.elo-gravity-v10-clone{position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;pointer-events:none!important;z-index:2147481750!important;animation:none!important;transition:none!important;will-change:transform,opacity,filter!important;transform-origin:50% 50%!important}
`;
document.head.appendChild(style);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function smoothstep(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
function gravitySmoothSpiral(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=cx-hx,dy=cy-hy,dist=Math.hypot(dx,dy)||1,startTheta=Math.atan2(dy,dx),comet=source.classList.contains('elo-space-comet'),dir=index%2?1:-1;
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.classList.add('elo-gravity-v10-clone');Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,transform:'none',visibility:'visible',opacity:getComputedStyle(source).opacity||'1'});document.body.appendChild(clone);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const steps=comet?38:26,frames=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps;
  let infall;
  if(t<.34){const q=t/.34;infall=.065*q*q;}else{const q=(t-.34)/.66;infall=.065+.935*Math.pow(smoothstep(q),1.18)}
  const radius=dist*Math.max(.012,1-.988*infall);
  const turnProgress=1-Math.pow(1-t,1.28);
  const turns=(comet?.88:.72)*turnProgress;
  const theta=startTheta+dir*turns*Math.PI*2;
  const x=hx+Math.cos(theta)*radius,y=hy+Math.sin(theta)*radius,tx=x-cx,ty=y-cy;
  const tangent=(theta+dir*Math.PI/2)*180/Math.PI;
  const spaghetti=smoothstep((t-.62)/.38);
  const stretch=1+(comet?7.8:9.2)*Math.pow(spaghetti,2.15),thin=Math.max(comet?.028:.018,1-(comet?.972:.982)*Math.pow(spaghetti,1.72));
  const fade=t<.86?1:Math.max(0,1-(t-.86)/.14);
  const brightness=1+1.15*Math.pow(spaghetti,1.55);
  frames.push({transform:`translate3d(${tx}px,${ty}px,0) rotate(${tangent}deg) scale(${stretch},${thin})`,opacity:fade,filter:`brightness(${brightness})${t>.94?' blur(.45px)':''}`,offset:t});
 }
 frames[frames.length-1]={transform:`translate3d(${hx-cx}px,${hy-cy}px,0) rotate(${(startTheta+dir*(comet?.88:.72)*Math.PI*2)*180/Math.PI}deg) scale(${comet?'9,.018':'10.5,.012'})`,opacity:0,filter:'brightness(2.25) blur(.8px)',offset:1};
 const duration=(comet?4550:3500)+Math.min(comet?1550:950,dist*(comet?1.08:.76))+(index%4)*45;
 try{const a=clone.animate(frames,{duration,easing:'linear',fill:'forwards'});return a.finished.catch(()=>{}).finally(()=>{clone.remove();source.style.visibility=oldVisibility})}catch(_){clone.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}
function pullV10(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV10==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityV10='1';hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible),particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?10:18);
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>gravitySmoothSpiral(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV10;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});return true;
}
function install(){const fn=e=>pullV10(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;window.reactCelestialBlackHole=fn}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();setTimeout(install,800);setTimeout(install,1800);
console.info('[Elo] V36.11.19 · gravidade V10 suave + contraste forte da HOME Museu.');

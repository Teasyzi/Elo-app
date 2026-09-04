// Elo V36.11.24 · gravidade clássica com alvo físico exato no centro do horizonte.
const VERSION='36.11.24';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleExactTarget:true,blackHoleFixedClonePath:true};

const style=document.createElement('style');
style.textContent=`
.elo-gravity-v24-clone{
 position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;
 pointer-events:none!important;z-index:2147481768!important;
 animation:none!important;transition:none!important;
 transform:none!important;translate:none!important;rotate:none!important;scale:none!important;
 transform-origin:50% 50%!important;will-change:transform,opacity,filter!important
}
`;
document.head.appendChild(style);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){
 const core=hole?.querySelector?.('.elo-black-hole-core');
 const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();
 return{x:r.left+r.width/2,y:r.top+r.height/2};
}

/*
 O clone fixo começa exatamente no retângulo VISUAL do objeto. Assim, qualquer transform/translate
 usado originalmente pelo cometa não entra de novo no cálculo da trajetória. O último frame leva
 o centro geométrico do clone exatamente ao centro do horizonte do buraco negro.
*/
function exactClassicGravity(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const comet=source.classList.contains('elo-space-comet'),angle=Math.atan2(dy,dx)*180/Math.PI,side=index%2?1:-1;
 const px=-dy/dist,py=dx/dist,bend=Math.min(comet?76:50,dist*(comet?.115:.08))*side;
 const duration=(comet?4100:3250)+Math.min(comet?2500:1800,dist*(comet?1.82:1.38))+(index%6)*45;
 const delay=Math.min(260,(index%9)*24),startOpacity=getComputedStyle(source).opacity||'1';
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.classList.add('elo-gravity-v24-clone');
 Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,visibility:'visible',opacity:startOpacity});
 document.body.appendChild(clone);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const at=(p,t)=>({x:dx*p+px*bend*t,y:dy*p+py*bend*t});
 const make=(p,t,rot,sx,sy,opacity,brightness,blur,offset)=>{const q=at(p,t);return{transform:`translate3d(${q.x}px,${q.y}px,0) rotate(${rot}deg) scale(${sx},${sy})`,opacity,filter:`brightness(${brightness})${blur?` blur(${blur}px)`:''}`,offset}};
 const frames=[
  {transform:'translate3d(0,0,0) rotate(0deg) scale(1,1)',opacity:startOpacity,filter:'brightness(1)',offset:0},
  make(.045,.34,angle*.035,1.01,.995,.99,1.01,0,.20),
  make(.13,.54,angle*.10,comet?1.04:1.035,comet?.97:.975,1,1.04,0,.40),
  make(.29,.62,angle*.24,comet?1.10:1.13,comet?.91:.90,1,1.08,0,.60),
  make(.53,.50,angle*.48,comet?1.28:1.38,comet?.76:.72,.99,1.16,0,.77),
  make(.76,.28,angle*.73,comet?1.64:1.84,comet?.54:.48,.91,1.28,0,.89),
  make(.92,.08,angle*.93,comet?2.35:2.70,comet?.31:.26,.62,1.45,.16,.97),
  // Centro do clone = centro exato do horizonte. Sem curva residual no último frame.
  {transform:`translate3d(${dx}px,${dy}px,0) rotate(${angle}deg) scale(${comet?'3.2,.14':'3.7,.10'})`,opacity:0,filter:'brightness(1.62) blur(.42px)',offset:1}
 ];
 try{
  const a=clone.animate(frames,{duration,delay,easing:'cubic-bezier(.18,.56,.22,1)',fill:'forwards'});
  return a.finished.catch(()=>{}).finally(()=>{clone.remove();source.style.visibility=oldVisibility});
 }catch(_){clone.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}

function pullExact(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityExact==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityExact='1';
 hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
 const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible);
 const targets=[...comets,...particles];
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled(targets.map((el,i)=>exactClassicGravity(el,hx,hy,i))).finally(()=>{
  delete fx.dataset.eloGravityExact;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active');
 });
 return true;
}
function install(){
 const fn=e=>pullExact(e);
 fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;fn.__eloBhV12=true;fn.__eloBhClassic=true;fn.__eloBhClassicV2=true;fn.__eloBhExact=true;
 window.reactCelestialBlackHole=fn;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,2100);setTimeout(install,3100);setTimeout(install,4100);setTimeout(install,5200);
console.info('[Elo] V36.11.24 · cometas e partículas agora terminam no centro exato do horizonte.');

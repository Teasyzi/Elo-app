// Elo V36.11.26 · restaura estrelas do Celestial e mantém cometas no alvo exato.
const VERSION='36.11.26';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleStarsRestored:true,blackHoleHybridPull:true};

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}

function animateParticleDirect(el,hx,hy,index){
 const r=el.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const angle=Math.atan2(dy,dx)*180/Math.PI,side=index%2?1:-1,px=-dy/dist,py=dx/dist;
 const bend=Math.min(48,dist*.075)*side;
 const duration=3200+Math.min(1700,dist*1.28)+(index%7)*36;
 const at=(p,t)=>`${dx*p+px*bend*t}px ${dy*p+py*bend*t}px`;
 const startOpacity=getComputedStyle(el).opacity||'1';
 try{return el.animate([
  {translate:'0px 0px',rotate:'0deg',scale:'1 1',opacity:startOpacity,filter:'brightness(1)',offset:0},
  {translate:at(.05,.28),rotate:`${angle*.03}deg`,scale:'1.01 .99',opacity:.99,filter:'brightness(1.02)',offset:.20},
  {translate:at(.15,.46),rotate:`${angle*.10}deg`,scale:'1.04 .96',opacity:1,filter:'brightness(1.05)',offset:.42},
  {translate:at(.34,.55),rotate:`${angle*.28}deg`,scale:'1.12 .88',opacity:1,filter:'brightness(1.10)',offset:.64},
  {translate:at(.60,.42),rotate:`${angle*.54}deg`,scale:'1.35 .68',opacity:.96,filter:'brightness(1.18)',offset:.80},
  {translate:at(.82,.20),rotate:`${angle*.80}deg`,scale:'1.75 .44',opacity:.82,filter:'brightness(1.30)',offset:.91},
  {translate:at(.94,.05),rotate:`${angle*.95}deg`,scale:'2.25 .24',opacity:.55,filter:'brightness(1.44) blur(.12px)',offset:.975},
  {translate:`${dx}px ${dy}px`,rotate:`${angle}deg`,scale:'2.8 .12',opacity:0,filter:'brightness(1.58) blur(.30px)',offset:1}
 ],{duration,easing:'cubic-bezier(.18,.56,.22,1)',fill:'none'}).finished.catch(()=>{})}catch(_){return Promise.resolve()}
}

function animateCometWrapper(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
 const angle=Math.atan2(dy,dx)*180/Math.PI,side=index%2?1:-1,px=-dy/dist,py=dx/dist;
 const bend=Math.min(78,dist*.12)*side;
 const duration=4100+Math.min(2500,dist*1.82)+(index%6)*45;
 const startOpacity=getComputedStyle(source).opacity||'1';
 const wrap=document.createElement('div');
 Object.assign(wrap.style,{position:'fixed',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,margin:'0',padding:'0',pointerEvents:'none',zIndex:'2147481769',transformOrigin:'50% 50%',willChange:'transform,opacity,filter',opacity:startOpacity});
 const clone=source.cloneNode(true);clone.removeAttribute('id');
 Object.assign(clone.style,{position:'absolute',left:'0',top:'0',right:'auto',bottom:'auto',margin:'0',width:`${r.width}px`,height:`${r.height}px`,animation:'none',transition:'none',transform:'none',translate:'none',rotate:'none',scale:'none',visibility:'visible',opacity:'1'});
 wrap.appendChild(clone);document.body.appendChild(wrap);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const at=(p,t)=>({x:dx*p+px*bend*t,y:dy*p+py*bend*t});
 const frame=(p,t,rot,sx,sy,opacity,brightness,blur,offset)=>{const q=at(p,t);return{transform:`translate3d(${q.x}px,${q.y}px,0) rotate(${rot}deg) scale(${sx},${sy})`,opacity,filter:`brightness(${brightness})${blur?` blur(${blur}px)`:''}`,offset}};
 const frames=[
  {transform:'translate3d(0,0,0) rotate(0deg) scale(1,1)',opacity:startOpacity,filter:'brightness(1)',offset:0},
  frame(.045,.34,angle*.035,1.01,.995,.99,1.01,0,.20),
  frame(.13,.54,angle*.10,1.04,.97,1,1.04,0,.40),
  frame(.29,.62,angle*.24,1.10,.91,1,1.08,0,.60),
  frame(.53,.50,angle*.48,1.28,.76,.99,1.16,0,.77),
  frame(.76,.28,angle*.73,1.64,.54,.91,1.28,0,.89),
  frame(.92,.08,angle*.93,2.35,.31,.62,1.45,.16,.97),
  {transform:`translate3d(${dx}px,${dy}px,0) rotate(${angle}deg) scale(3.2,.14)`,opacity:0,filter:'brightness(1.62) blur(.42px)',offset:1}
 ];
 try{const anim=wrap.animate(frames,{duration,easing:'cubic-bezier(.18,.56,.22,1)',fill:'forwards'});return anim.finished.catch(()=>{}).finally(()=>{wrap.remove();source.style.visibility=oldVisibility})}catch(_){wrap.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}

function pull(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV26==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityV26='1';
 hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
 const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible);
 const jobs=[...comets.map((el,i)=>animateCometWrapper(el,hx,hy,i)),...particles.map((el,i)=>animateParticleDirect(el,hx,hy,i+comets.length))];
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled(jobs).finally(()=>{delete fx.dataset.eloGravityV26;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});
 return true;
}
function install(){const fn=e=>pull(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;fn.__eloBhV12=true;fn.__eloBhClassic=true;fn.__eloBhClassicV2=true;fn.__eloBhExact=true;fn.__eloBhV25=true;fn.__eloBhV26=true;window.reactCelestialBlackHole=fn}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
setTimeout(install,2300);setTimeout(install,3500);setTimeout(install,4800);setTimeout(install,6200);
console.info('[Elo] V36.11.26 · estrelas restauradas; cometas usam wrapper e partículas animam no DOM original.');

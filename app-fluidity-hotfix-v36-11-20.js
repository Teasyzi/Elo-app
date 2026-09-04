// Elo V36.11.20 · seleção Celestial estável + gravidade cinematográfica em curva contínua.
const VERSION='36.11.20';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleV11:true,blackHoleCinematicInfall:true,celestialThemeStudioFix:true};

const style=document.createElement('style');
style.textContent=`
.elo-gravity-v11-clone{position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;pointer-events:none!important;z-index:2147481760!important;animation:none!important;transition:none!important;will-change:transform,opacity,filter!important;transform-origin:50% 50%!important}
.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-photon{opacity:.72!important;filter:brightness(1.12)!important}
.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-disk-near{filter:brightness(1.10) drop-shadow(0 0 5px rgba(255,220,165,.32))!important}
`;
document.head.appendChild(style);

function uid(){return window.currentUser?.uid||''}
function themeKey(){return`elo_theme_${uid()||'device'}`}
function ownedKey(){return`elo_theme_owned_${uid()||'device'}`}
function ownedThemes(){try{return new Set(['akai',...JSON.parse(localStorage.getItem(ownedKey())||'[]'),'red','blue','green','museum','cinema','rustic'])}catch(_){return new Set(['akai','red','blue','green','museum','cinema','rustic'])}}
function closeLegacyThemeModalSoon(){
 const close=()=>{const modal=document.getElementById('generic-modal');if(modal?.querySelector?.('.elo-theme-studio')){try{window.closeGenericModal?.()}catch(_){modal.classList.add('hidden')}}};
 close();setTimeout(close,40);setTimeout(close,140);
}

/*
 O Studio V2 já recebe o click antes do listener original. Interceptamos somente temas que
 podem ser aplicados imediatamente. Isso impede o Celestial de disparar o Studio legado logo
 depois da seleção e evita a sensação de "outra aba de temas".
*/
document.addEventListener('click',async e=>{
 const row=e.target.closest?.('#elo-theme-studio-v2 [data-theme-id]');
 if(!row||e.target.closest?.('[data-preview-theme],[data-buy-theme]'))return;
 const id=row.dataset.themeId;if(!id)return;
 const owned=ownedThemes();
 const free=['akai','red','blue','green','museum','cinema','rustic'].includes(id);
 if(!free&&!owned.has(id))return;
 e.preventDefault();e.stopImmediatePropagation();
 row.disabled=true;
 try{
   window.closeThemeStudioV2?.();
   closeLegacyThemeModalSoon();
   await window.selectEloTheme?.(id);
   closeLegacyThemeModalSoon();
   if(localStorage.getItem(themeKey())===id)requestAnimationFrame(()=>window.updateUI?.());
 }catch(err){console.error('[Elo] aplicar tema',err)}finally{row.disabled=false}
},true);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function lerpAngle(a,b,t){let d=(b-a+540)%360-180;return a+d*t}
function cubic(p0,p1,p2,p3,t){const m=1-t;return m*m*m*p0+3*m*m*t*p1+3*m*t*t*p2+t*t*t*p3}

function cinematicInfall(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1,comet=source.classList.contains('elo-space-comet');
 const nx=dx/dist,ny=dy/dist,px=-ny,py=nx,side=index%2?1:-1;
 const margin=18,vw=innerWidth||document.documentElement.clientWidth,vh=innerHeight||document.documentElement.clientHeight;
 const bend=Math.min(comet?96:64,Math.max(comet?34:24,dist*(comet?.15:.10)));
 const p0x=cx,p0y=cy;
 const p1x=clamp(cx+dx*.20+px*bend*side,margin,vw-margin),p1y=clamp(cy+dy*.20+py*bend*side,margin,vh-margin);
 const p2x=clamp(cx+dx*.64+px*bend*.58*side,margin,vw-margin),p2y=clamp(cy+dy*.64+py*bend*.58*side,margin,vh-margin);
 const p3x=hx,p3y=hy;
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.classList.add('elo-gravity-v11-clone');
 Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,transform:'none',visibility:'visible',opacity:getComputedStyle(source).opacity||'1'});
 document.body.appendChild(clone);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const frames=[],steps=comet?52:34;
 for(let i=0;i<=steps;i++){
   const t=i/steps;
   // Começa elegante e lento, depois acelera para o horizonte.
   const u=Math.pow(t,1.48);
   const x=cubic(p0x,p1x,p2x,p3x,u),y=cubic(p0y,p1y,p2y,p3y,u),tx=x-cx,ty=y-cy;
   const eps=.012,u2=Math.min(1,u+eps),x2=cubic(p0x,p1x,p2x,p3x,u2),y2=cubic(p0y,p1y,p2y,p3y,u2),motion=Math.atan2(y2-y,x2-x)*180/Math.PI;
   const radial=Math.atan2(hy-y,hx-x)*180/Math.PI;
   const spaghetti=clamp((t-.70)/.30,0,1),sp=spaghetti*spaghetti*(3-2*spaghetti);
   const rotation=lerpAngle(motion,radial,sp*.92);
   // Espaguetificação só perto do horizonte: alonga na direção do buraco negro sem virar uma linha absurda.
   const stretch=1+(comet?4.8:5.6)*Math.pow(sp,1.65),thin=Math.max(comet?.14:.10,1-(comet?.86:.90)*Math.pow(sp,1.45));
   const fade=t<.93?1:Math.max(0,1-(t-.93)/.07);
   const brightness=1+.55*Math.pow(sp,1.35);
   const blur=t>.965?` blur(${((t-.965)/.035)*.45}px)`:'';
   frames.push({transform:`translate3d(${tx}px,${ty}px,0) rotate(${rotation}deg) scale(${stretch},${thin})`,opacity:fade,filter:`brightness(${brightness})${blur}`,offset:t});
 }
 const finalAngle=Math.atan2(hy-cy,hx-cx)*180/Math.PI;
 frames[frames.length-1]={transform:`translate3d(${hx-cx}px,${hy-cy}px,0) rotate(${finalAngle}deg) scale(${comet?'6.2,.11':'7,.08'})`,opacity:0,filter:'brightness(1.7) blur(.55px)',offset:1};
 const duration=(comet?4300:3250)+Math.min(comet?1250:850,dist*(comet?1.0:.72))+(index%4)*40;
 try{const a=clone.animate(frames,{duration,easing:'linear',fill:'forwards'});return a.finished.catch(()=>{}).finally(()=>{clone.remove();source.style.visibility=oldVisibility})}catch(_){clone.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}

function pullV11(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV11==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityV11='1';hole.classList.add('is-gravity-active','is-feeding');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible),particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?8:14);
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>cinematicInfall(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV11;hole.classList.remove('is-gravity-active','is-feeding');fx.classList.remove('elo-gravity-surge','is-gravity-active')});
 return true;
}
function install(){const fn=e=>pullV11(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;window.reactCelestialBlackHole=fn}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();setTimeout(install,750);setTimeout(install,1700);
console.info('[Elo] V36.11.20 · Celestial estável + gravidade cinematográfica em curva contínua.');

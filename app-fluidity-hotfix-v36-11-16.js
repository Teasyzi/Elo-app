// Elo V36.11.16 · foco em estabilidade de uso: Temas sempre acessíveis + gravidade orbital/espaguetificação.
const VERSION='36.11.16';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleV9:true,blackHoleOrbitInfall:true,themeStudioV2:true,themeStudioReliable:true};

const THEME_ROWS={
 akai:{name:'Akai Ito',icon:'🧵',price:0},sakura:{name:'Sakura',icon:'🌸',price:1200},midnight:{name:'Midnight',icon:'🌙',price:1700},cozy:{name:'Cozy',icon:'🧸',price:800},celestial:{name:'Galáxia Celestial',icon:'🕳️',price:3200},
 red:{name:'Vermelho',icon:'♦️',price:0},blue:{name:'Azul',icon:'💧',price:0},green:{name:'Verde',icon:'🌿',price:0},museum:{name:'Museu',icon:'🏛️',price:0},cinema:{name:'Cinema Noir',icon:'🎞️',price:0},rustic:{name:'Rústico',icon:'🪵',price:0}
};
const uid=()=>window.currentUser?.uid||'';
const themeKey=()=>`elo_theme_${uid()||'device'}`;
const ownedKey=()=>`elo_theme_owned_${uid()||'device'}`;
const ownedThemes=()=>{try{return new Set(['akai',...JSON.parse(localStorage.getItem(ownedKey())||'[]'),'red','blue','green','museum','cinema','rustic'])}catch(_){return new Set(['akai','red','blue','green','museum','cinema','rustic'])}};

const style=document.createElement('style');
style.textContent=`
#elo-theme-studio-v2{position:fixed;inset:0;z-index:2147483600;background:rgba(2,6,23,.82);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;padding:10px}
#elo-theme-studio-v2 .elo-ts-panel{width:min(100%,460px);max-height:90dvh;overflow:auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:26px;padding:16px;color:#e5e7eb;box-shadow:0 28px 90px rgba(0,0,0,.58)}
#elo-theme-studio-v2 .elo-ts-head{position:sticky;top:-16px;z-index:3;margin:-16px -16px 12px;padding:16px;background:rgba(15,23,42,.96);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,.12)}
#elo-theme-studio-v2 .elo-ts-head h3{font-size:18px;font-weight:900;color:#fff}#elo-theme-studio-v2 .elo-ts-head p{font-size:9px;color:#94a3b8;margin-top:2px}
#elo-theme-studio-v2 .elo-ts-close{width:36px;height:36px;border-radius:12px;background:#1e293b;color:#cbd5e1;font-weight:900}
#elo-theme-studio-v2 .elo-ts-grid{display:grid;gap:8px}.elo-ts-row{display:flex;align-items:center;gap:11px;width:100%;padding:12px;border-radius:16px;background:#111827;border:1px solid #263244;text-align:left;color:#fff}.elo-ts-row.is-current{border-color:#ec4899;background:rgba(236,72,153,.09)}.elo-ts-row .ico{font-size:22px;width:32px;text-align:center}.elo-ts-row .txt{min-width:0;flex:1}.elo-ts-row b{display:block;font-size:12px}.elo-ts-row small{display:block;font-size:9px;color:#94a3b8;margin-top:2px}.elo-ts-row em{font-style:normal;font-size:9px;font-weight:900;color:#f9a8d4}.elo-ts-custom{margin-top:10px;width:100%;padding:12px;border-radius:15px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:11px;font-weight:900}
/* V9: durante o clique, o horizonte permanece negro e o disco responde só o suficiente para parecer ativo. */
.elo-theme-celestial .elo-black-hole.is-feeding .elo-black-hole-core{box-shadow:0 0 0 1px rgba(255,245,225,.16),0 0 10px rgba(255,210,138,.16),0 0 22px rgba(255,176,70,.08)!important}
.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-photon{filter:brightness(1.18);opacity:.76!important}.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-disk-far,.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-disk-near{filter:brightness(1.12) drop-shadow(0 0 5px rgba(255,211,145,.36))!important}
.elo-gravity-v9-clone{position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;pointer-events:none!important;z-index:2147481700!important;animation:none!important;transition:none!important;will-change:transform,opacity,filter!important;transform-origin:50% 50%!important}
@media(max-width:520px){#elo-theme-studio-v2{padding:0;align-items:flex-end}#elo-theme-studio-v2 .elo-ts-panel{max-height:94dvh;border-radius:24px 24px 0 0;border-bottom:0}}
`;
document.head.appendChild(style);

function closeThemeStudioV2(){document.getElementById('elo-theme-studio-v2')?.remove()}
window.closeThemeStudioV2=closeThemeStudioV2;
function themeLabel(id,t,current,owned){if(id===current)return'Usando';if(owned.has(id))return'Usar';return t.price?`${t.price} 🪙`:'Grátis'}
function openThemeStudioV2(){
 closeThemeStudioV2();
 const current=localStorage.getItem(themeKey())||'akai',owned=ownedThemes();
 const overlay=document.createElement('div');overlay.id='elo-theme-studio-v2';
 overlay.innerHTML=`<div class="elo-ts-panel"><div class="elo-ts-head"><div><h3>Temas do Elo</h3><p>Troque quantas vezes quiser sem reiniciar o app.</p></div><button class="elo-ts-close" type="button" aria-label="Fechar">✕</button></div><div class="elo-ts-grid">${Object.entries(THEME_ROWS).map(([id,t])=>`<button type="button" class="elo-ts-row ${id===current?'is-current':''}" data-theme-id="${id}"><span class="ico">${t.icon}</span><span class="txt"><b>${t.name}</b><small>${t.price&&!owned.has(id)?'Tema premium':'Tema disponível'}</small></span><em>${themeLabel(id,t,current,owned)}</em></button>`).join('')}</div><button type="button" class="elo-ts-custom">🎨 Criar / editar meu tema</button></div>`;
 overlay.addEventListener('click',async e=>{
   if(e.target===overlay||e.target.closest('.elo-ts-close'))return closeThemeStudioV2();
   const custom=e.target.closest('.elo-ts-custom');if(custom){closeThemeStudioV2();try{window.openCustomThemeCreator?.()}catch(_){}return}
   const row=e.target.closest('[data-theme-id]');if(!row)return;
   const id=row.dataset.themeId;if(!id||id===localStorage.getItem(themeKey()))return;
   row.disabled=true;
   try{await window.selectEloTheme?.(id)}catch(err){console.error('[Elo] selecionar tema',err)}
   setTimeout(()=>{
     row.disabled=false;
     const now=localStorage.getItem(themeKey());
     if(now===id){closeThemeStudioV2();requestAnimationFrame(()=>window.updateUI?.())}
     else{const em=row.querySelector('em');if(em)em.textContent='Não aplicado'}
   },80);
 });
 document.body.appendChild(overlay);
}
window.openThemeStudioV2=openThemeStudioV2;

/* O guard antigo de duplo toque não deve controlar o botão de Temas. Removemos a marca antes do click. */
function stripThemeTapGuard(btn){if(!btn)return;btn.removeAttribute('data-elo-single-tap');btn.dataset.eloLastTap='0';btn.disabled=false}
document.addEventListener('pointerdown',e=>stripThemeTapGuard(e.target.closest?.('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child')),true);
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child');if(!btn)return;
 stripThemeTapGuard(btn);e.preventDefault();e.stopImmediatePropagation();openThemeStudioV2();
},true);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,turns,radiusFactor,stretch,thin,opacity,brightness){
 const theta=startTheta+dir*turns*Math.PI*2,rr=dist*radiusFactor,x=hx+Math.cos(theta)*rr,y=hy+Math.sin(theta)*rr,tx=x-cx,ty=y-cy,tangent=(theta+dir*Math.PI/2)*180/Math.PI;
 return{transform:`translate3d(${tx}px,${ty}px,0) rotate(${tangent}deg) scale(${stretch},${thin})`,opacity,filter:`brightness(${brightness})`};
}
function gravityOrbitAnimation(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2,dx=cx-hx,dy=cy-hy,dist=Math.hypot(dx,dy)||1,startTheta=Math.atan2(dy,dx),comet=source.classList.contains('elo-space-comet'),dir=index%2?1:-1;
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.classList.add('elo-gravity-v9-clone');Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,transform:'none',visibility:'visible',opacity:getComputedStyle(source).opacity||'1'});document.body.appendChild(clone);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const frames=[
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,0,1,1,1,.96,1),offset:0},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,.18,.95,1.02,.98,.98,1.03),offset:.16},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,.42,.84,1.06,.94,1,1.08),offset:.32},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,.69,.70,1.12,.88,1,1.14),offset:.48},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,.94,.52,comet?1.28:1.35,.70,.98,1.24),offset:.64},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,1.12,.31,comet?1.75:2.0,.48,.92,1.42),offset:.78},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,1.23,.14,comet?3.0:3.6,.22,.72,1.68),offset:.90},
  {...orbitalFrame(hx,hy,cx,cy,startTheta,dist,dir,1.28,.045,comet?5.8:6.8,.07,.34,1.95),offset:.97},
  {transform:`translate3d(${hx-cx}px,${hy-cy}px,0) rotate(${(startTheta+dir*1.3*Math.PI*2)*180/Math.PI}deg) scale(${comet?'9,.018':'10.5,.012'})`,opacity:0,filter:'brightness(2.2) blur(.8px)',offset:1}
 ];
 const duration=(comet?4700:3700)+Math.min(comet?1800:1200,dist*(comet?1.2:.9))+(index%4)*55;
 try{const a=clone.animate(frames,{duration,easing:'linear',fill:'forwards'});return a.finished.catch(()=>{}).finally(()=>{clone.remove();source.style.visibility=oldVisibility})}catch(_){clone.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}
function pullV9(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV9==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityV9='1';hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible),particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?14:26);window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>gravityOrbitAnimation(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV9;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});return true;
}
function installGravityV9(){const fn=e=>pullV9(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;window.reactCelestialBlackHole=fn}
function refresh(){document.querySelectorAll('#profile-theme-button,#profile-modal .elo-profile-quickbar button:last-child').forEach(stripThemeTapGuard);installGravityV9()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();setTimeout(refresh,700);setTimeout(refresh,1800);
console.info('[Elo] V36.11.16 · Tema Studio independente + gravidade orbital com infall e espaguetificação.');

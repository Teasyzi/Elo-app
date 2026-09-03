// Elo V36.11.9 · Fluidez fase 5 + interação gravitacional restaurada.
// Carregado depois de app.js e v36-11.js: atua somente nos hot paths visuais,
// sem duplicar Firebase, listeners de negócio ou persistência.
const VERSION='36.11.9';
const nativeInnerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
const state={chatPatches:0,chatFallbacks:0,mainWrites:0,mainSkips:0,scrollRestores:0,gravityRuns:0,observer:null,mainObserver:null,tuneRaf:0};
const lowEnd=!!window.ELO_FLUIDITY?.lowEnd||Number(navigator.hardwareConcurrency||4)<=4||Number(navigator.deviceMemory||4)<=4;
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,phase:5,lowEnd,chatIncremental:true,mainRenderGuard:true,blackHoleV3:true,stats:state};

const style=document.createElement('style');
style.textContent=`
/* V36.11.9 · Celestial: disco/lente vivos + espaguetificação visível. */
.elo-theme-celestial .elo-black-hole{isolation:isolate;overflow:visible!important}
.elo-theme-celestial .elo-black-hole .elo-bh-lens,.elo-theme-celestial .elo-black-hole .elo-bh-accretion,.elo-theme-celestial .elo-black-hole .elo-bh-photon,.elo-theme-celestial .elo-black-hole .elo-bh-dust{position:absolute;left:50%;top:50%;pointer-events:none;z-index:-1}
.elo-theme-celestial .elo-black-hole .elo-bh-lens{width:178%;height:178%;border-radius:50%;border:1px solid rgba(125,211,252,.26);box-shadow:0 0 18px rgba(56,189,248,.12),inset 0 0 13px rgba(168,85,247,.12);transform:translate(-50%,-50%) rotateX(64deg);animation:eloBhLensLive 5.8s ease-in-out infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-accretion{width:156%;height:48%;border-radius:50%;background:conic-gradient(from 95deg,transparent 0 11%,rgba(56,189,248,.12) 18%,rgba(216,180,254,.68) 30%,rgba(255,255,255,.9) 36%,rgba(244,114,182,.55) 43%,transparent 55% 72%,rgba(125,211,252,.34) 84%,transparent 100%);filter:blur(1.4px) drop-shadow(0 0 8px rgba(125,211,252,.35));transform:translate(-50%,-50%) rotate(-12deg);opacity:.72;animation:eloBhAccretion 4.6s linear infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-photon{width:124%;height:124%;border-radius:50%;border:1px solid rgba(255,255,255,.48);box-shadow:0 0 7px rgba(255,255,255,.32),0 0 18px rgba(167,139,250,.28);transform:translate(-50%,-50%);opacity:.58;animation:eloBhPhoton 3.2s ease-in-out infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-dust{width:3px;height:3px;border-radius:999px;background:#fff;box-shadow:0 0 6px #bae6fd,0 0 12px rgba(168,85,247,.75);transform-origin:0 0;opacity:.78}
.elo-theme-celestial .elo-black-hole .elo-bh-dust.d1{animation:eloBhDust1 3.8s linear infinite}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d2{animation:eloBhDust2 5.1s linear infinite reverse}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d3{animation:eloBhDust3 6.4s linear infinite}
.elo-theme-celestial .elo-black-hole.elo-bh-surge .elo-bh-lens{animation:eloBhSurgeLens 1.45s cubic-bezier(.16,.8,.24,1)}
.elo-theme-celestial .elo-black-hole.elo-bh-surge .elo-bh-accretion{filter:brightness(1.75) blur(.7px) drop-shadow(0 0 15px rgba(125,211,252,.65));animation-duration:1.6s}
.elo-theme-celestial #elo-theme-fx.elo-gravity-surge::after{opacity:.68!important;transition:opacity .22s ease}
.elo-theme-celestial #elo-theme-fx.elo-gravity-surge .elo-space-particle,.elo-theme-celestial #elo-theme-fx.elo-gravity-surge .elo-space-comet{will-change:translate,rotate,scale,opacity,filter}
@keyframes eloBhLensLive{0%,100%{opacity:.36;scale:.96}50%{opacity:.72;scale:1.05}}
@keyframes eloBhAccretion{to{rotate:360deg}}
@keyframes eloBhPhoton{0%,100%{opacity:.38;scale:.98}50%{opacity:.72;scale:1.04}}
@keyframes eloBhDust1{from{transform:rotate(0deg) translateX(48px) scale(.7)}to{transform:rotate(360deg) translateX(48px) scale(1.15)}}
@keyframes eloBhDust2{from{transform:rotate(0deg) translateX(38px) scale(.75)}to{transform:rotate(360deg) translateX(38px) scale(1)}}
@keyframes eloBhDust3{from{transform:rotate(0deg) translateX(56px) scale(.55)}to{transform:rotate(360deg) translateX(56px) scale(1.05)}}
@keyframes eloBhSurgeLens{0%{opacity:.35;scale:.92}32%{opacity:1;scale:1.24}70%{opacity:.78;scale:1.08}100%{opacity:.42;scale:1}}
/* Pintura sob demanda fora da viewport. Mantém o layout, mas evita custo visual desnecessário. */
#main-content[data-elo-fluid-tab="home"]>.elo-home-panel,#main-content[data-elo-fluid-tab="quests"]>*,#main-content[data-elo-fluid-tab="store"] .elo-store-card,#main-content[data-elo-fluid-tab="inventory"]>*,#main-content[data-elo-fluid-tab="friends"]>*{content-visibility:auto;contain-intrinsic-size:96px}
#main-content[data-elo-fluid-tab="chat"] .elo-message-row{contain:layout style}
@media(max-width:520px){.elo-theme-celestial .elo-black-hole .elo-bh-lens{width:164%;height:164%}.elo-theme-celestial .elo-black-hole .elo-bh-accretion{width:148%}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d3{display:none}}
.elo-lite-device .elo-black-hole .elo-bh-dust.d2,.elo-lite-device .elo-black-hole .elo-bh-dust.d3{display:none!important}.elo-lite-device .elo-black-hole .elo-bh-accretion{filter:none!important;opacity:.55}
`;
document.head.appendChild(style);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function decorateBlackHole(){const hole=document.querySelector('.elo-theme-celestial .elo-black-hole');if(!hole||hole.dataset.eloBhV3==='1')return;hole.dataset.eloBhV3='1';hole.insertAdjacentHTML('beforeend','<span class="elo-bh-lens"></span><span class="elo-bh-accretion"></span><span class="elo-bh-photon"></span><i class="elo-bh-dust d1"></i><i class="elo-bh-dust d2"></i><i class="elo-bh-dust d3"></i>')}

function gravityAnimation(el,hx,hy,index){
  const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
  const comet=el.classList.contains('elo-space-comet');
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const duration=(comet?1750:1180)+Math.min(comet?1450:900,dist*(comet?1.18:.82))+(index%6)*28;
  const delay=Math.min(220,(index%8)*24);
  const startOpacity=getComputedStyle(el).opacity||'1';
  try{
    const anim=el.animate([
      {translate:'0px 0px',rotate:'0deg',scale:'1 1',opacity:startOpacity,filter:'brightness(1) blur(0px)',offset:0},
      {translate:`${dx*.10}px ${dy*.10}px`,rotate:`${angle*.18}deg`,scale:comet?'1.15 .92':'1.12 .9',opacity:.98,filter:'brightness(1.18) blur(0px)',offset:.20},
      {translate:`${dx*.38}px ${dy*.38}px`,rotate:`${angle*.58}deg`,scale:comet?'2.25 .52':'2.9 .42',opacity:1,filter:'brightness(1.45) blur(.1px)',offset:.48},
      {translate:`${dx*.73}px ${dy*.73}px`,rotate:`${angle*.9}deg`,scale:comet?'5.6 .14':'7.2 .10',opacity:.92,filter:'brightness(1.82) blur(.35px)',offset:.78},
      {translate:`${dx*.93}px ${dy*.93}px`,rotate:`${angle}deg`,scale:comet?'8.5 .045':'10.5 .028',opacity:.54,filter:'brightness(2.15) blur(.8px)',offset:.93},
      {translate:`${dx}px ${dy}px`,rotate:`${angle}deg`,scale:comet?'11 .012':'13 .008',opacity:0,filter:'brightness(2.5) blur(1.5px)',offset:1}
    ],{duration,delay,easing:'cubic-bezier(.12,.48,.08,1)',fill:'none'});
    return anim.finished.catch(()=>{});
  }catch(_){return Promise.resolve()}
}

function pullToBlackHole(event){const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV3==='1')return false;event?.preventDefault?.();event?.stopPropagation?.();decorateBlackHole();state.gravityRuns++;fx.dataset.eloGravityV3='1';
  hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active');void hole.offsetWidth;hole.classList.add('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.add('elo-gravity-surge','is-gravity-active');
  const hr=hole.getBoundingClientRect(),hx=hr.left+hr.width/2,hy=hr.top+hr.height/2;
  const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
  const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,lowEnd?24:46);
  const stars=[...fx.querySelectorAll(':scope > .elo-space-star')].filter(visible).filter((_,i)=>i%(lowEnd?5:3)===0).slice(0,lowEnd?6:18);
  const targets=[...comets,...particles,...stars];
  Promise.allSettled(targets.map((el,i)=>gravityAnimation(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV3;hole.classList.remove('is-gravity-active','is-feeding','elo-bh-surge');fx.classList.remove('elo-gravity-surge','is-gravity-active')});
  const flash=document.createElement('span');flash.style.cssText='position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;pointer-events:none;background:white;box-shadow:0 0 20px 9px rgba(125,211,252,.82),0 0 48px 20px rgba(168,85,247,.44);transform:translate(-50%,-50%);z-index:30';hole.appendChild(flash);flash.animate([{scale:'.15',opacity:0},{offset:.18,scale:'1.35',opacity:1},{offset:.55,scale:'2.1',opacity:.7},{scale:'4.2',opacity:0}],{duration:1280,easing:'ease-out'}).finished.finally(()=>flash.remove());
  return true;
}
function installBlackHoleHook(attempt=0){decorateBlackHole();const current=window.reactCelestialBlackHole;if(typeof current!=='function'){if(attempt<40)setTimeout(()=>installBlackHoleHook(attempt+1),250);return}if(current.__eloBhV3)return;const original=current.__eloOriginal||current;const wrapped=event=>{if(document.body.classList.contains('elo-theme-celestial')&&pullToBlackHole(event))return;return original(event)};wrapped.__eloBhV3=true;wrapped.__eloOriginal=original;window.reactCelestialBlackHole=wrapped}

// Chat incremental: preserva bolhas que realmente não mudaram.
function messageIds(root){return [...root.querySelectorAll('[data-chat-message]')].map(el=>el.dataset.chatMessage).filter(Boolean)}
function topRowForMessage(root,id){const bubble=[...root.querySelectorAll('[data-chat-message]')].find(el=>el.dataset.chatMessage===id);return bubble?.closest('.elo-message-row')||null}
function comparableRow(row){if(!row)return'';const c=row.cloneNode(true);c.querySelectorAll('[data-elo-gesture-bound]').forEach(n=>n.removeAttribute('data-elo-gesture-bound'));c.removeAttribute?.('data-elo-gesture-bound');return c.outerHTML}
function patchChatHtml(el,html){const template=document.createElement('template');template.innerHTML=String(html);const next=template.content;const oldIds=messageIds(el),newIds=messageIds(next);
  if(!oldIds.length||newIds.length<oldIds.length||!oldIds.every((id,i)=>newIds[i]===id)){state.chatFallbacks++;return nativeInnerHTML.set.call(el,html)}
  for(const id of oldIds){const oldRow=topRowForMessage(el,id),newRow=topRowForMessage(next,id);if(!oldRow||!newRow){state.chatFallbacks++;return nativeInnerHTML.set.call(el,html)}if(comparableRow(oldRow)!==comparableRow(newRow))oldRow.replaceWith(newRow.cloneNode(true))}
  const nextTyping=next.querySelector('.elo-typing-row');el.querySelector('.elo-typing-row')?.remove();
  if(newIds.length>oldIds.length){const lastOld=oldIds[oldIds.length-1],lastBubble=[...next.querySelectorAll('[data-chat-message]')].find(x=>x.dataset.chatMessage===lastOld),lastRow=lastBubble?.closest('.elo-message-row');let node=lastRow?.nextSibling;while(node){const copy=node.cloneNode(true);if(!(copy.nodeType===1&&copy.classList?.contains('elo-typing-row')))el.appendChild(copy);node=node.nextSibling}}
  if(nextTyping)el.appendChild(nextTyping.cloneNode(true));state.chatPatches++;return html
}
function patchChatElement(el){if(!el||el.dataset.eloIncrementalChat==='1'||!nativeInnerHTML?.set)return;el.dataset.eloIncrementalChat='1';Object.defineProperty(el,'innerHTML',{configurable:true,get(){return nativeInnerHTML.get.call(el)},set(html){return patchChatHtml(el,html)}})}

// Guarda do render principal: evita recriar uma aba quando o HTML resultante é idêntico
// (caso comum em updates de presença/lastSeen) e preserva scroll quando a mesma aba precisa redesenhar.
function patchMainElement(main){if(!main||main.dataset.eloMainRenderGuard==='1'||!nativeInnerHTML?.set)return;main.dataset.eloMainRenderGuard='1';let lastHtml=nativeInnerHTML.get.call(main),lastTab=window.activeTab||'home';Object.defineProperty(main,'innerHTML',{configurable:true,get(){return nativeInnerHTML.get.call(main)},set(html){const next=String(html),tab=window.activeTab||document.body?.dataset?.eloTab||'home';if(next===lastHtml){state.mainSkips++;return next}const sameTab=tab===lastTab,scroll=sameTab?main.scrollTop:0,active=document.activeElement,focusId=sameTab&&active&&main.contains(active)?active.id:'';state.mainWrites++;const out=nativeInnerHTML.set.call(main,html);lastHtml=next;lastTab=tab;if(sameTab&&scroll>0)requestAnimationFrame(()=>{main.scrollTop=scroll;state.scrollRestores++});if(focusId)requestAnimationFrame(()=>document.getElementById(focusId)?.focus?.({preventScroll:true}));queueTune();return out}})}

function tuneImages(root=document){for(const img of root.querySelectorAll?.('img:not([data-elo-fluid-image="1"])')||[]){img.dataset.eloFluidImage='1';img.decoding='async';if(!img.closest('#main-header,.elo-chat-header,.elo-floating-pet')&&!img.hasAttribute('loading'))img.loading='lazy'}}
function tuneRuntimeDom(){patchMainElement(document.getElementById('main-content'));patchChatElement(document.getElementById('chat-messages'));decorateBlackHole();const main=document.getElementById('main-content');if(main){main.dataset.eloFluidTab=window.activeTab||document.body?.dataset?.eloTab||'home';tuneImages(main)}}
function queueTune(){if(state.tuneRaf)return;state.tuneRaf=requestAnimationFrame(()=>{state.tuneRaf=0;tuneRuntimeDom()})}
function installRuntimeObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(queueTune);state.observer.observe(document.body,{childList:true});const main=document.getElementById('main-content');if(main){state.mainObserver=new MutationObserver(queueTune);state.mainObserver.observe(main,{childList:true})}tuneRuntimeDom()}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installRuntimeObserver();installBlackHoleHook()},{once:true});else{installRuntimeObserver();installBlackHoleHook()}
setTimeout(installBlackHoleHook,700);setTimeout(queueTune,1000);
console.info(`[Elo] V${VERSION} · espaguetificação gravitacional + fluidez fase 5 ativos.`);

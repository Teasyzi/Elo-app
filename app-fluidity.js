// Elo V36.11.8 · Camada segura de otimização do runtime principal.
// É carregada DEPOIS de app.js e v36-11.js para podermos otimizar hot paths
// sem duplicar Firebase, listeners ou regras de negócio do app.
const VERSION='36.11.8';
const nativeInnerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
const state={chatPatches:0,chatFallbacks:0,gravityRuns:0,observer:null};
const lowEnd=!!window.ELO_FLUIDITY?.lowEnd||Number(navigator.hardwareConcurrency||4)<=4||Number(navigator.deviceMemory||4)<=4;
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,phase:4,lowEnd,chatIncremental:true,blackHoleV2:true,stats:state};

const style=document.createElement('style');
style.textContent=`
/* V36.11.8 · Buraco negro vivo. Os elementos extras ficam dentro do próprio hole e não criam outro RAF. */
.elo-theme-celestial .elo-black-hole{isolation:isolate;overflow:visible!important}
.elo-theme-celestial .elo-black-hole .elo-bh-lens,.elo-theme-celestial .elo-black-hole .elo-bh-accretion,.elo-theme-celestial .elo-black-hole .elo-bh-photon,.elo-theme-celestial .elo-black-hole .elo-bh-dust{position:absolute;left:50%;top:50%;pointer-events:none;z-index:-1}
.elo-theme-celestial .elo-black-hole .elo-bh-lens{width:178%;height:178%;border-radius:50%;border:1px solid rgba(125,211,252,.26);box-shadow:0 0 18px rgba(56,189,248,.12),inset 0 0 13px rgba(168,85,247,.12);transform:translate(-50%,-50%) rotateX(64deg);animation:eloBhLensLive 5.8s ease-in-out infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-accretion{width:156%;height:48%;border-radius:50%;background:conic-gradient(from 95deg,transparent 0 11%,rgba(56,189,248,.12) 18%,rgba(216,180,254,.68) 30%,rgba(255,255,255,.9) 36%,rgba(244,114,182,.55) 43%,transparent 55% 72%,rgba(125,211,252,.34) 84%,transparent 100%);filter:blur(1.4px) drop-shadow(0 0 8px rgba(125,211,252,.35));transform:translate(-50%,-50%) rotate(-12deg);opacity:.72;animation:eloBhAccretion 4.6s linear infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-photon{width:124%;height:124%;border-radius:50%;border:1px solid rgba(255,255,255,.48);box-shadow:0 0 7px rgba(255,255,255,.32),0 0 18px rgba(167,139,250,.28);transform:translate(-50%,-50%);opacity:.58;animation:eloBhPhoton 3.2s ease-in-out infinite}
.elo-theme-celestial .elo-black-hole .elo-bh-dust{width:3px;height:3px;border-radius:999px;background:#fff;box-shadow:0 0 6px #bae6fd,0 0 12px rgba(168,85,247,.75);transform-origin:0 0;opacity:.78}
.elo-theme-celestial .elo-black-hole .elo-bh-dust.d1{animation:eloBhDust1 3.8s linear infinite}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d2{animation:eloBhDust2 5.1s linear infinite reverse}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d3{animation:eloBhDust3 6.4s linear infinite}
.elo-theme-celestial .elo-black-hole.elo-bh-surge .elo-bh-lens{animation:eloBhSurgeLens .92s cubic-bezier(.16,.8,.24,1)}
.elo-theme-celestial .elo-black-hole.elo-bh-surge .elo-bh-accretion{filter:brightness(1.8) blur(.8px) drop-shadow(0 0 15px rgba(125,211,252,.65))}
.elo-theme-celestial #elo-theme-fx.elo-gravity-surge::after{opacity:.66!important;transition:opacity .18s ease}
@keyframes eloBhLensLive{0%,100%{opacity:.36;scale:.96}50%{opacity:.72;scale:1.05}}
@keyframes eloBhAccretion{to{rotate:360deg}}
@keyframes eloBhPhoton{0%,100%{opacity:.38;scale:.98}50%{opacity:.72;scale:1.04}}
@keyframes eloBhDust1{from{transform:rotate(0deg) translateX(48px) scale(.7)}to{transform:rotate(360deg) translateX(48px) scale(1.15)}}
@keyframes eloBhDust2{from{transform:rotate(0deg) translateX(38px) scale(.75)}to{transform:rotate(360deg) translateX(38px) scale(1)}}
@keyframes eloBhDust3{from{transform:rotate(0deg) translateX(56px) scale(.55)}to{transform:rotate(360deg) translateX(56px) scale(1.05)}}
@keyframes eloBhSurgeLens{0%{opacity:.35;scale:.92}38%{opacity:1;scale:1.22}100%{opacity:.42;scale:1}}
@media(max-width:520px){.elo-theme-celestial .elo-black-hole .elo-bh-lens{width:164%;height:164%}.elo-theme-celestial .elo-black-hole .elo-bh-accretion{width:148%}.elo-theme-celestial .elo-black-hole .elo-bh-dust.d3{display:none}}
.elo-lite-device .elo-black-hole .elo-bh-dust.d2,.elo-lite-device .elo-black-hole .elo-bh-dust.d3{display:none!important}.elo-lite-device .elo-black-hole .elo-bh-accretion{filter:none!important;opacity:.55}
`;
document.head.appendChild(style);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function decorateBlackHole(){const hole=document.querySelector('.elo-theme-celestial .elo-black-hole');if(!hole||hole.dataset.eloBhV2==='1')return;hole.dataset.eloBhV2='1';hole.insertAdjacentHTML('beforeend','<span class="elo-bh-lens"></span><span class="elo-bh-accretion"></span><span class="elo-bh-photon"></span><i class="elo-bh-dust d1"></i><i class="elo-bh-dust d2"></i><i class="elo-bh-dust d3"></i>')}

function pullToBlackHole(event){const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial'))return false;event?.stopPropagation?.();decorateBlackHole();state.gravityRuns++;
  hole.classList.remove('is-gravity-active','elo-bh-surge');fx.classList.remove('elo-gravity-surge');void hole.offsetWidth;hole.classList.add('is-gravity-active','elo-bh-surge');fx.classList.add('elo-gravity-surge');
  const hr=hole.getBoundingClientRect(),hx=hr.left+hr.width/2,hy=hr.top+hr.height/2;
  const comets=[...fx.querySelectorAll('.elo-space-comet')].filter(visible);
  const particles=[...fx.querySelectorAll('.elo-space-particle')].filter(visible).slice(0,lowEnd?20:42);
  const stars=[...fx.querySelectorAll('.elo-space-star')].filter(visible).filter((_,i)=>i%(lowEnd?5:3)===0).slice(0,lowEnd?6:16);
  const targets=[...comets,...particles,...stars];
  targets.forEach((el,index)=>{
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=hx-cx,dy=hy-cy,dist=Math.hypot(dx,dy)||1;
    const comet=el.classList.contains('elo-space-comet'),duration=(comet?720:620)+Math.min(260,dist*.28)+(index%5)*18;
    // translate/scale individuais compõem com o transform do campo gravitacional existente.
    // Assim TODOS os cometas são puxados sem disputar o transform escrito pelo RAF da V36.11.
    try{el.animate([
      {translate:'0px 0px',scale:'1',opacity:getComputedStyle(el).opacity||'1',filter:'brightness(1)'},
      {offset:.42,translate:`${dx*.28}px ${dy*.28}px`,scale:comet?'1.1':'1.05',opacity:.95,filter:'brightness(1.45)'},
      {offset:.78,translate:`${dx*.76}px ${dy*.76}px`,scale:comet?'.58':'.45',opacity:.72,filter:'brightness(1.8)'},
      {translate:`${dx}px ${dy}px`,scale:'.06',opacity:0,filter:'brightness(2.2)'}
    ],{duration,easing:'cubic-bezier(.18,.72,.16,1)',fill:'none'})}catch(_){ }
  });
  const flash=document.createElement('span');flash.style.cssText='position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;pointer-events:none;background:white;box-shadow:0 0 18px 8px rgba(125,211,252,.8),0 0 42px 18px rgba(168,85,247,.42);transform:translate(-50%,-50%);z-index:30';hole.appendChild(flash);flash.animate([{scale:'.2',opacity:0},{offset:.28,scale:'1.4',opacity:1},{scale:'3.5',opacity:0}],{duration:760,easing:'ease-out'}).finished.finally(()=>flash.remove());
  setTimeout(()=>{hole.classList.remove('is-gravity-active','elo-bh-surge');fx.classList.remove('elo-gravity-surge')},1050);
  return true;
}

function installBlackHoleHook(attempt=0){decorateBlackHole();const current=window.reactCelestialBlackHole;if(typeof current!=='function'){if(attempt<40)setTimeout(()=>installBlackHoleHook(attempt+1),250);return}if(current.__eloBhV2)return;const original=current;const wrapped=(event)=>{if(document.body.classList.contains('elo-theme-celestial')&&pullToBlackHole(event))return;return original(event)};wrapped.__eloBhV2=true;wrapped.__eloOriginal=original;window.reactCelestialBlackHole=wrapped}

// Render incremental do Chat: intercepta somente a lista já montada pelo app.js.
// Em atualização normal (mesma sequência ou novas mensagens no final), preserva as bolhas existentes.
// Paginação para trás, exclusão/reordenação e mudanças estruturais continuam usando o render original como fallback.
function messageIds(root){return [...root.querySelectorAll('[data-chat-message]')].map(el=>el.dataset.chatMessage).filter(Boolean)}
function topRowForMessage(root,id){const bubble=[...root.querySelectorAll('[data-chat-message]')].find(el=>el.dataset.chatMessage===id);return bubble?.closest('.elo-message-row')||null}
function patchChatHtml(el,html){const template=document.createElement('template');template.innerHTML=String(html);const next=template.content;const oldIds=messageIds(el),newIds=messageIds(next);
  if(!oldIds.length||newIds.length<oldIds.length||!oldIds.every((id,i)=>newIds[i]===id)){state.chatFallbacks++;return nativeInnerHTML.set.call(el,html)}
  for(const id of oldIds){const oldRow=topRowForMessage(el,id),newRow=topRowForMessage(next,id);if(!oldRow||!newRow){state.chatFallbacks++;return nativeInnerHTML.set.call(el,html)}if(oldRow.outerHTML!==newRow.outerHTML)oldRow.replaceWith(newRow.cloneNode(true))}
  // Indicador de digitação é o único nó efêmero que não tem id de mensagem.
  const oldTyping=el.querySelector('.elo-typing-row'),newTyping=next.querySelector('.elo-typing-row');if(oldTyping&&!newTyping)oldTyping.remove();else if(!oldTyping&&newTyping)el.appendChild(newTyping.cloneNode(true));else if(oldTyping&&newTyping&&oldTyping.outerHTML!==newTyping.outerHTML)oldTyping.replaceWith(newTyping.cloneNode(true));
  if(newIds.length>oldIds.length){const lastOld=oldIds[oldIds.length-1],lastBubble=[...next.querySelectorAll('[data-chat-message]')].find(x=>x.dataset.chatMessage===lastOld),lastRow=lastBubble?.closest('.elo-message-row');let node=lastRow?.nextSibling;while(node){const copy=node.cloneNode(true);if(!(copy.nodeType===1&&copy.classList?.contains('elo-typing-row')))el.appendChild(copy);node=node.nextSibling}}
  state.chatPatches++;return html
}
function patchChatElement(el){if(!el||el.dataset.eloIncrementalChat==='1'||!nativeInnerHTML?.set)return;el.dataset.eloIncrementalChat='1';Object.defineProperty(el,'innerHTML',{configurable:true,get(){return nativeInnerHTML.get.call(el)},set(html){return patchChatHtml(el,html)}})}
function tuneRuntimeDom(){patchChatElement(document.getElementById('chat-messages'));decorateBlackHole()}
function installRuntimeObserver(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>requestAnimationFrame(tuneRuntimeDom));state.observer.observe(document.body,{childList:true,subtree:true});tuneRuntimeDom()}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installRuntimeObserver();installBlackHoleHook()},{once:true});else{installRuntimeObserver();installBlackHoleHook()}
setTimeout(installBlackHoleHook,700);setTimeout(tuneRuntimeDom,1000);
console.info(`[Elo] V${VERSION} · Buraco negro V2 + render incremental do Chat ativos.`);

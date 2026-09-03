// Elo V36.11.17 · restaura compra e prévia dos temas premium dentro do Theme Studio V2.
const VERSION='36.11.17';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,themePremiumActionsRestored:true};

const PREMIUM_THEME_IDS=new Set(['sakura','midnight','cozy','celestial']);
const uid=()=>window.currentUser?.uid||'';
const ownedKey=()=>`elo_theme_owned_${uid()||'device'}`;
const ownedThemes=()=>{try{return new Set(['akai',...JSON.parse(localStorage.getItem(ownedKey())||'[]'),'red','blue','green','museum','cinema','rustic'])}catch(_){return new Set(['akai','red','blue','green','museum','cinema','rustic'])}};

const style=document.createElement('style');
style.textContent=`
#elo-theme-studio-v2 .elo-ts-row.is-premium-locked{cursor:default}
#elo-theme-studio-v2 .elo-ts-premium-actions{display:flex;gap:6px;align-items:center;margin-left:auto}
#elo-theme-studio-v2 .elo-ts-premium-actions button{border:0;border-radius:10px;padding:8px 9px;font-size:9px;font-weight:900;white-space:nowrap}
#elo-theme-studio-v2 .elo-ts-test{background:#1e293b;color:#cbd5e1;border:1px solid #334155!important}
#elo-theme-studio-v2 .elo-ts-buy{background:#db2777;color:#fff}
#elo-theme-studio-v2 .elo-ts-buy:disabled,#elo-theme-studio-v2 .elo-ts-test:disabled{opacity:.55}
@media(max-width:420px){#elo-theme-studio-v2 .elo-ts-row.is-premium-locked{align-items:flex-start;flex-wrap:wrap}#elo-theme-studio-v2 .elo-ts-premium-actions{width:100%;margin-left:43px}.elo-ts-premium-actions button{flex:1}}
`;
document.head.appendChild(style);

function decoratePremiumRows(root=document){
 const overlay=root.id==='elo-theme-studio-v2'?root:root.querySelector?.('#elo-theme-studio-v2');
 if(!overlay)return;
 const owned=ownedThemes();
 overlay.querySelectorAll('[data-theme-id]').forEach(row=>{
  const id=row.dataset.themeId;
  if(!PREMIUM_THEME_IDS.has(id)||owned.has(id))return;
  if(row.querySelector('.elo-ts-premium-actions'))return;
  row.classList.add('is-premium-locked');
  row.disabled=false;
  const priceText=row.querySelector('em')?.textContent?.trim()||'';
  row.querySelector('em')?.remove();
  const actions=document.createElement('span');
  actions.className='elo-ts-premium-actions';
  actions.innerHTML=`<button type="button" class="elo-ts-test" data-preview-theme="${id}"><i class="ph-bold ph-eye"></i> Testar</button><button type="button" class="elo-ts-buy" data-buy-theme="${id}">${priceText||'Comprar'}</button>`;
  row.appendChild(actions);
 });
}

function refreshStudioSoon(){requestAnimationFrame(()=>decoratePremiumRows(document));setTimeout(()=>decoratePremiumRows(document),40)}

// Intercepta apenas os botões internos antes do listener do Studio V2 tratar a linha inteira.
document.addEventListener('click',async e=>{
 const preview=e.target.closest?.('[data-preview-theme]');
 if(preview){
  e.preventDefault();e.stopImmediatePropagation();
  const id=preview.dataset.previewTheme;if(!id)return;
  try{
   window.closeThemeStudioV2?.();
   if(typeof window.previewEloTheme==='function')window.previewEloTheme(id);
   else console.warn('[Elo] previewEloTheme indisponível');
  }catch(err){console.error('[Elo] testar tema premium',err)}
  return;
 }
 const buy=e.target.closest?.('[data-buy-theme]');
 if(buy){
  e.preventDefault();e.stopImmediatePropagation();
  const id=buy.dataset.buyTheme;if(!id)return;
  buy.disabled=true;
  try{
   await window.selectEloTheme?.(id);
   const owned=ownedThemes();
   if(owned.has(id)){
    window.closeThemeStudioV2?.();
    requestAnimationFrame(()=>window.updateUI?.());
   }else{
    buy.disabled=false;
    refreshStudioSoon();
   }
  }catch(err){buy.disabled=false;console.error('[Elo] comprar tema premium',err)}
 }
},true);

const observer=new MutationObserver(mutations=>{
 for(const m of mutations){for(const n of m.addedNodes){if(n?.nodeType===1&&(n.id==='elo-theme-studio-v2'||n.querySelector?.('#elo-theme-studio-v2'))){decoratePremiumRows(n.id==='elo-theme-studio-v2'?n:n.querySelector('#elo-theme-studio-v2'));return}}}
});
function boot(){if(document.body)observer.observe(document.body,{childList:true});refreshStudioSoon()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(refreshStudioSoon,900);
console.info('[Elo] V36.11.17 · compra e teste de temas premium restaurados.');

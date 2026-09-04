// Elo V36.12 RC1 · ponte PWA -> APK Android + verificação nativa de atualização.
const RELEASE={webVersion:'36.12-rc1',versionName:'0.9.1-rc1',versionCode:35,packageName:'br.com.eloapp'};
window.ELO_ANDROID_RELEASE={...(window.ELO_ANDROID_RELEASE||{}),...RELEASE};

const isNative=!!window.Capacitor?.isNativePlatform?.();
const isAndroidWeb=!isNative&&/Android/i.test(navigator.userAgent||'');
const nativeManifestUrl='https://raw.githubusercontent.com/Teasyzi/Elo-app/main/android-version.json';
const manifestUrl=()=>isNative?(localStorage.getItem('elo_android_manifest_url')||nativeManifestUrl):new URL('./android-version.json',window.location.href).href;

function safeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function absoluteDownloadUrl(info,url){
 const raw=String(info?.downloadUrl||'').trim();
 if(!raw)return'';
 try{return new URL(raw,url).href}catch(_){return''}
}
async function fetchReleaseInfo(){
 const url=manifestUrl();
 try{
  const sep=url.includes('?')?'&':'?';
  const response=await fetch(`${url}${sep}t=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)return null;
  return await response.json();
 }catch(_){return null}
}

function ensureStyle(){
 if(document.getElementById('elo-android-release-style'))return;
 const s=document.createElement('style');s.id='elo-android-release-style';s.textContent=`
 #elo-android-apk-banner{position:fixed;left:12px;right:12px;bottom:max(14px,env(safe-area-inset-bottom));z-index:2147483200;max-width:520px;margin:auto;background:rgba(15,23,42,.97);color:#fff;border:1px solid rgba(244,114,182,.34);border-radius:20px;padding:14px;box-shadow:0 18px 55px rgba(0,0,0,.42);backdrop-filter:blur(14px);font-family:inherit}
 #elo-android-apk-banner .elo-apk-row{display:flex;align-items:flex-start;gap:11px}#elo-android-apk-banner .elo-apk-icon{font-size:28px;line-height:1}#elo-android-apk-banner .elo-apk-copy{min-width:0;flex:1}#elo-android-apk-banner b{display:block;font-size:14px}#elo-android-apk-banner p{margin:4px 0 0;font-size:11px;line-height:1.45;color:#cbd5e1}#elo-android-apk-banner .elo-apk-actions{display:flex;gap:8px;margin-top:11px}#elo-android-apk-banner a,#elo-android-apk-banner button{border:0;border-radius:12px;padding:10px 12px;font-weight:900;font-size:11px;text-decoration:none;text-align:center}#elo-android-apk-banner a{flex:1;background:#db2777;color:#fff}#elo-android-apk-banner button{background:#1e293b;color:#cbd5e1}
 #elo-android-update-overlay{position:fixed;inset:0;z-index:2147483500;background:rgba(2,6,23,.78);display:flex;align-items:flex-end;justify-content:center;padding:12px;backdrop-filter:blur(8px)}#elo-android-update-overlay .elo-update-card{width:min(100%,460px);background:#0f172a;color:#fff;border:1px solid #334155;border-radius:24px;padding:18px;box-shadow:0 30px 90px rgba(0,0,0,.55)}#elo-android-update-overlay h3{font-size:19px;font-weight:900;margin:7px 0}#elo-android-update-overlay p{font-size:11px;color:#cbd5e1;line-height:1.5}#elo-android-update-overlay .elo-update-list{margin:12px 0;padding:12px;border-radius:14px;background:#111827;font-size:11px;color:#cbd5e1}#elo-android-update-overlay a,#elo-android-update-overlay button{display:block;width:100%;box-sizing:border-box;border:0;border-radius:13px;padding:12px;text-align:center;font-weight:900;font-size:12px;text-decoration:none}#elo-android-update-overlay a{background:#db2777;color:#fff}#elo-android-update-overlay button{margin-top:8px;background:#1e293b;color:#cbd5e1}
 `;document.head.appendChild(s)
}

function showPwaBanner(info,downloadUrl){
 if(!isAndroidWeb||document.getElementById('elo-android-apk-banner'))return;
 const code=Number(info?.versionCode||0);if(!info?.available||!downloadUrl||code<RELEASE.versionCode)return;
 const dismissed=localStorage.getItem(`elo_apk_banner_dismissed_${code}`);if(dismissed)return;
 ensureStyle();
 const el=document.createElement('div');el.id='elo-android-apk-banner';
 el.innerHTML=`<div class="elo-apk-row"><div class="elo-apk-icon">📲</div><div class="elo-apk-copy"><b>Elo para Android disponível</b><p>Versão ${safeText(info.versionName||'nova')} em APK assinado. O app Android tem integração nativa com notificações e receberá avisos de atualização.</p></div></div><div class="elo-apk-actions"><a href="${safeText(downloadUrl)}" download>Baixar APK</a><button type="button">Agora não</button></div>`;
 el.querySelector('button')?.addEventListener('click',()=>{localStorage.setItem(`elo_apk_banner_dismissed_${code}`,'1');el.remove()});
 document.body.appendChild(el)
}

function showNativeUpdate(info,downloadUrl){
 const code=Number(info?.versionCode||0);if(!isNative||!info?.available||!downloadUrl||code<=RELEASE.versionCode)return;
 if(document.getElementById('elo-android-update-overlay'))return;
 ensureStyle();
 const required=RELEASE.versionCode<Number(info.minimumVersionCode||0);
 const changes=Array.isArray(info.changes)?info.changes.slice(0,6):[];
 const el=document.createElement('div');el.id='elo-android-update-overlay';
 el.innerHTML=`<div class="elo-update-card"><div style="font-size:34px">📲</div><p style="font-weight:900;color:#f9a8d4;text-transform:uppercase;letter-spacing:.12em">Atualização do Elo</p><h3>Versão ${safeText(info.versionName||'nova')} disponível</h3><p>Baixe o APK oficial e instale por cima da versão atual. A assinatura do app deve permanecer a mesma em todas as versões.</p>${changes.length?`<div class="elo-update-list">${changes.map(x=>`<div>• ${safeText(x)}</div>`).join('')}</div>`:''}<a href="${safeText(downloadUrl)}" target="_blank" rel="noopener">Baixar atualização</a>${required?'':'<button type="button">Agora não</button>'}</div>`;
 el.querySelector('button')?.addEventListener('click',()=>el.remove());document.body.appendChild(el)
}

async function checkAndroidRelease(){
 const info=await fetchReleaseInfo();if(!info)return null;
 const url=absoluteDownloadUrl(info,manifestUrl());
 if(isAndroidWeb)showPwaBanner(info,url);else if(isNative)showNativeUpdate(info,url);
 return info
}
window.checkAndroidRelease=checkAndroidRelease;
// Substitui a comparação antiga, que ainda carregava versionCode 34 no app.js.
window.compareAndroidVersion=async()=>checkAndroidRelease();
if(isNative)localStorage.setItem('elo_android_manifest_url',nativeManifestUrl);

const boot=()=>setTimeout(checkAndroidRelease,1800);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkAndroidRelease,500)});
console.info('[Elo] Android Release RC1 · PWA→APK e update nativo preparados para 0.9.1-rc1 (35).');

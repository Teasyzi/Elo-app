// Elo V36.11.21 · gravidade Celestial V12: captura suave, órbita curta e espaguetificação luminosa.
const VERSION='36.11.21';
window.ELO_V36_11={...(window.ELO_V36_11||{}),version:VERSION};
window.ELO_FLUIDITY={...(window.ELO_FLUIDITY||{}),version:VERSION,blackHoleV12:true,blackHoleCaptureSpiral:true,blackHoleFilamentSpaghettification:true};

const style=document.createElement('style');
style.textContent=`
.elo-gravity-v12-clone{position:fixed!important;margin:0!important;right:auto!important;bottom:auto!important;pointer-events:none!important;z-index:2147481765!important;animation:none!important;transition:none!important;will-change:transform,opacity,filter!important;transform-origin:50% 50%!important}
.elo-gravity-v12-filament{position:fixed!important;left:0;top:0;width:1px;height:2px;border-radius:999px;pointer-events:none!important;z-index:2147481764!important;transform-origin:50% 50%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,229,184,.68),rgba(255,255,255,.92),rgba(255,229,184,.68),rgba(255,255,255,0));box-shadow:0 0 5px rgba(255,210,145,.28);opacity:0;will-change:transform,opacity,filter}
.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-photon{opacity:.78!important;filter:brightness(1.16)!important}
.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-disk-near,.elo-theme-celestial .elo-black-hole.is-feeding .elo-bh-disk-far{filter:brightness(1.12) drop-shadow(0 0 6px rgba(255,210,145,.30))!important}
`;
document.head.appendChild(style);

function visible(el){if(!el?.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}
function holeCenter(hole){const core=hole?.querySelector?.('.elo-black-hole-core');const r=(core&&core.getBoundingClientRect().width>2)?core.getBoundingClientRect():hole.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function smooth(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function cubic(p0,p1,p2,p3,t){const m=1-t;return m*m*m*p0+3*m*m*t*p1+3*m*t*t*p2+t*t*t*p3}
function pointInView(x,y,pad=10){return{x:clamp(x,pad,Math.max(pad,(innerWidth||document.documentElement.clientWidth)-pad)),y:clamp(y,pad,Math.max(pad,(innerHeight||document.documentElement.clientHeight)-pad))}}

function captureAnimation(source,hx,hy,index){
 const r=source.getBoundingClientRect();if(!r.width||!r.height)return Promise.resolve();
 const cx=r.left+r.width/2,cy=r.top+r.height/2;
 const vx=cx-hx,vy=cy-hy,dist=Math.hypot(vx,vy)||1,startTheta=Math.atan2(vy,vx);
 const comet=source.classList.contains('elo-space-comet'),dir=index%2?1:-1;
 const captureRadius=clamp(dist*(comet?.18:.15),comet?38:28,comet?78:58);
 const captureTheta=startTheta+dir*(comet?.42:.34);
 const capture=pointInView(hx+Math.cos(captureTheta)*captureRadius,hy+Math.sin(captureTheta)*captureRadius,12);
 const nx=(hx-cx)/dist,ny=(hy-cy)/dist,px=-ny,py=nx;
 const bend=clamp(dist*(comet?.12:.085),comet?26:18,comet?72:46)*dir;
 const p0={x:cx,y:cy};
 const p1=pointInView(cx+(hx-cx)*.22+px*bend,cy+(hy-cy)*.22+py*bend,12);
 const p2=pointInView(capture.x-(hx-cx)*.10+px*bend*.34,capture.y-(hy-cy)*.10+py*bend*.34,12);
 const p3=capture;
 const clone=source.cloneNode(true);clone.removeAttribute('id');clone.classList.add('elo-gravity-v12-clone');
 Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,transform:'none',visibility:'visible',opacity:getComputedStyle(source).opacity||'1'});
 const filament=document.createElement('div');filament.className='elo-gravity-v12-filament';
 document.body.append(clone,filament);
 const oldVisibility=source.style.visibility;source.style.visibility='hidden';
 const cloneFrames=[],filamentFrames=[],steps=comet?68:44;
 let prevX=cx,prevY=cy;
 for(let i=0;i<=steps;i++){
   const t=i/steps;
   let x,y;
   if(t<=.67){
     const q=smooth(t/.67);
     x=cubic(p0.x,p1.x,p2.x,p3.x,q);y=cubic(p0.y,p1.y,p2.y,p3.y,q);
   }else{
     const q=(t-.67)/.33;
     const spiral=smooth(q);
     const theta=captureTheta+dir*(comet?1.38:1.12)*Math.PI*spiral;
     const radius=captureRadius*Math.pow(1-spiral,1.72)+2.2;
     x=hx+Math.cos(theta)*radius;y=hy+Math.sin(theta)*radius;
     const safe=pointInView(x,y,8);x=safe.x;y=safe.y;
   }
   const motion=Math.atan2(y-prevY,x-prevX)*180/Math.PI;
   const radial=Math.atan2(hy-y,hx-x)*180/Math.PI;
   const sp=smooth((t-.76)/.24);
   const angle=motion+( ((radial-motion+540)%360)-180 )*sp*.82;
   const cloneStretch=1+.42*Math.pow(sp,1.45),cloneThin=1-.40*Math.pow(sp,1.3);
   const fade=t<.965?1:Math.max(0,1-(t-.965)/.035);
   const bright=1+.36*Math.pow(sp,1.5);
   cloneFrames.push({transform:`translate3d(${x-cx}px,${y-cy}px,0) rotate(${angle}deg) scale(${cloneStretch},${cloneThin})`,opacity:fade,filter:`brightness(${bright})${t>.975?' blur(.25px)':''}`,offset:t});
   const filamentOn=smooth((t-.80)/.16),filamentFade=t<.965?filamentOn:filamentOn*Math.max(0,1-(t-.965)/.035);
   const filamentLength=(comet?58:40)*Math.pow(filamentOn,1.25);
   filamentFrames.push({transform:`translate3d(${x-.5}px,${y-1}px,0) rotate(${radial}deg) scaleX(${Math.max(.01,filamentLength)})`,opacity:filamentFade,filter:`brightness(${1+.42*filamentOn}) blur(${.05+.18*filamentOn}px)`,offset:t});
   prevX=x;prevY=y;
 }
 cloneFrames[cloneFrames.length-1]={transform:`translate3d(${hx-cx}px,${hy-cy}px,0) rotate(${Math.atan2(hy-cy,hx-cx)*180/Math.PI}deg) scale(.34,.22)`,opacity:0,filter:'brightness(1.45) blur(.38px)',offset:1};
 filamentFrames[filamentFrames.length-1]={transform:`translate3d(${hx-.5}px,${hy-1}px,0) rotate(0deg) scaleX(.1)`,opacity:0,filter:'brightness(1.6) blur(.4px)',offset:1};
 const duration=(comet?4050:3000)+Math.min(comet?1050:720,dist*(comet?.78:.55))+(index%4)*32;
 try{
   const a=clone.animate(cloneFrames,{duration,easing:'linear',fill:'forwards'});
   const f=filament.animate(filamentFrames,{duration,easing:'linear',fill:'forwards'});
   return Promise.allSettled([a.finished,f.finished]).finally(()=>{clone.remove();filament.remove();source.style.visibility=oldVisibility});
 }catch(_){clone.remove();filament.remove();source.style.visibility=oldVisibility;return Promise.resolve()}
}

function pullV12(event){
 const fx=document.getElementById('elo-theme-fx'),hole=fx?.querySelector('.elo-black-hole');
 if(!fx||!hole||!document.body.classList.contains('elo-theme-celestial')||fx.dataset.eloGravityV12==='1')return false;
 event?.preventDefault?.();event?.stopPropagation?.();
 const{x:hx,y:hy}=holeCenter(hole);fx.dataset.eloGravityV12='1';hole.classList.add('is-gravity-active','is-feeding');fx.classList.add('elo-gravity-surge','is-gravity-active');
 const comets=[...fx.querySelectorAll(':scope > .elo-space-comet')].filter(visible);
 const particles=[...fx.querySelectorAll(':scope > .elo-space-particle')].filter(visible).slice(0,window.ELO_FLUIDITY?.lowEnd?6:10);
 window.ELO_FLUIDITY.stats&&(window.ELO_FLUIDITY.stats.gravityRuns=(window.ELO_FLUIDITY.stats.gravityRuns||0)+1);
 Promise.allSettled([...comets,...particles].map((el,i)=>captureAnimation(el,hx,hy,i))).finally(()=>{delete fx.dataset.eloGravityV12;hole.classList.remove('is-gravity-active','is-feeding');fx.classList.remove('elo-gravity-surge','is-gravity-active')});
 return true;
}
function install(){const fn=e=>pullV12(e);fn.__eloBhV7=true;fn.__eloBhV8=true;fn.__eloBhV9=true;fn.__eloBhV10=true;fn.__eloBhV11=true;fn.__eloBhV12=true;window.reactCelestialBlackHole=fn}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();setTimeout(install,700);setTimeout(install,1600);
console.info('[Elo] V36.11.21 · gravidade V12 com captura suave e espaguetificação luminosa.');


(function(){
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  window.eloIsIOS = isIOS;
  window.eloIsStandalone = isStandalone;
  window.showIOSInstallGuide = function(){
    if(!isIOS || isStandalone) return;
    openGenericModal(`<div class="space-y-4 text-center">
      <div class="mx-auto w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center text-2xl"><i class="ph-fill ph-device-mobile"></i></div>
      <div><p class="text-[10px] uppercase tracking-widest font-black text-pink-400">Instalar o Elo</p><h3 class="text-xl font-black text-white mt-1">Adicione o Elo à Tela de Início</h3></div>
      <div class="text-left space-y-3 text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p><b>1.</b> Toque no botão <b>Compartilhar</b> do Safari <span class="text-pink-400">□↑</span>.</p>
        <p><b>2.</b> Role o menu e toque em <b>Adicionar à Tela de Início</b>.</p>
        <p><b>3.</b> Toque em <b>Adicionar</b>. Depois abra o Elo pelo novo ícone.</p>
      </div>
      <button onclick="closeGenericModal()" class="w-full bg-pink-600 text-white font-black py-3.5 rounded-xl">Entendi</button>
    </div>`);
  };
  window.maybeShowInstallOption = function(){
    if(isIOS && !isStandalone && typeof window.showIOSInstallGuide === 'function') window.showIOSInstallGuide();
    else if(typeof window.installEloPWA === 'function') window.installEloPWA();
  };
})();

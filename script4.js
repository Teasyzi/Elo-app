
      // PWA: caminhos relativos funcionam também quando o GitHub Pages publica em /repositorio/
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => console.log('Elo PWA: Service Worker ativo', reg.scope))
            .catch(err => console.error('Elo PWA: falha ao registrar Service Worker', err));
        });
      }

      let eloInstallPrompt = null;
      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        eloInstallPrompt = event;
        window.dispatchEvent(new CustomEvent('elo:pwa-install-ready'));
      });
      window.installEloPWA = async () => {
        if (window.eloIsIOS && !window.eloIsStandalone) { window.showIOSInstallGuide?.(); return false; }
        if (!eloInstallPrompt) return false;
        eloInstallPrompt.prompt();
        const result = await eloInstallPrompt.userChoice;
        eloInstallPrompt = null;
        return result.outcome === 'accepted';
      };
    
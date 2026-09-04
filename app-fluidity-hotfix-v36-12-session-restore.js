// Elo V36.12 RC2 · restauração de sessão autenticada sem criar um segundo fluxo de Auth.
// O app.js continua sendo a autoridade do Firebase Auth. Este módulo apenas recupera
// o vínculo do usuário autenticado quando o primeiro GET de userProfiles falhar/demorar.
(() => {
  if (window.__eloSessionRestoreGuard) return;
  window.__eloSessionRestoreGuard = true;

  let recovering = false;
  let completedForUid = '';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const appVisible = () => !document.getElementById('main-content')?.classList.contains('hidden');

  async function recoverAuthenticatedSession() {
    if (recovering || appVisible()) return;
    const user = window.currentUser;
    const uid = String(user?.uid || '');
    if (!uid || user?.isAnonymous || completedForUid === uid) return;

    // Se o app.js já recuperou o vínculo, não repetimos Firestore nem setupSync.
    const savedCoupleId = String(localStorage.getItem('elo_coupleId') || window.coupleId || '');
    if (savedCoupleId) return;

    recovering = true;
    try {
      // Damos ao fluxo original tempo para concluir primeiro. Só entramos como recuperação.
      await sleep(900);
      if (appVisible() || localStorage.getItem('elo_coupleId')) return;

      const { getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      if (!getApps().length) return;
      const db = getFirestore(getApp());

      let profile = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          profile = await Promise.race([
            getDoc(doc(db, 'userProfiles', uid)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('profile-timeout')), 6500))
          ]);
          if (profile?.exists()) break;
        } catch (error) {
          lastError = error;
        }
        await sleep(700 * (attempt + 1));
      }

      if (!profile?.exists()) {
        if (lastError) console.warn('[Elo] Perfil autenticado não pôde ser recuperado:', lastError);
        return;
      }

      const data = profile.data() || {};
      const coupleId = String(data.coupleId || '').trim();
      if (!coupleId) return;

      // Corrige a causa observada após limpar os dados do site: Auth persiste/retorna,
      // mas elo_coupleId local foi apagado. O vínculo real continua em userProfiles.
      localStorage.setItem('elo_coupleId', coupleId);
      window.coupleId = coupleId;
      completedForUid = uid;

      // Não chamamos setupSync (escopo privado do app.js) nem criamos outro listener Auth.
      // Um único reload controlado deixa o boot original consumir o vínculo restaurado.
      if (!sessionStorage.getItem('elo_session_restore_reload')) {
        sessionStorage.setItem('elo_session_restore_reload', '1');
        location.reload();
      }
    } finally {
      recovering = false;
    }
  }

  // Limpa o marcador quando o app principal realmente abriu; evita reloads futuros.
  const observer = new MutationObserver(() => {
    if (appVisible()) sessionStorage.removeItem('elo_session_restore_reload');
  });
  const start = () => {
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
    // O Auth original costuma resolver rapidamente; fazemos verificações espaçadas,
    // sem disputar o primeiro boot e sem gerar a sensação de duas cargas normais.
    setTimeout(recoverAuthenticatedSession, 1800);
    setTimeout(recoverAuthenticatedSession, 5000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

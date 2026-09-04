// Elo V36.12 RC2 · restauração de sessão autenticada sem criar um segundo fluxo de Auth.
// O app.js continua sendo a autoridade do Firebase Auth. Este módulo só repara contas
// antigas que têm vínculo em relationships, mas perderam/faltam coupleId em userProfiles.
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

    const localId = String(localStorage.getItem('elo_coupleId') || window.coupleId || '').trim();
    if (localId) return;

    recovering = true;
    try {
      // O fluxo original recebe a primeira chance. Entramos apenas quando ele deixou
      // a conta Google conectada no lobby por não encontrar o vínculo.
      await sleep(650);
      if (appVisible() || localStorage.getItem('elo_coupleId')) return;

      const { getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const {
        getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, limit, FieldPath
      } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      if (!getApps().length) return;
      const db = getFirestore(getApp());

      let coupleId = '';
      let profileData = null;
      try {
        const profile = await getDoc(doc(db, 'userProfiles', uid));
        if (profile.exists()) {
          profileData = profile.data() || {};
          coupleId = String(profileData.coupleId || '').trim();
        }
      } catch (error) {
        console.warn('[Elo] Leitura do perfil durante recuperação:', error);
      }

      // Causa real para contas antigas: o relacionamento contém o UID, mas o perfil
      // reverso userProfiles/{uid}.coupleId não existe ou ficou sem vínculo. Procuramos
      // diretamente pelo mapa users.<uid>.name, sem varrer todos os relacionamentos.
      if (!coupleId) {
        try {
          const membershipQuery = query(
            collection(db, 'relationships'),
            where(new FieldPath('users', uid, 'name'), '!=', null),
            limit(2)
          );
          const matches = await getDocs(membershipQuery);
          if (!matches.empty) coupleId = String(matches.docs[0].id || '').trim();
        } catch (error) {
          console.warn('[Elo] Recuperação do vínculo pelo relacionamento:', error);
        }
      }

      if (!coupleId) {
        completedForUid = uid;
        console.info('[Elo] Conta autenticada sem vínculo de relacionamento recuperável.');
        return;
      }

      // Repara a fonte persistente para que próximos dispositivos entrem normalmente.
      try {
        await setDoc(doc(db, 'userProfiles', uid), {
          uid,
          coupleId,
          name: profileData?.name || user.displayName || 'Eu',
          displayName: profileData?.displayName || user.displayName || '',
          email: profileData?.email || user.email || '',
          photoUrl: profileData?.photoUrl || user.photoURL || '',
          updatedAt: Date.now(),
          relationshipRecoveredAt: Date.now()
        }, { merge: true });
      } catch (error) {
        console.warn('[Elo] Não foi possível reparar userProfiles; usando vínculo local:', error);
      }

      localStorage.setItem('elo_coupleId', coupleId);
      window.coupleId = coupleId;
      completedForUid = uid;

      // O callback Auth original já encerrou quando chegou ao lobby. Fazemos só este
      // reload de reparo; depois userProfiles fica correto e nenhum reload extra ocorre.
      if (!sessionStorage.getItem('elo_relationship_repair_reload')) {
        sessionStorage.setItem('elo_relationship_repair_reload', '1');
        location.reload();
      }
    } finally {
      recovering = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (appVisible()) sessionStorage.removeItem('elo_relationship_repair_reload');
  });
  const start = () => {
    observer.observe(document.documentElement, { subtree:true, attributes:true, attributeFilter:['class'] });
    setTimeout(recoverAuthenticatedSession, 1800);
    setTimeout(recoverAuthenticatedSession, 4500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

// Elo V36.12 RC6 · restauração segura e rápida do vínculo após autenticação.
// O app.js continua sendo a autoridade do Firebase Auth. Este módulo entra apenas quando
// a conta Google autenticou, mas a HOME não abriu. Ele nunca cria um Elo novo.
(() => {
  if (window.__eloSessionRestoreGuard) return;
  window.__eloSessionRestoreGuard = true;

  let recovering = false;
  let completedForUid = '';
  let authUnsubscribe = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const appVisible = () => !document.getElementById('main-content')?.classList.contains('hidden');

  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms))
  ]);

  async function recoverAuthenticatedSession(user) {
    if (recovering || appVisible()) return;
    const uid = String(user?.uid || window.currentUser?.uid || '');
    if (!uid || user?.isAnonymous || completedForUid === uid) return;

    recovering = true;
    try {
      // Dá uma chance curta para o fluxo original do app.js concluir sozinho.
      await sleep(700);
      if (appVisible()) return;

      const { getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const {
        getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, limit, FieldPath
      } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      if (!getApps().length) return;
      const db = getFirestore(getApp());

      let coupleId = '';
      let profileData = null;

      // 1) Fonte persistente oficial: userProfiles/{uid}.coupleId.
      try {
        const profile = await withTimeout(getDoc(doc(db, 'userProfiles', uid)), 3500, 'Leitura do perfil');
        if (profile.exists()) {
          profileData = profile.data() || {};
          coupleId = String(profileData.coupleId || '').trim();
        }
      } catch (error) {
        console.warn('[Elo] Leitura do perfil durante recuperação:', error);
      }

      // 2) Se o APK já possui elo_coupleId local, NÃO ignoramos mais esse dado.
      // Antes o hotfix retornava imediatamente quando havia localId; isso deixava a conta
      // presa no lobby quando userProfiles perdeu o coupleId. Agora validamos o candidato
      // contra o documento real e confirmamos que o UID pertence ao relacionamento.
      const localCandidate = String(localStorage.getItem('elo_coupleId') || window.coupleId || '').trim();
      if (!coupleId && localCandidate) {
        try {
          const relSnap = await withTimeout(getDoc(doc(db, 'relationships', localCandidate)), 3500, 'Validação do Elo local');
          const relData = relSnap.exists() ? (relSnap.data() || {}) : null;
          if (relData?.users && Object.prototype.hasOwnProperty.call(relData.users, uid)) {
            coupleId = localCandidate;
            console.info('[Elo] Vínculo local validado para a conta autenticada.');
          } else {
            // Não usamos vínculo local que não pertença a esta conta.
            localStorage.removeItem('elo_coupleId');
            if (String(window.coupleId || '') === localCandidate) window.coupleId = '';
          }
        } catch (error) {
          console.warn('[Elo] Validação do vínculo local:', error);
        }
      }

      // 3) Compatibilidade com contas antigas: relationship contém o UID, mas o perfil
      // reverso não tem coupleId. Consulta direcionada, sem varrer a coleção inteira.
      if (!coupleId) {
        try {
          const membershipQuery = query(
            collection(db, 'relationships'),
            where(new FieldPath('users', uid, 'name'), '!=', null),
            limit(2)
          );
          const matches = await withTimeout(getDocs(membershipQuery), 4500, 'Busca do relacionamento');
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

      // Repara userProfiles para que os próximos logins não dependam do fallback.
      try {
        await withTimeout(setDoc(doc(db, 'userProfiles', uid), {
          uid,
          coupleId,
          name: profileData?.name || user?.displayName || window.currentUser?.displayName || 'Eu',
          displayName: profileData?.displayName || user?.displayName || window.currentUser?.displayName || '',
          email: profileData?.email || user?.email || window.currentUser?.email || '',
          photoUrl: profileData?.photoUrl || user?.photoURL || window.currentUser?.photoURL || '',
          updatedAt: Date.now(),
          relationshipRecoveredAt: Date.now()
        }, { merge: true }), 3500, 'Reparo do perfil');
      } catch (error) {
        // O vínculo já foi validado; se o backfill falhar, mantemos o candidato local
        // para não apagar uma relação válida do usuário.
        console.warn('[Elo] Não foi possível reparar userProfiles; mantendo vínculo validado:', error);
      }

      localStorage.setItem('elo_coupleId', coupleId);
      window.coupleId = coupleId;
      completedForUid = uid;

      // O callback original de Auth pode já ter encerrado no lobby. Um único reload faz
      // o app.js iniciar novamente com o coupleId reparado/persistido. A flag impede loop.
      if (!appVisible() && !sessionStorage.getItem('elo_relationship_repair_reload')) {
        sessionStorage.setItem('elo_relationship_repair_reload', '1');
        location.reload();
      }
    } finally {
      recovering = false;
    }
  }

  function start() {
    // Remove a trava de reload assim que a HOME realmente abriu.
    const observer = new MutationObserver(() => {
      if (appVisible()) sessionStorage.removeItem('elo_relationship_repair_reload');
    });
    observer.observe(document.documentElement, { subtree:true, attributes:true, attributeFilter:['class'] });

    // Assinamos o próprio Firebase Auth em vez de depender só de polling de window.currentUser.
    // onAuthStateChanged entrega imediatamente o usuário atual quando a sessão já existe.
    Promise.all([
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
    ]).then(([appApi, authApi]) => {
      if (!appApi.getApps().length) return;
      authUnsubscribe?.();
      authUnsubscribe = authApi.onAuthStateChanged(authApi.getAuth(appApi.getApp()), user => {
        if (user && !user.isAnonymous) setTimeout(() => recoverAuthenticatedSession(user), 500);
      });
    }).catch(error => console.warn('[Elo] Observador de recuperação de sessão:', error));

    // Fallback para runtimes em que o módulo Auth ainda não terminou de inicializar.
    setTimeout(() => recoverAuthenticatedSession(window.currentUser), 1800);
    setTimeout(() => recoverAuthenticatedSession(window.currentUser), 4200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

// Elo V36.12 RC6 · restauração robusta do vínculo após autenticação.
// Não cria Elo novo; tenta perfil, candidato local validado e relacionamento legado.
(() => {
  if (window.__eloSessionRestoreGuard) return;
  window.__eloSessionRestoreGuard = true;

  let recovering = false;
  let authUnsubscribe = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const appVisible = () => {
    const main = document.getElementById('main-content');
    return !!main && !main.classList.contains('hidden');
  };
  const stage = (text, tone='info') => {
    try { window.eloSetAuthStage?.(text, tone); } catch (_) {}
  };
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms))
  ]);

  async function firestoreRestGet(user, collectionName, docId) {
    const token = await withTimeout(user.getIdToken(), 5000, 'Token Firebase');
    const url = `https://firestore.googleapis.com/v1/projects/elo-app-82e6e/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`;
    const response = await withTimeout(fetch(url, {
      method:'GET',
      headers:{Authorization:`Bearer ${token}`},
      cache:'no-store'
    }), 5000, 'Firestore REST');
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Firestore REST ${response.status}`);
    return response.json();
  }

  const restString = (doc, field) => String(doc?.fields?.[field]?.stringValue || '').trim();
  const restRelationshipHasUid = (doc, uid) => !!doc?.fields?.users?.mapValue?.fields?.[uid];

  async function recoverAuthenticatedSession(user, options={}) {
    const uid = String(user?.uid || window.currentUser?.uid || '');
    if (!uid || user?.isAnonymous) return false;
    if (recovering && !options.force) return false;
    if (appVisible() && !options.force) return true;

    recovering = true;
    try {
      if (!options.immediate) await sleep(500);
      if (appVisible() && !options.force) return true;
      stage('Conta autenticada. Verificando seu vínculo…');

      const [appApi, fsApi] = await withTimeout(Promise.all([
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js')
      ]), 7000, 'Módulos do Firestore');
      if (!appApi.getApps().length) throw new Error('Firebase ainda não foi inicializado.');
      const db = fsApi.getFirestore(appApi.getApp());

      let coupleId = '';
      let profileData = null;
      let sdkProfileFailed = false;

      // 1) Perfil oficial via SDK.
      try {
        const profile = await withTimeout(fsApi.getDoc(fsApi.doc(db, 'userProfiles', uid)), 2800, 'Leitura do perfil');
        if (profile.exists()) {
          profileData = profile.data() || {};
          coupleId = String(profileData.coupleId || '').trim();
        }
      } catch (error) {
        sdkProfileFailed = true;
        console.warn('[Elo] Perfil via SDK demorou/falhou:', error);
      }

      // 1b) Se o SDK travou, usa a API REST do Firestore com o mesmo usuário autenticado.
      if (!coupleId && sdkProfileFailed) {
        try {
          stage('Firebase lento no app. Tentando uma rota alternativa…');
          const profileRest = await firestoreRestGet(user, 'userProfiles', uid);
          coupleId = restString(profileRest, 'coupleId');
        } catch (error) {
          console.warn('[Elo] Perfil via REST:', error);
        }
      }

      // 2) Candidato local, sempre validado antes de usar.
      const localCandidate = String(localStorage.getItem('elo_coupleId') || window.coupleId || '').trim();
      if (!coupleId && localCandidate) {
        let valid = false;
        try {
          const relSnap = await withTimeout(fsApi.getDoc(fsApi.doc(db, 'relationships', localCandidate)), 2800, 'Validação do Elo local');
          const relData = relSnap.exists() ? (relSnap.data() || {}) : null;
          valid = !!relData?.users && Object.prototype.hasOwnProperty.call(relData.users, uid);
        } catch (error) {
          console.warn('[Elo] Elo local via SDK:', error);
          try {
            const relRest = await firestoreRestGet(user, 'relationships', localCandidate);
            valid = restRelationshipHasUid(relRest, uid);
          } catch (restError) {
            console.warn('[Elo] Elo local via REST:', restError);
          }
        }
        if (valid) coupleId = localCandidate;
        else if (!sdkProfileFailed) {
          localStorage.removeItem('elo_coupleId');
          if (String(window.coupleId || '') === localCandidate) window.coupleId = '';
        }
      }

      // 3) Fallback legado pela coleção de relacionamentos.
      if (!coupleId) {
        try {
          stage('Procurando seu Elo antigo…');
          const membershipQuery = fsApi.query(
            fsApi.collection(db, 'relationships'),
            fsApi.where(new fsApi.FieldPath('users', uid, 'name'), '!=', null),
            fsApi.limit(2)
          );
          const matches = await withTimeout(fsApi.getDocs(membershipQuery), 4500, 'Busca do relacionamento');
          if (!matches.empty) coupleId = String(matches.docs[0].id || '').trim();
        } catch (error) {
          console.warn('[Elo] Busca do relacionamento:', error);
        }
      }

      if (!coupleId) {
        stage('Google autenticado, mas não consegui confirmar seu Elo ainda. Tente novamente em alguns segundos.', 'error');
        return false;
      }

      stage('Vínculo encontrado. Finalizando entrada…', 'ok');
      try {
        await withTimeout(fsApi.setDoc(fsApi.doc(db, 'userProfiles', uid), {
          uid,
          coupleId,
          name: profileData?.name || user?.displayName || window.currentUser?.displayName || 'Eu',
          displayName: profileData?.displayName || user?.displayName || window.currentUser?.displayName || '',
          email: profileData?.email || user?.email || window.currentUser?.email || '',
          photoUrl: profileData?.photoUrl || user?.photoURL || window.currentUser?.photoURL || '',
          updatedAt: Date.now(),
          relationshipRecoveredAt: Date.now()
        }, {merge:true}), 3500, 'Reparo do perfil');
      } catch (error) {
        console.warn('[Elo] Backfill do perfil:', error);
      }

      localStorage.setItem('elo_coupleId', coupleId);
      window.coupleId = coupleId;

      if (!appVisible()) {
        const count = Number(sessionStorage.getItem('elo_relationship_repair_reload_count') || 0);
        if (count < 2) {
          sessionStorage.setItem('elo_relationship_repair_reload_count', String(count + 1));
          setTimeout(() => location.reload(), 120);
        } else {
          stage('Seu vínculo foi recuperado. Feche e abra o Elo uma vez para concluir.', 'ok');
        }
      }
      return true;
    } catch (error) {
      console.warn('[Elo] Recuperação de sessão:', error);
      stage('A conta Google entrou, mas a restauração do Elo demorou demais.', 'error');
      return false;
    } finally {
      recovering = false;
    }
  }

  window.eloRecoverAuthenticatedSession = recoverAuthenticatedSession;

  function start() {
    const observer = new MutationObserver(() => {
      if (appVisible()) {
        sessionStorage.removeItem('elo_relationship_repair_reload');
        sessionStorage.removeItem('elo_relationship_repair_reload_count');
        stage('');
      }
    });
    observer.observe(document.documentElement, {subtree:true, attributes:true, attributeFilter:['class']});

    Promise.all([
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
    ]).then(([appApi, authApi]) => {
      if (!appApi.getApps().length) return;
      authUnsubscribe?.();
      authUnsubscribe = authApi.onAuthStateChanged(authApi.getAuth(appApi.getApp()), user => {
        if (user && !user.isAnonymous) setTimeout(() => recoverAuthenticatedSession(user), 650);
      });
    }).catch(error => console.warn('[Elo] Observador de recuperação:', error));

    // Repetimos algumas vezes porque a WebView pode demorar para entregar Firebase/Firestore.
    [1800, 4500, 9000].forEach(delay => setTimeout(() => recoverAuthenticatedSession(window.currentUser), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();

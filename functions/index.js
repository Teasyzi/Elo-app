const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

exports.sendEloNotification = onDocumentCreated('relationships/{coupleId}/notifications/{notificationId}', async event => {
  const snap = event.data;
  if (!snap) return;
  const n = snap.data();
  if (!n?.recipientUid) return;

  const profileSnap = await db.collection('userProfiles').doc(n.recipientUid).get();
  const prefs = profileSnap.exists ? (profileSnap.data().notificationPrefs || {}) : {};
  const category = n.notificationCategory || n.type || 'system';
  if (prefs[category] === false) return;

  const tokenSnap = await db.collection('userProfiles').doc(n.recipientUid).collection('fcmTokens').get();
  const tokens = tokenSnap.docs.map(d => d.data().token).filter(Boolean);
  if (!tokens.length) return;

  const link = n.data?.link || 'https://teasyzi.github.io/Elo-app/';
  const message = {
    tokens,
    notification: {title: n.title || 'Elo', body: n.body || 'Você tem uma nova notificação.'},
    data: {
      title: String(n.title || 'Elo'),
      body: String(n.body || ''),
      type: String(n.type || 'system'),
      link,
      tag: `elo-${event.params.notificationId}`
    },
    webpush: {
      fcmOptions: {link}
    }
  };

  const response = await getMessaging().sendEachForMulticast(message);
  const invalidCodes = new Set(['messaging/registration-token-not-registered','messaging/invalid-registration-token']);
  const removals = [];
  response.responses.forEach((r, i) => {
    if (!r.success && invalidCodes.has(r.error?.code)) {
      removals.push(tokenSnap.docs[i].ref.delete());
    }
  });
  await Promise.all(removals);
});

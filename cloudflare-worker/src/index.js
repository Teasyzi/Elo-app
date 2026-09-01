import { importPKCS8, importX509, jwtVerify, SignJWT } from 'jose';

const FIREBASE_CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const corsHeaders = env => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
});

const json = (env, body, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) }
});

const b64urlJson = part => JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')), c => c.charCodeAt(0))
));

async function verifyFirebaseIdToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const header = b64urlJson(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Cabeçalho JWT inválido');

  const certRes = await fetch(FIREBASE_CERTS, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!certRes.ok) throw new Error('Não foi possível carregar chaves do Firebase Auth');
  const certs = await certRes.json();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Chave de assinatura desconhecida');
  const key = await importX509(cert, 'RS256');
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    audience: env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
  });
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('UID ausente');
  return payload;
}

async function serviceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Secret FIREBASE_SERVICE_ACCOUNT_JSON não configurado');
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!sa.client_email || !sa.private_key) throw new Error('Service Account inválida');
  return sa;
}

async function getGoogleAccessToken(env) {
  const sa = await serviceAccount(env);
  const now = Math.floor(Date.now()/1000);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging'
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`OAuth Google falhou: ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

const firestoreBase = env => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;

async function fsGet(env, accessToken, path) {
  const res = await fetch(`${firestoreBase(env)}/${path}`, { headers:{Authorization:`Bearer ${accessToken}`} });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${res.status}`);
  return res.json();
}

async function fsList(env, accessToken, path) {
  const res = await fetch(`${firestoreBase(env)}/${path}?pageSize=50`, { headers:{Authorization:`Bearer ${accessToken}`} });
  if (!res.ok) throw new Error(`Firestore LIST ${res.status}`);
  return (await res.json()).documents || [];
}

async function fsPatchStatus(env, accessToken, coupleId, notificationId, status) {
  const name = `relationships/${encodeURIComponent(coupleId)}/notifications/${encodeURIComponent(notificationId)}`;
  const url = `${firestoreBase(env)}/${name}?updateMask.fieldPaths=pushStatus&updateMask.fieldPaths=pushSentAt`;
  await fetch(url, {
    method:'PATCH',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body: JSON.stringify({fields:{pushStatus:{stringValue:status},pushSentAt:{integerValue:String(Date.now())}}})
  });
}

function field(doc, key) {
  const v = doc?.fields?.[key];
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,val])=>[k, unwrap(val)]));
  return undefined;
}
function unwrap(v){
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,val])=>[k,unwrap(val)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap);
  return null;
}

async function sendFcm(env, accessToken, token, notification, coupleId, notificationId, hideContent=false) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`, {
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body: JSON.stringify({message:{token,data:{
      title: hideContent ? 'Elo 💕' : String(field(notification,'title') || 'Elo 💕'),
      body: hideContent ? 'Você recebeu uma nova notificação no Elo.' : String(field(notification,'body') || 'Você tem uma novidade do seu amor.'),
      type: String(field(notification,'type') || 'system'),
      notificationId: String(notificationId),
      coupleId: String(coupleId),
      url: './index.html'
    },webpush:{headers:{Urgency:'high',TTL:'86400'},fcmOptions:{link:'./index.html'}}}})
  });
  const detail = await res.text();
  return {ok:res.ok,status:res.status,detail};
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:corsHeaders(env)});
    if (request.method !== 'POST') return json(env,{ok:false,error:'Use POST /push'},405);
    const url = new URL(request.url);
    if (url.pathname !== '/push') return json(env,{ok:false,error:'Rota não encontrada'},404);

    try {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) return json(env,{ok:false,error:'Não autenticado'},401);
      const caller = await verifyFirebaseIdToken(auth.slice(7), env);
      const body = await request.json();
      const coupleId = String(body.coupleId || '');
      const notificationId = String(body.notificationId || '');
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(coupleId) || !/^[A-Za-z0-9_-]{1,160}$/.test(notificationId)) {
        return json(env,{ok:false,error:'Identificadores inválidos'},400);
      }

      const accessToken = await getGoogleAccessToken(env);
      const notification = await fsGet(env, accessToken, `relationships/${coupleId}/notifications/${notificationId}`);
      if (!notification) return json(env,{ok:false,error:'Notificação não encontrada'},404);

      const senderUid = field(notification,'senderUid');
      const recipientUid = field(notification,'recipientUid');
      if (!senderUid || senderUid !== caller.sub) return json(env,{ok:false,error:'Sem permissão para disparar esta notificação'},403);
      if (!recipientUid || recipientUid === senderUid) return json(env,{ok:false,error:'Destinatário inválido'},400);
      if (field(notification,'pushStatus') === 'sent') return json(env,{ok:true,alreadySent:true});

      const relationship = await fsGet(env, accessToken, `relationships/${coupleId}`);
      const users = field(relationship,'users') || {};
      if (!users[senderUid] || !users[recipientUid]) return json(env,{ok:false,error:'Usuários não pertencem a este Elo'},403);

      const profile = await fsGet(env, accessToken, `userProfiles/${recipientUid}`);
      const prefs = field(profile,'notificationPrefs') || {};
      const category = field(notification,'notificationCategory') || field(notification,'type') || 'system';
      const prefKey = category === 'chat' || category === 'chat_image' ? 'messages' : category;
      if (prefs[prefKey] === false) {
        await fsPatchStatus(env, accessToken, coupleId, notificationId, 'disabled');
        return json(env,{ok:true,disabledByPreference:true});
      }

      const tokenDocs = await fsList(env, accessToken, `userProfiles/${encodeURIComponent(recipientUid)}/fcmTokens`);
      const tokens = tokenDocs.map(d => field(d,'token')).filter(Boolean).slice(0,20);
      if (!tokens.length) {
        await fsPatchStatus(env, accessToken, coupleId, notificationId, 'no_token');
        return json(env,{ok:true,noTokens:true});
      }

      const results = [];
      const hideContent = prefs.hideContent === true;
      for (const token of tokens) results.push(await sendFcm(env, accessToken, token, notification, coupleId, notificationId, hideContent));
      const successes = results.filter(r=>r.ok).length;
      await fsPatchStatus(env, accessToken, coupleId, notificationId, successes ? 'sent' : 'failed');
      return json(env,{ok:successes>0,sent:successes,total:results.length}, successes ? 200 : 502);
    } catch (err) {
      console.error(err);
      return json(env,{ok:false,error:err?.message || 'Erro interno'},500);
    }
  }
};

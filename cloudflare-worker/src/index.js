import { importPKCS8, importX509, jwtVerify, SignJWT } from 'jose';

const FIREBASE_CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const corsHeaders = env => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Vary': 'Origin'
});

const json = (env, body, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) }
});

const b64urlJson = part => JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')), c => c.charCodeAt(0))
));


const b64urlBytes = bytes => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const textB64url = text => b64urlBytes(new TextEncoder().encode(text));
const decodeB64urlText = part => new TextDecoder().decode(
  Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')), c => c.charCodeAt(0))
);

async function actionHmacKey(env) {
  const sa = await serviceAccount(env);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sa.private_key));
  return crypto.subtle.importKey('raw', digest, {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']);
}

async function signActionToken(env, payload) {
  const body = textB64url(JSON.stringify(payload));
  const key = await actionHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${b64urlBytes(new Uint8Array(signature))}`;
}

async function verifyActionToken(env, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Token de ação inválido');
  const key = await actionHmacKey(env);
  const sig = Uint8Array.from(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(parts[1].length/4)*4,'=')), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(parts[0]));
  if (!ok) throw new Error('Assinatura da ação inválida');
  const payload = JSON.parse(decodeB64urlText(parts[0]));
  if (!payload.exp || Date.now() > Number(payload.exp)) throw new Error('Ação expirada');
  return payload;
}

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


function fsValue(value) {
  if (value === null || value === undefined) return {nullValue:null};
  if (typeof value === 'string') return {stringValue:value};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'number') return Number.isInteger(value) ? {integerValue:String(value)} : {doubleValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(fsValue)}};
  if (typeof value === 'object') return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsValue(v)]))}};
  return {stringValue:String(value)};
}
function fsFields(object) {
  return Object.fromEntries(Object.entries(object).map(([k,v])=>[k,fsValue(v)]));
}

async function fsCreate(env, accessToken, collectionPath, documentId, object) {
  const url = `${firestoreBase(env)}/${collectionPath}?documentId=${encodeURIComponent(documentId)}`;
  const res = await fetch(url, {
    method:'POST',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({fields:fsFields(object)})
  });
  if (!res.ok) throw new Error(`Firestore CREATE ${res.status}: ${(await res.text()).slice(0,240)}`);
  return res.json();
}

async function fsPatchFields(env, accessToken, documentPath, object) {
  const masks = Object.keys(object).map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const url = `${firestoreBase(env)}/${documentPath}?${masks}`;
  const res = await fetch(url, {
    method:'PATCH',
    headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({fields:fsFields(object)})
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${res.status}: ${(await res.text()).slice(0,240)}`);
  return res.json();
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


const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const IMAGE_MEDIA_BYTES = 12 * 1024 * 1024;

function resolveMediaBucket(env) {
  const preferred = ['ELO_MEDIA','MEDIA_BUCKET','R2_BUCKET','BUCKET','MEDIA'];
  for (const name of preferred) {
    const value = env?.[name];
    if (value && typeof value.get === 'function' && typeof value.put === 'function' && typeof value.delete === 'function') return value;
  }
  for (const value of Object.values(env || {})) {
    if (value && typeof value === 'object' && typeof value.get === 'function' && typeof value.put === 'function' && typeof value.delete === 'function') return value;
  }
  return null;
}

function safeFileName(name='arquivo') {
  const cleaned = String(name || 'arquivo')
    .normalize('NFKC')
    .replace(/[\\/\0\r\n\t]/g,'_')
    .replace(/[<>:"|?*]/g,'_')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,180);
  return cleaned || 'arquivo';
}

function fileExt(name='') {
  const m = /\.([A-Za-z0-9]{1,12})$/.exec(String(name));
  return m ? m[1].toLowerCase() : '';
}

function mediaValidation(kind, contentType, fileName, size) {
  if (!Number.isFinite(size) || size <= 0) return 'Arquivo vazio';
  if (size > MAX_MEDIA_BYTES) return 'O arquivo deve ter até 25 MB';
  const type = String(contentType || 'application/octet-stream').toLowerCase();
  const ext = fileExt(fileName);
  if (kind === 'image') {
    if (size > IMAGE_MEDIA_BYTES) return 'A imagem deve ter até 12 MB';
    if (!type.startsWith('image/')) return 'Formato de imagem inválido';
  }
  if (kind === 'audio' && !(type.startsWith('audio/') || type === 'video/webm' || type === 'application/octet-stream')) return 'Formato de áudio inválido';
  if (kind === 'file') {
    const blocked = new Set(['exe','msi','apk','bat','cmd','com','dll','scr','ps1','sh','html','htm','svg']);
    if (blocked.has(ext)) return 'Esse tipo de arquivo não é permitido por segurança';
  }
  return '';
}

async function requireCaller(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Não autenticado'), {status:401});
  try { return await verifyFirebaseIdToken(auth.slice(7), env); }
  catch (e) { throw Object.assign(new Error(e?.message || 'Token inválido'), {status:401}); }
}

async function requireRelationshipMember(env, accessToken, coupleId, uid) {
  const relationship = await fsGet(env, accessToken, `relationships/${encodeURIComponent(coupleId)}`);
  if (!relationship) throw Object.assign(new Error('Elo não encontrado'), {status:404});
  const users = field(relationship,'users') || {};
  if (!users[uid]) throw Object.assign(new Error('Usuário não pertence a este Elo'), {status:403});
  return {relationship, users};
}

function coupleCandidatesFromMediaObject(key, object) {
  const found = [];
  const add = value => {
    const v=String(value||'');
    if (/^[A-Za-z0-9_-]{1,160}$/.test(v) && !found.includes(v)) found.push(v);
  };
  add(object?.customMetadata?.coupleId);
  const parts = String(key || '').split('/').filter(Boolean);
  if (parts[0] === 'relationships' && parts[1]) add(parts[1]);
  if (['couples','chat','elo'].includes(parts[0]) && parts[1]) add(parts[1]);
  // Compatibilidade com chaves antigas: testa alguns segmentos plausíveis sem expor o objeto.
  const generic = new Set(['relationships','couples','chat','elo','media','image','images','audio','files','file','uploads']);
  for (const part of parts.slice(0,4)) if (!generic.has(part.toLowerCase())) add(part);
  return found;
}

async function handleMediaUpload(request, env, url) {
  try {
    const caller = await requireCaller(request, env);
    const coupleId = String(url.searchParams.get('coupleId') || '');
    const kind = String(url.searchParams.get('kind') || 'file').toLowerCase();
    const fileName = safeFileName(url.searchParams.get('fileName') || (kind === 'image' ? 'foto.jpg' : kind === 'audio' ? 'audio.webm' : 'arquivo'));
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(coupleId)) return json(env,{ok:false,error:'Elo inválido'},400);
    if (!['image','audio','file'].includes(kind)) return json(env,{ok:false,error:'Tipo de mídia inválido'},400);

    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_MEDIA_BYTES) return json(env,{ok:false,error:'O arquivo deve ter até 25 MB'},413);
    const body = await request.arrayBuffer();
    const size = body.byteLength;
    const contentType = String(request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim() || 'application/octet-stream';
    const validation = mediaValidation(kind, contentType, fileName, size);
    if (validation) return json(env,{ok:false,error:validation}, validation.includes('25 MB') || validation.includes('12 MB') ? 413 : 415);

    const accessToken = await getGoogleAccessToken(env);
    await requireRelationshipMember(env, accessToken, coupleId, caller.sub);
    const bucket = resolveMediaBucket(env);
    if (!bucket) return json(env,{ok:false,error:'R2 não configurado no Worker. Confira o binding do bucket em Settings > Bindings.'},503);

    const ext = fileExt(fileName);
    const suffix = ext ? `.${ext}` : '';
    const key = `relationships/${coupleId}/media/${kind}/${caller.sub}/${Date.now()}_${crypto.randomUUID().replace(/-/g,'').slice(0,16)}${suffix}`;
    await bucket.put(key, body, {
      httpMetadata:{contentType},
      customMetadata:{coupleId,ownerUid:String(caller.sub),kind,fileName}
    });
    return json(env,{ok:true,key,size,contentType,fileName,kind});
  } catch (err) {
    console.error('media-upload',err);
    return json(env,{ok:false,error:err?.message || 'Falha no upload'}, Number(err?.status || 500));
  }
}

async function handleMediaObject(request, env, url) {
  try {
    const caller = await requireCaller(request, env);
    const key = String(url.searchParams.get('key') || '');
    if (!key || key.length > 700 || key.includes('..')) return json(env,{ok:false,error:'Chave de mídia inválida'},400);
    const bucket = resolveMediaBucket(env);
    if (!bucket) return json(env,{ok:false,error:'R2 não configurado no Worker'},503);

    const object = request.method === 'DELETE' && typeof bucket.head === 'function' ? await bucket.head(key) : await bucket.get(key);
    if (!object) return json(env,{ok:false,error:'Arquivo não encontrado'},404);
    const accessToken = await getGoogleAccessToken(env);
    const candidates = coupleCandidatesFromMediaObject(key, object);
    let coupleId = '';
    for (const candidate of candidates) {
      try {
        await requireRelationshipMember(env, accessToken, candidate, caller.sub);
        coupleId = candidate;
        break;
      } catch (e) {
        if (![403,404].includes(Number(e?.status))) throw e;
      }
    }
    if (!coupleId) return json(env,{ok:false,error:'Arquivo sem vínculo autorizado com este Elo'},403);

    if (request.method === 'DELETE') {
      const ownerUid = String(object?.customMetadata?.ownerUid || '');
      if (ownerUid && ownerUid !== caller.sub) return json(env,{ok:false,error:'Somente quem enviou pode apagar este arquivo'},403);
      await bucket.delete(key);
      return json(env,{ok:true,deleted:true,key});
    }

    const headers = new Headers(corsHeaders(env));
    object.writeHttpMetadata?.(headers);
    const contentType = headers.get('Content-Type') || object?.httpMetadata?.contentType || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', String(object.size || 0));
    headers.set('Cache-Control','private, max-age=3600');
    headers.set('X-Content-Type-Options','nosniff');
    const kind = String(object?.customMetadata?.kind || '');
    const name = safeFileName(object?.customMetadata?.fileName || key.split('/').pop() || 'arquivo');
    const disposition = kind === 'file' ? 'attachment' : 'inline';
    headers.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
    return new Response(object.body,{status:200,headers});
  } catch (err) {
    console.error('media-object',err);
    return json(env,{ok:false,error:err?.message || 'Falha ao acessar mídia'}, Number(err?.status || 500));
  }
}

async function sendFcm(env, accessToken, tokenInfo, notification, coupleId, notificationId, hideContent=false, actionToken="", actionEndpoint="") {
  const platform = String(tokenInfo.platform || 'web').toLowerCase();
  const type = String(field(notification,'type') || 'system').toLowerCase();
  const senderName = String(field(notification,'senderName') || 'Seu amor').slice(0,80);
  const rawPhoto = String(field(notification,'senderPhotoUrl') || '');
  const senderPhotoUrl = (!hideContent && /^https?:\/\//i.test(rawPhoto) && rawPhoto.length <= 1800) ? rawPhoto : '';
  const originalTitle = String(field(notification,'title') || 'Elo 💕');
  const originalBody = String(field(notification,'body') || 'Você tem uma novidade do seu amor.');
  const isMessage = ['chat','chat_image','chat_audio','chat_file','messages'].includes(type);
  const title = hideContent ? 'Elo 💕' : (isMessage ? senderName : originalTitle);
  const body = hideContent ? 'Você recebeu uma nova notificação no Elo.' : originalBody;
  const data = {
    title,
    body,
    type,
    notificationCategory:String(field(notification,'notificationCategory') || type),
    notificationId:String(notificationId),
    coupleId:String(coupleId),
    senderName: hideContent ? '' : senderName,
    senderUid: hideContent ? '' : String(field(notification,'senderUid') || ''),
    senderPhotoUrl,
    url:'./index.html',
    actionToken:String(actionToken || ''),
    actionEndpoint:String(actionEndpoint || '')
  };
  const channelId = ['chat','chat_image','chat_audio','chat_file','messages'].includes(type) ? 'elo_messages'
    : ['vouchers','gift','gifts'].includes(type) ? 'elo_gifts'
    : ['checkin','streak'].includes(type) ? 'elo_streak' : 'elo_general';
  const message = {token:tokenInfo.token,data};
  if (platform === 'android' || platform === 'native') {
    // APK 0.3.2: Android recebe data-only em alta prioridade.
    // O EloMessagingService nativo monta NotificationCompat.MessagingStyle,
    // permitindo avatar real do remetente em vez de usar a imagem como banner.
    message.android = {
      priority:'high',
      ttl:'86400s'
    };
    data.channelId = channelId;
    data.sentAt = String(Date.now());
  } else {
    // Web/PWA permanece data-only para o service worker ser a única camada que exibe a notificação.
    message.webpush = {headers:{Urgency:'high',TTL:'86400'},fcmOptions:{link:'./index.html'}};
  }
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`, {
    method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'}, body:JSON.stringify({message})
  });
  const detail = await res.text();
  return {ok:res.ok,status:res.status,detail,platform};
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:corsHeaders(env)});
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(env,{ok:true,service:'elo-push',project:env.FIREBASE_PROJECT_ID || '',mediaStorage:!!resolveMediaBucket(env)},200);
    }
    if (url.pathname === '/media/upload') {
      if (request.method !== 'POST') return json(env,{ok:false,error:'Use POST /media/upload'},405);
      return handleMediaUpload(request, env, url);
    }
    if (url.pathname === '/media') {
      if (!['GET','DELETE'].includes(request.method)) return json(env,{ok:false,error:'Use GET ou DELETE /media'},405);
      return handleMediaObject(request, env, url);
    }

    if (url.pathname === '/notification-action') {
      if (request.method !== 'POST') return json(env,{ok:false,error:'Use POST /notification-action'},405);
      try {
        const body = await request.json();
        const action = String(body.action || '');
        const text = String(body.text || '').trim().slice(0,2000);
        const token = await verifyActionToken(env, body.actionToken);
        if (!['reply','mark_read'].includes(action)) return json(env,{ok:false,error:'Ação inválida'},400);
        if (action === 'reply' && !text) return json(env,{ok:false,error:'Resposta vazia'},400);

        const {coupleId, notificationId, recipientUid, senderUid} = token;
        if (![coupleId, notificationId, recipientUid, senderUid].every(v => typeof v === 'string' && v.length > 0)) {
          return json(env,{ok:false,error:'Token incompleto'},400);
        }

        const accessToken = await getGoogleAccessToken(env);
        const relationship = await fsGet(env, accessToken, `relationships/${encodeURIComponent(coupleId)}`);
        const users = field(relationship,'users') || {};
        if (!users[recipientUid] || !users[senderUid]) return json(env,{ok:false,error:'Elo inválido'},403);

        // A ação pertence ao destinatário original. Primeiro marca a notificação como lida.
        await fsPatchFields(env, accessToken, `relationships/${encodeURIComponent(coupleId)}/notifications/${encodeURIComponent(notificationId)}`, {read:true});

        if (action === 'mark_read') {
          return json(env,{ok:true,action:'mark_read'});
        }

        const now = Date.now();
        const messageId = `${now}_${recipientUid}_notif_${crypto.randomUUID().slice(0,8)}`;
        await fsCreate(env, accessToken, `relationships/${encodeURIComponent(coupleId)}/messages`, messageId, {
          id:messageId,
          senderId:recipientUid,
          type:'text',
          text,
          timestamp:now,
          replyTo:null,
          reactions:{},
          readBy:{[recipientUid]:true},
          source:'notification_reply'
        });

        const replier = users[recipientUid] || {};
        const senderName = String(replier.name || 'Seu amor').slice(0,80);
        const photo = String(replier.photoUrl || '');
        const replyNotificationId = `notif_reply_${now}_${crypto.randomUUID().slice(0,8)}`;
        const replyNotification = {
          recipientUid:senderUid,
          senderUid:recipientUid,
          senderName,
          senderPhotoUrl:/^https?:\/\//i.test(photo) ? photo : '',
          title:`${senderName} enviou uma mensagem`,
          body:text.length > 100 ? text.slice(0,100) + '…' : text,
          type:'chat',
          notificationCategory:'chat',
          createdAt:now,
          read:false,
          pushStatus:'pending'
        };
        await fsCreate(env, accessToken, `relationships/${encodeURIComponent(coupleId)}/notifications`, replyNotificationId, replyNotification);

        const targetProfile = await fsGet(env, accessToken, `userProfiles/${encodeURIComponent(senderUid)}`);
        const targetPrefs = field(targetProfile,'notificationPrefs') || {};
        const tokenDocs = await fsList(env, accessToken, `userProfiles/${encodeURIComponent(senderUid)}/fcmTokens`);
        const targetTokens = tokenDocs.map(d => ({token:field(d,'token'),platform:field(d,'platform') || 'web'})).filter(t=>t.token).slice(0,20);
        const actionPayload = await signActionToken(env, {
          coupleId,
          notificationId:replyNotificationId,
          recipientUid:senderUid,
          senderUid:recipientUid,
          exp:Date.now()+7*24*60*60*1000
        });
        const actionEndpoint = `${url.origin}/notification-action`;
        const results = [];
        for (const tokenInfo of targetTokens) {
          results.push(await sendFcm(env, accessToken, tokenInfo, {fields:fsFields(replyNotification)}, coupleId, replyNotificationId, targetPrefs.hideContent === true, actionPayload, actionEndpoint));
        }
        const sent = results.filter(r=>r.ok).length;
        await fsPatchStatus(env, accessToken, coupleId, replyNotificationId, sent ? 'sent' : (targetTokens.length ? 'failed' : 'no_token'));
        return json(env,{ok:true,action:'reply',messageId,sent,total:targetTokens.length});
      } catch (err) {
        console.error('notification-action', err);
        return json(env,{ok:false,error:err?.message || 'Erro na ação'},500);
      }
    }

    if (url.pathname !== '/push') return json(env,{ok:false,error:'Rota não encontrada'},404);
    if (request.method !== 'POST') return json(env,{ok:false,error:'Use POST /push'},405);

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
      const prefKey = ['chat','chat_image','chat_audio','chat_file','messages'].includes(category) ? 'messages' : category;
      if (prefs[prefKey] === false) {
        await fsPatchStatus(env, accessToken, coupleId, notificationId, 'disabled');
        return json(env,{ok:true,disabledByPreference:true});
      }

      const tokenDocs = await fsList(env, accessToken, `userProfiles/${encodeURIComponent(recipientUid)}/fcmTokens`);
      const tokens = tokenDocs.map(d => ({token:field(d,'token'),platform:field(d,'platform') || 'web'})).filter(t=>t.token).slice(0,20);
      if (!tokens.length) {
        await fsPatchStatus(env, accessToken, coupleId, notificationId, 'no_token');
        return json(env,{ok:true,noTokens:true});
      }

      const results = [];
      const hideContent = prefs.hideContent === true;
      const actionToken = await signActionToken(env, {
        coupleId,
        notificationId,
        recipientUid,
        senderUid,
        exp:Date.now()+7*24*60*60*1000
      });
      const actionEndpoint = `${url.origin}/notification-action`;
      for (const tokenInfo of tokens) results.push(await sendFcm(env, accessToken, tokenInfo, notification, coupleId, notificationId, hideContent, actionToken, actionEndpoint));
      const successes = results.filter(r=>r.ok).length;
      await fsPatchStatus(env, accessToken, coupleId, notificationId, successes ? 'sent' : 'failed');
      return json(env,{ok:successes>0,sent:successes,total:results.length}, successes ? 200 : 502);
    } catch (err) {
      console.error(err);
      return json(env,{ok:false,error:err?.message || 'Erro interno'},500);
    }
  }
};

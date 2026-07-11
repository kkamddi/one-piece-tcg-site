import { supabaseAdmin } from '../../lib/supabase-admin.js';

const SUBSCRIPTIONS_TABLE = process.env.SUPABASE_USER_PUSH_SUBSCRIPTIONS_TABLE || 'user_push_subscriptions';
const encoder = new TextEncoder();

function base64UrlToBytes(value = '') {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function concatBytes(...parts) {
  const arrays = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)));
  const output = new Uint8Array(arrays.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of arrays) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

async function hkdfExtract(salt, inputKeyMaterial) {
  return hmac(salt, inputKeyMaterial);
}

async function hkdfExpand(pseudoRandomKey, info, length) {
  const output = [];
  let previous = new Uint8Array();
  let counter = 1;
  while (output.reduce((total, part) => total + part.length, 0) < length) {
    previous = await hmac(pseudoRandomKey, concatBytes(previous, info, Uint8Array.of(counter)));
    output.push(previous);
    counter += 1;
  }
  return concatBytes(...output).slice(0, length);
}

function vapidConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || 'mailto:admin@optcgkorea.com').trim();
  return { publicKey, privateKey, subject, ready: Boolean(publicKey && privateKey && subject) };
}

async function createVapidAuthorization(endpoint, config) {
  const publicBytes = base64UrlToBytes(config.publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error('invalid_vapid_public_key');
  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: config.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const audience = new URL(endpoint).origin;
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: config.subject
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
  return `vapid t=${unsigned}.${bytesToBase64Url(signature)}, k=${config.publicKey}`;
}

async function encryptPayload(subscription, payload) {
  const clientPublicKey = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeys.privateKey,
    256
  ));
  const authPrk = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKey);
  const inputKeyMaterial = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, inputKeyMaterial);
  const contentEncryptionKey = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const plaintext = concatBytes(encoder.encode(JSON.stringify(payload)), Uint8Array.of(2));
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concatBytes(salt, recordSize, Uint8Array.of(serverPublicKey.length), serverPublicKey, ciphertext);
}

async function deactivateSubscription(id) {
  if (!supabaseAdmin || !id) return;
  await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
}

export function getVapidPublicKey() {
  return vapidConfig().publicKey;
}

export async function sendPushToUser(userId, payload) {
  const config = vapidConfig();
  if (!config.ready || !supabaseAdmin || !userId) return { sent: 0, failed: 0, skipped: true };
  const { data, error } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(20);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const subscription of data || []) {
    try {
      const [authorization, body] = await Promise.all([
        createVapidAuthorization(subscription.endpoint, config),
        encryptPayload(subscription, payload)
      ]);
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: '86400',
          Urgency: 'normal'
        },
        body
      });
      if (response.ok || response.status === 201) {
        sent += 1;
      } else {
        failed += 1;
        if (response.status === 404 || response.status === 410) await deactivateSubscription(subscription.id);
      }
    } catch {
      failed += 1;
    }
  }
  return { sent, failed, skipped: false };
}

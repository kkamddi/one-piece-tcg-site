import { supabaseAdmin } from '../lib/supabase-admin.js';
import { getVapidPublicKey, sendPushToUser } from './lib/web-push.js';

const SUBSCRIPTIONS_TABLE = process.env.SUPABASE_USER_PUSH_SUBSCRIPTIONS_TABLE || 'user_push_subscriptions';

function getBearerToken(request) {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) throw error;
  return data?.user || null;
}

function safeString(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function isAdminUser(user) {
  return String(user?.user_metadata?.username || '').toLowerCase() === 'admin';
}

async function getStatus(request, response, user) {
  const endpoint = safeString(request.query?.endpoint, 3000);
  let query = supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true);
  if (endpoint) query = query.eq('endpoint', endpoint);
  const { count, error } = await query;
  if (error) throw error;
  return response.status(200).json({
    configured: Boolean(getVapidPublicKey()),
    publicKey: getVapidPublicKey(),
    activeSubscriptions: Number(count || 0),
    subscribed: Boolean(endpoint && count)
  });
}

async function saveSubscription(request, response, user) {
  const subscription = request.body?.subscription || request.body || {};
  const endpoint = safeString(subscription.endpoint, 3000);
  const p256dh = safeString(subscription.keys?.p256dh, 500);
  const auth = safeString(subscription.keys?.auth, 500);
  if (!endpoint || !p256dh || !auth) return response.status(400).json({ error: 'invalid_push_subscription' });
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: safeString(request.headers?.['user-agent'], 1000),
      active: true,
      updated_at: now
    }, { onConflict: 'endpoint' })
    .select('id,active,created_at,updated_at')
    .single();
  if (error) throw error;
  const push = await sendPushToUser(user.id, {
    title: 'Card Pone 알림이 연결되었습니다',
    body: '등록한 카드가 설정한 가격 조건에 도달하면 알려드리겠습니다.',
    url: '/prices',
    icon: '/card-pone-app-icon-192.png',
    tag: 'card-pone-push-connected'
  });
  return response.status(200).json({ subscription: data, push });
}

async function sendTestPush(response, user) {
  const push = await sendPushToUser(user.id, {
    title: 'Card Pone 테스트 알림',
    body: 'ADMIN 시세 알림 Push가 정상적으로 연결되어 있습니다.',
    url: '/prices',
    icon: '/card-pone-app-icon-192.png',
    tag: `card-pone-admin-test-${Date.now()}`
  });
  if (!push.sent) return response.status(502).json({ error: 'push_test_failed', push });
  return response.status(200).json({ ok: true, push });
}

async function deleteSubscription(request, response, user) {
  const endpoint = safeString(request.body?.endpoint || request.query?.endpoint, 3000);
  if (!endpoint) return response.status(400).json({ error: 'missing_push_endpoint' });
  const { error } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);
  if (error) throw error;
  return response.status(200).json({ ok: true });
}

export default async function handler(request, response) {
  response.setHeader?.('Cache-Control', 'no-store, private');
  response.setHeader?.('Vary', 'Authorization');
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
    if (!isAdminUser(user)) return response.status(403).json({ error: 'admin_only' });
    if (request.method === 'GET') return await getStatus(request, response, user);
    if (request.method === 'POST' && safeString(request.query?.action, 40) === 'test') return await sendTestPush(response, user);
    if (request.method === 'POST') return await saveSubscription(request, response, user);
    if (request.method === 'DELETE') return await deleteSubscription(request, response, user);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'push_subscription_failed' });
  }
}

import { supabaseAdmin } from '../lib/supabase-admin.js';

const NOTIFICATIONS_TABLE = process.env.SUPABASE_USER_NOTIFICATIONS_TABLE || 'user_notifications';
const RULE_TYPE = 'price_alert_rule';
const ALERT_TYPE = 'price_alert';
const D1_BINDING_NAME = String(process.env.MARKET_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();

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

function isCollectorAuthorized(request) {
  const expected = String(process.env.MARKET_COLLECTOR_TOKEN || '').trim();
  return Boolean(expected) && getBearerToken(request) === expected;
}

function getD1Binding() {
  const binding = process.env?.[D1_BINDING_NAME] || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

async function queryD1(sql, params = []) {
  const binding = getD1Binding();
  if (!binding) throw new Error('d1_not_configured');
  const statement = binding.prepare(sql);
  const result = params.length ? await statement.bind(...params).all() : await statement.all();
  return result?.results || [];
}

function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function payloadObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeCondition(value) {
  return String(value || '').toLowerCase() === 'psa10' ? 'psa10' : 'a';
}

function normalizeTriggerType(value) {
  return String(value || '').toLowerCase() === 'percent' ? 'percent' : 'price';
}

function normalizeDirection(value) {
  return String(value || '').toLowerCase() === 'above' ? 'above' : 'below';
}

function normalizeThreshold(value, triggerType) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (triggerType === 'percent') return Math.min(100, Number(number.toFixed(2)));
  return Math.min(2_000_000_000, Math.round(number));
}

function ruleKey(payload = {}) {
  return [
    Number(payload.apparelId || 0),
    normalizeCondition(payload.conditionKey),
    normalizeTriggerType(payload.triggerType),
    normalizeDirection(payload.direction)
  ].join(':');
}

function mapRule(row) {
  const payload = payloadObject(row?.payload_json);
  return {
    id: row?.id || '',
    apparelId: Number(payload.apparelId || 0),
    cardId: payload.cardId || '',
    code: payload.code || '',
    cardName: payload.cardName || row?.title || '',
    previewImageUrl: payload.previewImageUrl || '',
    conditionKey: normalizeCondition(payload.conditionKey),
    triggerType: normalizeTriggerType(payload.triggerType),
    direction: normalizeDirection(payload.direction),
    thresholdValue: Number(payload.thresholdValue || 0),
    active: payload.active !== false,
    lastObservedPriceJpy: Number(payload.lastObservedPriceJpy || 0) || null,
    lastTriggeredAt: payload.lastTriggeredAt || null,
    createdAt: row?.created_at || null
  };
}

async function listRuleRows(userId = '') {
  let query = supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .select('id,user_id,type,title,body,link_url,payload_json,created_at')
    .eq('type', RULE_TYPE)
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.limit(userId ? 100 : 10000);
  if (error) throw error;
  return data || [];
}

async function listRules(response, user) {
  const rows = await listRuleRows(user.id);
  return response.status(200).json({ rules: rows.map(mapRule) });
}

function ruleSummary(payload) {
  const condition = payload.conditionKey === 'psa10' ? 'PSA10' : 'Single';
  const direction = payload.direction === 'above' ? '상승' : '하락';
  const target = payload.triggerType === 'percent'
    ? `24시간 ${payload.thresholdValue}% ${direction}`
    : `JPY ${Number(payload.thresholdValue).toLocaleString('en-US')} ${payload.direction === 'above' ? '이상' : '이하'}`;
  return `${condition} · ${target}`;
}

async function saveRule(request, response, user) {
  const body = request.body || {};
  const apparelId = Number(body.apparelId || 0);
  const triggerType = normalizeTriggerType(body.triggerType);
  const direction = normalizeDirection(body.direction);
  const conditionKey = normalizeCondition(body.conditionKey);
  const thresholdValue = normalizeThreshold(body.thresholdValue, triggerType);
  if (!Number.isInteger(apparelId) || apparelId <= 0 || !thresholdValue) {
    return response.status(400).json({ error: 'invalid_price_alert' });
  }

  const payload = {
    apparelId,
    cardId: safeString(body.cardId, 160),
    code: safeString(body.code, 80),
    cardName: safeString(body.cardName, 240),
    previewImageUrl: safeString(body.previewImageUrl, 1000),
    conditionKey,
    triggerType,
    direction,
    thresholdValue,
    active: true,
    lastObservedPriceJpy: Math.max(0, Math.round(Number(body.currentPriceJpy || 0))) || null,
    lastObservedAt: body.currentPriceJpy ? new Date().toISOString() : null,
    lastEvaluatedAt: null,
    lastConditionMet: false,
    lastTriggeredAt: null
  };
  const rows = await listRuleRows(user.id);
  const requestedId = safeString(body.id, 80);
  const existing = rows.find((row) => row.id === requestedId)
    || rows.find((row) => ruleKey(payloadObject(row.payload_json)) === ruleKey(payload));
  const values = {
    user_id: user.id,
    type: RULE_TYPE,
    title: payload.cardName || payload.code || `SNKRDUNK #${apparelId}`,
    body: ruleSummary(payload),
    link_url: `/prices?code=${encodeURIComponent(payload.code)}&apparelId=${apparelId}`,
    payload_json: existing ? { ...payloadObject(existing.payload_json), ...payload } : payload,
    read_at: null
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from(NOTIFICATIONS_TABLE)
      .update(values)
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .eq('type', RULE_TYPE)
      .select('*')
      .single();
    if (error) throw error;
    return response.status(200).json({ rule: mapRule(data) });
  }

  const { data, error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .insert(values)
    .select('*')
    .single();
  if (error) throw error;
  return response.status(201).json({ rule: mapRule(data) });
}

async function deleteRule(request, response, user) {
  const id = safeString(request.query?.id, 80);
  if (!id) return response.status(400).json({ error: 'missing_price_alert_id' });
  const { error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('type', RULE_TYPE);
  if (error) throw error;
  return response.status(200).json({ ok: true, id });
}

async function fetchCurrentRows(apparelIds) {
  const rows = [];
  for (let start = 0; start < apparelIds.length; start += 80) {
    const chunk = apparelIds.slice(start, start + 80);
    const placeholders = chunk.map(() => '?').join(',');
    rows.push(...await queryD1(
      `select apparel_id, latest_a_price_jpy, latest_psa10_price_jpy, latest_captured_at
       from market_products
       where source = 'snkrdunk' and apparel_id in (${placeholders})`,
      chunk
    ));
  }
  return rows;
}

async function fetchSnapshotRows(apparelIds) {
  const rows = [];
  const cutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  for (let start = 0; start < apparelIds.length; start += 80) {
    const chunk = apparelIds.slice(start, start + 80);
    const placeholders = chunk.map(() => '?').join(',');
    rows.push(...await queryD1(
      `select apparel_id, condition_key, captured_at, price_amount_jpy
       from market_listing_floor_snapshots
       where source = 'snkrdunk'
         and apparel_id in (${placeholders})
         and captured_at >= ?
         and price_amount_jpy > 0
       order by apparel_id asc, condition_key asc, captured_at desc`,
      [...chunk, cutoff]
    ));
  }
  return rows;
}

function snapshotKey(apparelId, conditionKey) {
  return `${Number(apparelId)}:${normalizeCondition(conditionKey)}`;
}

function snapshotPair(rows = []) {
  const sorted = rows
    .map((row) => ({ at: row.captured_at, timestamp: Date.parse(row.captured_at || ''), price: Number(row.price_amount_jpy || 0) }))
    .filter((row) => Number.isFinite(row.timestamp) && row.price > 0)
    .sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  if (!latest) return null;
  const previous = sorted.find((row) => {
    const age = latest.timestamp - row.timestamp;
    return age >= 18 * 60 * 60 * 1000 && age <= 36 * 60 * 60 * 1000;
  });
  return previous ? { latest, previous } : null;
}

function formatJpy(value) {
  return `JPY ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

async function hasNotificationEvent(userId, eventKey) {
  const { data, error } = await supabaseAdmin
    .from(NOTIFICATIONS_TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('type', ALERT_TYPE)
    .contains('payload_json', { eventKey })
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function insertPriceNotification(row, payload, evaluation, eventKey) {
  if (await hasNotificationEvent(row.user_id, eventKey)) return false;
  const condition = payload.conditionKey === 'psa10' ? 'PSA10' : 'Single';
  const movement = payload.direction === 'above' ? '상승' : '하락';
  const body = payload.triggerType === 'percent'
    ? `${condition} 시세가 24시간 대비 ${Math.abs(evaluation.percentChange).toFixed(1)}% ${movement}했습니다. 현재 ${formatJpy(evaluation.currentPrice)}`
    : `${condition} 시세가 목표가 ${formatJpy(payload.thresholdValue)} ${payload.direction === 'above' ? '이상' : '이하'}에 도달했습니다. 현재 ${formatJpy(evaluation.currentPrice)}`;
  const { error } = await supabaseAdmin.from(NOTIFICATIONS_TABLE).insert({
    user_id: row.user_id,
    type: ALERT_TYPE,
    title: `${payload.cardName || payload.code || '카드'} 가격 ${movement} 알림`,
    body,
    link_url: `/prices?code=${encodeURIComponent(payload.code || '')}&apparelId=${payload.apparelId}`,
    payload_json: {
      eventKey,
      ruleId: row.id,
      apparelId: payload.apparelId,
      cardId: payload.cardId || '',
      code: payload.code || '',
      cardName: payload.cardName || '',
      previewImageUrl: payload.previewImageUrl || '',
      conditionKey: payload.conditionKey,
      triggerType: payload.triggerType,
      direction: payload.direction,
      thresholdValue: payload.thresholdValue,
      currentPriceJpy: evaluation.currentPrice,
      previousPriceJpy: evaluation.previousPrice || null,
      percentChange: evaluation.percentChange ?? null,
      observedAt: evaluation.observedAt
    }
  });
  if (error) throw error;
  return true;
}

async function evaluateRules(response) {
  const rows = await listRuleRows();
  const activeRows = rows.filter((row) => payloadObject(row.payload_json).active !== false);
  const apparelIds = [...new Set(activeRows.map((row) => Number(payloadObject(row.payload_json).apparelId || 0)).filter(Boolean))];
  if (!activeRows.length || !apparelIds.length) {
    return response.status(200).json({ ok: true, evaluated: 0, triggered: 0, updated: 0 });
  }

  const [currentRows, snapshotRows] = await Promise.all([fetchCurrentRows(apparelIds), fetchSnapshotRows(apparelIds)]);
  const currentById = new Map(currentRows.map((row) => [Number(row.apparel_id), row]));
  const snapshotsByKey = new Map();
  for (const row of snapshotRows) {
    const key = snapshotKey(row.apparel_id, row.condition_key);
    const list = snapshotsByKey.get(key) || [];
    list.push(row);
    snapshotsByKey.set(key, list);
  }

  let evaluated = 0;
  let triggered = 0;
  let updated = 0;
  const errors = [];
  for (const row of activeRows) {
    try {
      const payload = payloadObject(row.payload_json);
      const conditionKey = normalizeCondition(payload.conditionKey);
      const currentRow = currentById.get(Number(payload.apparelId));
      const currentPrice = Number(conditionKey === 'psa10' ? currentRow?.latest_psa10_price_jpy : currentRow?.latest_a_price_jpy) || 0;
      const observedAt = currentRow?.latest_captured_at || '';
      if (!currentPrice || !observedAt || payload.lastEvaluatedAt === observedAt) continue;

      const previousObserved = Number(payload.lastObservedPriceJpy || 0) || null;
      const pair = snapshotPair(snapshotsByKey.get(snapshotKey(payload.apparelId, conditionKey)) || []);
      const percentChange = pair ? ((pair.latest.price / pair.previous.price) - 1) * 100 : null;
      const threshold = Number(payload.thresholdValue || 0);
      let conditionMet = false;
      let previousPrice = previousObserved;
      if (payload.triggerType === 'percent') {
        previousPrice = pair?.previous.price || null;
        conditionMet = Number.isFinite(percentChange)
          && (payload.direction === 'above' ? percentChange >= threshold : percentChange <= -threshold);
      } else if (previousObserved) {
        conditionMet = payload.direction === 'above'
          ? previousObserved < threshold && currentPrice >= threshold
          : previousObserved > threshold && currentPrice <= threshold;
      }

      evaluated += 1;
      const shouldTrigger = conditionMet && payload.lastConditionMet !== true;
      const eventKey = `${row.id}:${payload.triggerType}:${observedAt}`;
      if (shouldTrigger && await insertPriceNotification(row, payload, { currentPrice, previousPrice, percentChange, observedAt }, eventKey)) {
        triggered += 1;
      }
      const nextPayload = {
        ...payload,
        lastObservedPriceJpy: currentPrice,
        lastObservedAt: observedAt,
        lastEvaluatedAt: observedAt,
        lastConditionMet: conditionMet,
        lastTriggeredAt: shouldTrigger ? new Date().toISOString() : payload.lastTriggeredAt || null
      };
      const { error } = await supabaseAdmin
        .from(NOTIFICATIONS_TABLE)
        .update({ payload_json: nextPayload })
        .eq('id', row.id)
        .eq('type', RULE_TYPE);
      if (error) throw error;
      updated += 1;
    } catch (error) {
      if (errors.length < 10) errors.push({ id: row.id, error: error?.message || 'price_alert_evaluation_failed' });
    }
  }
  return response.status(errors.length ? 500 : 200).json({ ok: !errors.length, evaluated, triggered, updated, errors });
}

export default async function handler(request, response) {
  response.setHeader?.('Cache-Control', 'no-store, private');
  response.setHeader?.('Vary', 'Authorization');
  if (!supabaseAdmin) return response.status(500).json({ error: 'supabase_admin_not_configured' });
  const action = safeString(request.query?.action, 40);

  try {
    if (request.method === 'POST' && action === 'evaluate') {
      if (!isCollectorAuthorized(request)) return response.status(401).json({ error: 'unauthorized' });
      return await evaluateRules(response);
    }
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return response.status(401).json({ error: 'unauthorized' });
    if (request.method === 'GET') return await listRules(response, user);
    if (request.method === 'POST' || request.method === 'PATCH') return await saveRule(request, response, user);
    if (request.method === 'DELETE') return await deleteRule(request, response, user);
    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'price_alert_failed' });
  }
}

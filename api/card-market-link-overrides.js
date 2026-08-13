import { supabaseAdmin } from '../lib/supabase-admin.js';
import { invalidateR2Json, readThroughR2Json } from '../lib/r2-json-cache.js';

const D1_API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const D1_ACCOUNT_ID = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const D1_DATABASE_ID = String(process.env.D1_DATABASE_ID || '').trim();
const D1_BINDING_NAME = String(process.env.MARKET_D1_BINDING || 'OPTCG_PUBLIC_D1').trim();
const OVERRIDES_CACHE_KEY = 'public-data/card-market-link-overrides-v1.json';
const OVERRIDES_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

function getD1Binding() {
  const binding = process.env?.[D1_BINDING_NAME] || process.env?.DB || null;
  return binding && typeof binding.prepare === 'function' ? binding : null;
}

async function queryD1(sql, params = []) {
  const binding = getD1Binding();
  if (binding) {
    const statement = binding.prepare(sql);
    const result = params.length ? await statement.bind(...params).all() : await statement.all();
    return result?.results || [];
  }
  if (!D1_API_TOKEN || !D1_ACCOUNT_ID || !D1_DATABASE_ID) throw new Error('d1_not_configured');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${D1_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error('d1_query_failed');
  return body.result?.[0]?.results || [];
}

function getAuthToken(request) {
  const authHeader = String(request.headers.authorization ?? '');
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function getAuthenticatedUser(request) {
  const token = getAuthToken(request);
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) throw error;
  return data?.user ?? null;
}

function isAdminUser(user) {
  return String(user?.app_metadata?.role || '').toLowerCase() === 'admin';
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('no such table') || message.includes('does not exist');
}

async function ensureTable() {
  await queryD1(`
    CREATE TABLE IF NOT EXISTS card_market_link_overrides (
      card_id TEXT PRIMARY KEY,
      apparel_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      note TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      try {
        const rows = await readThroughR2Json(
          OVERRIDES_CACHE_KEY,
          OVERRIDES_CACHE_MAX_AGE_MS,
          () => queryD1(`
            SELECT
              card_id AS cardId,
              apparel_id AS apparelId,
              status,
              note,
              updated_at AS updatedAt
            FROM card_market_link_overrides
            WHERE status IN ('approved', 'blocked')
            ORDER BY updated_at DESC
          `)
        );
        response.setHeader('Cache-Control', 'no-store, max-age=0');
        return response.status(200).json({ items: rows });
      } catch (error) {
        if (isMissingTableError(error)) return response.status(200).json({ items: [] });
        throw error;
      }
    }

    if (request.method === 'POST') {
      const user = await getAuthenticatedUser(request);
      if (!isAdminUser(user)) return response.status(403).json({ error: 'forbidden' });

      const cardId = String(request.body?.cardId || '').trim();
      const status = String(request.body?.status || 'approved').trim() === 'blocked' ? 'blocked' : 'approved';
      const apparelId = Number(request.body?.apparelId || 0);
      const note = String(request.body?.note || '').trim().slice(0, 300);
      if (!cardId || cardId.length > 120 || !Number.isFinite(apparelId) || (status === 'approved' && apparelId <= 0)) {
        return response.status(400).json({ error: 'invalid_payload' });
      }

      await ensureTable();
      await queryD1(`
        INSERT INTO card_market_link_overrides (
          card_id,
          apparel_id,
          status,
          note,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(card_id) DO UPDATE SET
          apparel_id = excluded.apparel_id,
          status = excluded.status,
          note = excluded.note,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `, [cardId, status === 'blocked' ? 0 : Math.round(apparelId), status, note, user.id]);
      await invalidateR2Json(OVERRIDES_CACHE_KEY);
      await invalidateR2Json('public-data/approved-market-overrides-v1.json');

      return response.status(200).json({
        ok: true,
        item: {
          cardId,
          apparelId: status === 'blocked' ? 0 : Math.round(apparelId),
          status,
          note
        }
      });
    }

    if (request.method === 'DELETE') {
      const user = await getAuthenticatedUser(request);
      if (!isAdminUser(user)) return response.status(403).json({ error: 'forbidden' });

      const cardId = String(request.body?.cardId || '').trim();
      if (!cardId || cardId.length > 120) return response.status(400).json({ error: 'invalid_payload' });

      await ensureTable();
      await queryD1('DELETE FROM card_market_link_overrides WHERE card_id = ?', [cardId]);
      await invalidateR2Json(OVERRIDES_CACHE_KEY);
      await invalidateR2Json('public-data/approved-market-overrides-v1.json');
      return response.status(200).json({ ok: true, cardId });
    }

    return response.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'server_error' });
  }
}

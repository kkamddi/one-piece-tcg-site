import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the real handler against two in-memory owners. Never connect to a DB.
const compiled = await build({
  entryPoints: ['api/portfolio.js'], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'isolated-portfolio', setup(builder) {
    builder.onResolve({ filter: /(?:supabase-admin|user-state-store)\.js$/ }, ({ path }) => ({ path, namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'js', contents:
      'export const { supabaseAdmin, getUserAppState, saveUserAppState } = globalThis.services;'
    }));
  } }]
});
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function harness() {
  const rows = {
    portfolio_holdings: ['a', 'b'].map((user_id, i) => ({ id: id(i + 1), user_id, apparel_id: 10, code: 'TEST-001', grade: 'a' })),
    portfolio_purchases: ['a', 'b'].map((user_id, i) => ({ id: id(i + 3), holding_id: id(i + 1), user_id, quantity: 1, mode: 'manual', original_currency: 'KRW', original_unit_price: 1000, unit_price_jpy: 106 }))
  };
  let sequence = 10;
  const operations = [];
  const services = {
    getUserAppState: async (owner) => { assert.ok(['a', 'b'].includes(owner)); return { portfolioMigratedAt: 'already-migrated' }; },
    saveUserAppState: () => { throw new Error('Unexpected migration write'); },
    supabaseAdmin: {
      auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) },
      from(table) {
        assert.ok(Object.hasOwn(rows, table));
        let action = 'select', values, single = false, conflict;
        const filters = [];
        const query = {
          select() { return this; }, order() { return this; },
          eq(key, value) { filters.push([key, value]); return this; },
          update(value) { action = 'update'; values = value; return this; },
          insert(value) { action = 'insert'; values = value; return this; },
          upsert(value, options) { action = 'upsert'; values = value; conflict = options.onConflict; return this; },
          delete() { action = 'delete'; return this; },
          single() { single = true; return this; }, maybeSingle() { single = true; return this; },
          then(resolve, reject) {
            try {
              operations.push({ table, action, filters: [...filters], values, conflict });
              let data = rows[table].filter(row => filters.every(([key, value]) => row[key] === value));
              if (action === 'update') data.forEach(row => Object.assign(row, values));
              if (action === 'delete') rows[table] = rows[table].filter(row => !data.includes(row));
              if (action === 'insert' || action === 'upsert') {
                const existing = action === 'upsert' && rows[table].find(row => conflict.split(',').every(key => row[key] === values[key]));
                const row = existing || { id: id(sequence++) };
                Object.assign(row, values);
                if (!existing) rows[table].push(row);
                data = [row];
              }
              return Promise.resolve({ data: single ? data[0] || null : data, error: null }).then(resolve, reject);
            } catch (error) { return Promise.reject(error).then(resolve, reject); }
          }
        };
        return query;
      }
    }
  };
  const context = { module: { exports: {} }, process: { env: {} }, services };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  return { rows, operations, async request(owner, method = 'GET', query = {}, body = {}) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await context.module.exports.default({ method, headers: { authorization: `Bearer ${owner}` }, query, body }, response);
    return response;
  } };
}

test('GET ignores a forged owner and returns only the authenticated holdings and purchases', async () => {
  const h = harness();
  for (const owner of ['a', 'b']) {
    const r = await h.request(owner, 'GET', { user_id: owner === 'a' ? 'b' : 'a' });
    assert.equal(r.code, 200);
    assert.equal(r.body.holdings.length, 1);
    assert.equal(r.body.holdings[0].id, id(owner === 'a' ? 1 : 2));
    assert.equal(r.body.holdings[0].purchases[0].id, id(owner === 'a' ? 3 : 4));
    assert.equal(r.headers['Cache-Control'], 'no-store, private');
    assert.equal(r.headers.Vary, 'Authorization');
  }
});

for (const target of ['holdingId', 'purchaseId']) test(`DELETE foreign ${target} leaves both accounts unchanged`, async () => {
  const h = harness(), before = JSON.stringify(h.rows);
  const r = await h.request('a', 'DELETE', { [target]: id(target === 'holdingId' ? 2 : 4), user_id: 'b' });
  assert.equal(r.code, 200);
  assert.equal(JSON.stringify(h.rows), before);
  assert.equal(r.body.holdings.length, 1);
  assert.equal(r.body.holdings[0].id, id(1));
});

test('POST ignores forged ownership and preserves the original purchase currency and amount', async () => {
  const h = harness(), foreignBefore = JSON.stringify(h.rows.portfolio_purchases[1]);
  const r = await h.request('a', 'POST', {}, {
    user_id: 'b', holding: { apparelId: 11, code: 'TEST-002', user_id: 'b' },
    purchase: { user_id: 'b', holding_id: id(2), mode: 'manual', quantity: 1, originalCurrency: 'KRW', originalUnitPrice: 1000, unitPriceJpy: 106 }
  });
  assert.equal(r.code, 200);
  const created = h.rows.portfolio_purchases.at(-1);
  assert.equal(created.user_id, 'a');
  assert.notEqual(created.holding_id, id(2));
  assert.equal(created.original_unit_price, 1000);
  assert.equal(JSON.stringify(h.rows.portfolio_purchases[1]), foreignBefore);
  assert.equal((await h.request('b')).body.holdings.length, 1);
});

test('PATCH with a foreign purchase ID never updates or transfers that purchase', async () => {
  const h = harness(), foreignBefore = JSON.stringify(h.rows.portfolio_purchases[1]);
  const r = await h.request('a', 'PATCH', {}, { holding: { apparelId: 10, code: 'TEST-001' }, purchase: { id: id(4), quantity: 9 } });
  assert.equal(r.code, 200);
  assert.equal(JSON.stringify(h.rows.portfolio_purchases[1]), foreignBefore);
  // Current API semantics fall back to creating a new purchase for the caller.
  assert.equal(h.rows.portfolio_purchases.at(-1).user_id, 'a');
  assert.notEqual(h.rows.portfolio_purchases.at(-1).id, id(4));
});

test('own purchase update/delete succeeds without modifying the other owner', async () => {
  const h = harness(), foreignBefore = JSON.stringify(h.rows.portfolio_purchases[1]);
  assert.equal((await h.request('a', 'PATCH', {}, { holding: { apparelId: 10, code: 'TEST-001' }, purchase: { id: id(3), quantity: 2 } })).code, 200);
  assert.equal(h.rows.portfolio_purchases[0].quantity, 2);
  assert.equal((await h.request('a', 'DELETE', { purchaseId: id(3) })).code, 200);
  assert.equal(h.rows.portfolio_purchases.length, 1);
  assert.equal(JSON.stringify(h.rows.portfolio_purchases[0]), foreignBefore);
});

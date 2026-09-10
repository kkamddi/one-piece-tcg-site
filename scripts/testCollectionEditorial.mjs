import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { COLLECTION_EDITORIAL } from '../lib/collection-editorial.js';
import { applySeo, getPageSeo } from '../functions/_middleware.js';

const template = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../src/CollectionGuide.jsx', import.meta.url), 'utf8');
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const staticHtml = applySeo(template, '/guide/collection/start', getPageSeo('/guide/collection/start'));

function renderGuide(path) {
  const code = source.replace(/^import .*?;\r?\n/gm, '').replace(/import \{[\s\S]*?\} from '\.\/data\/collection-guide';\r?\n/, '').replace('export default function CollectionGuide', 'function CollectionGuide');
  const compiled = transformSync(code.replaceAll('import.meta.env.VITE_CARD_THUMBNAIL_BASE_URL', 'undefined'), { loader: 'jsx' }).code;
  const fakeReact = { useEffect() {}, useMemo: (fn) => fn(), useState: (initial) => [initial, () => {}] };
  const factory = new Function('React', 'useEffect', 'useMemo', 'useState', 'COLLECTION_EDITORIAL', 'MANGA_COLLECTION_GROUPS', 'CHAMPIONSHIP_COLLECTION_GROUPS', 'FLAGSHIP_COLLECTION_GROUPS', 'PROMO_COLLECTION_GROUPS', 'window', `${compiled}\nreturn CollectionGuide;`);
  const Guide = factory(React, fakeReact.useEffect, fakeReact.useMemo, fakeReact.useState, COLLECTION_EDITORIAL, [], { JP: [], KR: [] }, { JP: [] }, [], { location: { pathname: path, hash: '' } });
  return renderToStaticMarkup(React.createElement(Guide));
}

test('collection article is present in both the app and initial HTML', () => {
  const visibleHtml = renderGuide('/guide/collection/start');
  for (const section of COLLECTION_EDITORIAL.sections) {
    for (const value of [section.heading, ...(section.paragraphs || []), ...(section.items || [])]) {
      assert.ok(staticHtml.includes(escape(value)), `Initial HTML missing: ${value}`);
      assert.ok(visibleHtml.includes(escape(value)), `App missing: ${value}`);
    }
    for (const link of section.links || []) {
      assert.ok(staticHtml.includes(`href="${escape(link.href)}"`));
      assert.ok(visibleHtml.includes(`href="${escape(link.href)}"`));
    }
  }
});

test('standalone article has one heading and no card listing or loading indicator', () => {
  const html = renderGuide('/guide/collection/start');
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(html.includes('class="is-active" href="/guide/collection/start"'));
  assert.ok(!html.includes('도감 카드를 불러오는 중'));
  assert.ok(!html.includes('id="manga"'));
  assert.ok(html.includes('수집 방향 선택 기준'));
  assert.ok(html.includes(COLLECTION_EDITORIAL.reviewedAt));
});

test('specific collection lists do not repeat the overview article', () => {
  const collection = renderGuide('/guide/collection');
  assert.ok(!collection.includes('수집 방향 선택 기준'));
  assert.ok(collection.includes('id="manga"'));
  assert.ok(collection.includes('href="/guide/collection/start"'));
  const html = renderGuide('/guide/collection/manga');
  assert.ok(!html.includes('수집 방향 선택 기준'));
  assert.ok(html.includes('class="is-active"'));
});

test('article metadata and verified publisher files remain consistent', () => {
  assert.equal(getPageSeo('/guide/collection/start').reviewedAt, COLLECTION_EDITORIAL.reviewedAt);
  assert.ok(staticHtml.includes('https://www.optcgkorea.com/guide/collection/start'));
  const ads = fs.readFileSync(new URL('../public/ads.txt', import.meta.url), 'utf8').trim();
  const publisher = template.match(/name="google-adsense-account" content="ca-(pub-\d+)"/)?.[1];
  assert.equal(ads, `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`);
});

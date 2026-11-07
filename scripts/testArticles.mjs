import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES_PATH, ARTICLE_CATEGORIES, getArticleSlug, getKstMinuteKeyFor, getPublishedArticleMetas } from '../lib/articles.js';
import { getArticleEntries, readArticles } from './articlesSeo.js';

const articlesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/articles');
const files = fs.existsSync(articlesDir) ? fs.readdirSync(articlesDir).filter((name) => name.endsWith('.json')) : [];
const articles = readArticles();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const len = (value) => [...String(value || '')].length;

test('every article file has the fields the page, SEO and hub read', () => {
  for (const name of files) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, name), 'utf8'));
    const { meta, editorial, faq = [] } = article;
    const where = name;
    assert.equal(`${meta.slug}.json`, name, `${where}: slug matches the file name`);
    assert.match(meta.slug, /^[a-z0-9-]+$/, `${where}: slug`);
    assert.match(meta.publishAt, DATE, `${where}: publishAt`);
    assert.ok([1, 2, 3].includes(meta.order), `${where}: order 1-3`);
    if (meta.publishTime !== undefined) assert.match(meta.publishTime, /^([01]\d|2[0-3]):[0-5]\d$/, `${where}: publishTime`);
    assert.ok(ARTICLE_CATEGORIES[meta.category], `${where}: category`);
    assert.ok(len(meta.label) >= 6 && len(meta.label) <= 40, `${where}: label length ${len(meta.label)}`);
    assert.ok(len(meta.summary) >= 10 && len(meta.summary) <= 60, `${where}: summary length ${len(meta.summary)}`);
    assert.ok(meta.title.endsWith(' | Card Pone') && len(meta.title) <= 80, `${where}: title`);
    assert.ok(len(meta.description) >= 60 && len(meta.description) <= 170, `${where}: description length ${len(meta.description)}`);
    assert.ok(meta.keywords?.includes('원피스'), `${where}: keywords`);
    assert.ok(Array.isArray(meta.related), `${where}: related`);
    for (const href of meta.related) assert.ok(href.startsWith('/'), `${where}: related ${href}`);
    if (meta.cta) for (const key of ['eyebrow', 'title', 'description', 'href', 'label']) assert.ok(meta.cta[key], `${where}: cta.${key}`);

    assert.ok(len(editorial.heading) >= 10, `${where}: heading`);
    assert.match(editorial.reviewedAt, DATE, `${where}: reviewedAt`);
    assert.ok(editorial.reviewedAt <= meta.publishAt, `${where}: reviewed before publishing`);
    assert.ok(editorial.paragraphs.length >= 2, `${where}: intro paragraphs`);
    assert.ok(editorial.sections.length >= 3, `${where}: at least 3 sections`);
    const headings = editorial.sections.map((section) => section.heading);
    assert.equal(new Set(headings).size, headings.length, `${where}: section headings are unique`);
    for (const section of editorial.sections) {
      const blocks = ['paragraphs', 'items', 'stats', 'table', 'images', 'links', 'bars'].filter((key) => (Array.isArray(section[key]) ? section[key].length : section[key]));
      assert.ok(section.heading && blocks.length, `${where}: section "${section.heading}" has content`);
      if (section.table) for (const row of section.table.rows) assert.equal(row.length, section.table.columns.length, `${where}: table row width in "${section.heading}"`);
    }
    for (const entry of faq) assert.ok(Array.isArray(entry) && entry.length === 2 && entry[0].endsWith('?'), `${where}: faq entry`);
  }
});

test('slugs are unique and at most three articles share a day, each with its own order', () => {
  const slugs = articles.map((article) => article.meta.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  const byDay = new Map();
  for (const { meta } of articles) byDay.set(meta.publishAt, [...(byDay.get(meta.publishAt) || []), meta.order]);
  for (const [day, orders] of byDay) {
    assert.ok(orders.length <= 3, `${day}: ${orders.length} articles`);
    assert.equal(new Set(orders).size, orders.length, `${day}: order repeats`);
  }
});

test('article images point at dex cards', () => {
  const cardIds = new Set(JSON.parse(fs.readFileSync(path.join(articlesDir, '../cards.json'), 'utf8')).map((card) => card.id));
  for (const { meta, editorial } of articles) {
    for (const image of editorial.sections.flatMap((section) => section.images || [])) {
      const match = String(image.src).match(/key=cards\/(KR|JP)\/(.+)\.webp$/);
      assert.ok(match && cardIds.has(`${match[1]}::${decodeURIComponent(match[2])}`), `${meta.slug}: ${image.src}`);
    }
  }
});

test('links to other articles point at articles that exist', () => {
  const slugs = new Set(articles.map((article) => article.meta.slug));
  for (const { meta } of articles) {
    for (const href of meta.related.filter((value) => value.startsWith(`${ARTICLES_PATH}/`))) {
      assert.ok(slugs.has(getArticleSlug(href)), `${meta.slug}: ${href}`);
    }
  }
});

test('articles go live at their slot time (KST), newest first', () => {
  const metas = [
    { slug: 'a', publishAt: '2026-11-06', order: 2 },
    { slug: 'b', publishAt: '2026-11-06', order: 1 },
    { slug: 'c', publishAt: '2026-11-07', order: 1 },
    { slug: 'd', publishAt: '2026-11-05', order: 3 },
    { slug: 'e', publishAt: '2026-11-06', order: 3, publishTime: '00:00' }
  ];
  const live = (nowKey) => getPublishedArticleMetas(metas, nowKey).map((meta) => meta.slug);
  assert.deepEqual(live('2026-11-06T06:59'), ['e', 'd']);
  assert.deepEqual(live('2026-11-06T07:00'), ['b', 'e', 'd']);
  assert.deepEqual(live('2026-11-06T12:30'), ['a', 'b', 'e', 'd']);
  assert.deepEqual(live('2026-11-06'), ['a', 'b', 'e', 'd']);
  assert.equal(getKstMinuteKeyFor(Date.UTC(2026, 10, 5, 22, 0)), '2026-11-06T07:00');
  assert.equal(getArticleSlug('/guide/articles/st31-st36-starter-decks'), 'st31-st36-starter-decks');
  assert.equal(getArticleSlug('/guide/articles'), '');
});

test('pre-rendered entries follow the build date', () => {
  if (!articles.length) return;
  const first = articles.map((article) => article.meta.publishAt).sort()[0];
  assert.deepEqual(getArticleEntries({ today: '2000-01-01' }), []);
  const entries = getArticleEntries({ today: first });
  assert.equal(entries[0].pathname, ARTICLES_PATH);
  assert.ok(entries.slice(1).every((entry) => entry.publishAt <= first));
});

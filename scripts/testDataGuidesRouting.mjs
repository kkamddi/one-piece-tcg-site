import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getReleaseScheduleEntries } from './releaseScheduleSeo.js';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');

test('character, PSA and release guides are routed, listed, searchable and in the sitemap', async () => {
  const [app, middleware, sitemap, search] = await Promise.all([read('../src/RenewApp.jsx'), read('../functions/_middleware.js'), read('./generatePrimarySitemap.js'), read('../src/lib/site-search.js')]);
  for (const [path, flag, component, key] of [
    ['/guide/character-cards', 'isCharacterCardsGuide', 'RenewCharacterCardsGuide', 'character'],
    ['/guide/psa-grading', 'isPsaGradingGuide', 'RenewPsaGradingGuide', 'psa'],
    ['/guide/release-schedule', 'isReleaseScheduleGuide', 'RenewReleaseScheduleGuide', 'release'],
    ['/guide/new-boosters', 'isNewBoostersGuide', 'RenewNewBoostersGuide', 'newBoosters']
  ]) {
    assert.match(app, new RegExp(`const ${flag} = initialPath === '${path}';`));
    assert.match(app, new RegExp(`${flag} \\? <${component} /> : null`));
    assert.match(app, new RegExp(`!${flag} &&`));
    assert.match(app, new RegExp(`guideKey="${key}"`));
    assert.match(app, new RegExp(`\\n  ${key}: \\{\\r?\\n    checklistTitle:`));
    assert.match(app, new RegExp(`href: '${path}', title:`));
    assert.ok(app.includes(`if (path === '${path}')`));
    assert.match(sitemap, new RegExp(`'${path}'`));
    assert.match(search, new RegExp(`href: '${path}'`));
  }
  assert.match(middleware, /'\/guide\/character-cards': editorialPageContent\(CHARACTER_CARDS_EDITORIAL/);
  assert.match(middleware, /'\/guide\/psa-grading': editorialPageContent\(PSA_GRADING_EDITORIAL/);
  assert.match(middleware, /'\/guide\/new-boosters': editorialPageContent\(NEW_BOOSTERS_EDITORIAL/);
  // The release schedule depends on topics.json, which stays out of the Functions bundle.
  assert.doesNotMatch(middleware, /topics\.json/);
});

test('the release schedule page is pre-rendered from the topics of the build', () => {
  const [entry] = getReleaseScheduleEntries('2026-10-07');
  assert.equal(entry.pathname, '/guide/release-schedule');
  assert.ok(entry.seo.heading && entry.seo.sections.length > 3);
  assert.equal(entry.seo.sections[0].heading, '핵심 숫자');
  assert.equal(entry.seo.sections.at(-1).heading, '발매 일정 체크리스트');
});

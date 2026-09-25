import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const source = await readFile(new URL('../src/RenewApp.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let available, rules;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.name === 'legalityRulesAvailable') available = node.init;
  if (node.type === 'VariableDeclarator' && node.id.name === 'ruleRows') rules = node.init;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.ok(available && rules);
function check(activeEnvironment, deckReferenceData, invalidLegalityEntries = []) {
  const context = vm.createContext({ activeEnvironment, deckReferenceData, invalidLegalityEntries,
    uiLang: 'EN', getLocaleText: (_lang, _ko, en) => en, deckBuilder: { leader: {} },
    totalCards: 50, countsByCardNo: {}, invalidColorEntries: [] });
  vm.runInContext(`var legalityRulesAvailable = ${source.slice(available.start, available.end)};`, context);
  return vm.runInContext(source.slice(rules.start, rules.end), context).at(-1);
}
test('missing or malformed rule references never claim validation success', () => {
  for (const [environment, data] of [[null, null], [{ id: 'test' }, null], [null, { legalityRules: [] }], [{ id: 'test' }, {}]]) {
    const rule = check(environment, data);
    assert.equal(rule.valid, false);
    assert.match(rule.label, /unavailable/);
  }
});
test('loaded rules preserve valid and invalid deck checks', () => {
  assert.equal(check({ id: 'test' }, { legalityRules: [] }).valid, true);
  assert.equal(check({ id: 'test' }, { legalityRules: [] }, [{}]).valid, false);
});

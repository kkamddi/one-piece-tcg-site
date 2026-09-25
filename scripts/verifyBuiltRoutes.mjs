import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Run the existing sitemap/SEO generators against an isolated Vite output.
// No repository files, production services or configuration are modified.
const root = fileURLToPath(new URL('../', import.meta.url));
assert.ok(process.argv[2], 'Pass a freshly generated isolated Vite output directory');
const output = path.resolve(process.argv[2]);
assert.equal(path.dirname(output), path.resolve(tmpdir()));
assert.ok(path.basename(output).startsWith('card-pone-verify-'));
assert.ok(!output.startsWith(path.resolve(root) + path.sep) && output !== path.resolve(root));
assert.ok(fs.existsSync(path.join(output, 'index.html')));
const virtual = new Map();
const sitemapNames = ['sitemap.xml', 'sitemap-jp.xml'];
const sitemapPaths = new Map(sitemapNames.map(name => [path.join(root, 'public', name), name]));
const safeFs = {
  ...fs,
  mkdirSync(file, ...args) {
    const absolute = path.resolve(String(file));
    assert.ok(absolute === output || absolute.startsWith(output + path.sep));
    return fs.mkdirSync(absolute, ...args);
  },
  readFileSync(file, ...args) {
    return virtual.has(String(file)) ? virtual.get(String(file)) : fs.readFileSync(file, ...args);
  },
  writeFileSync(file, data, ...args) {
    const absolute = path.resolve(String(file));
    if (sitemapPaths.has(absolute)) {
      virtual.set(absolute, data);
      return fs.writeFileSync(path.join(output, sitemapPaths.get(absolute)), data, ...args);
    }
    assert.ok(absolute.startsWith(output + path.sep), 'Generator write escaped build directory');
    return fs.writeFileSync(absolute, data, ...args);
  }
};
for (const name of ['generatePrimarySitemap.js', 'generateJapaneseSitemap.js', 'generateStaticSeoPages.js']) {
  const url = new URL(name, import.meta.url);
  let source = fs.readFileSync(url, 'utf8');
  source = source.replace("const distDir = path.join(rootDir, 'dist');", `const distDir = ${JSON.stringify(output)};`);
  const module = new vm.SourceTextModule(source, {
    identifier: url.href, initializeImportMeta(meta) { meta.url = url.href; }
  });
  await module.link(async specifier => {
    const imported = specifier === 'node:fs' ? { default: safeFs } :
      await import(specifier.startsWith('.') ? new URL(specifier, url).href : specifier);
    return new vm.SyntheticModule(Object.keys(imported), function () {
      for (const key of Object.keys(imported)) this.setExport(key, imported[key]);
    });
  });
  await module.evaluate();
}
const routes = new Set(['/portfolio', '/jp/portfolio', '/search', '/jp/search']);
for (const name of sitemapNames) {
  for (const match of fs.readFileSync(path.join(output, name), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    routes.add(new URL(match[1]).pathname);
  }
}
let checked = 0;
for (const route of routes) {
  const filename = path.join(output, route === '/' ? 'index.html' : `${decodeURIComponent(route).replace(/^\//, '')}.html`);
  assert.ok(fs.existsSync(filename), `Missing route: ${route}`);
  const html = fs.readFileSync(filename, 'utf8');
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /rel="canonical"/);
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)) {
    assert.ok(fs.existsSync(path.join(output, match[1])), `Missing asset for ${route}`);
  }
  if (route.endsWith('/portfolio')) assert.match(html, /noindex/);
  checked++;
}
assert.ok(fs.existsSync(path.join(output, '404.html')));
console.log(JSON.stringify({ checkedRoutes: checked, missingAssets: 0, portfolioNoindex: true }));

// Static integrity checks for the Chatora repo (run from the repo root):
//   node tests/static-checks.mjs
// 1. Internal links/src in every HTML file resolve to files that exist.
// 2. All locale directories carry the same page set as the English root.
// 3. Every blog-*.jsonld file is valid JSON.
// 4. No stale production domain references survive in served HTML's visible URLs.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['ar', 'es', 'fr', 'de', 'pt'];
const htmlIn = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.html'));

const rootPages = htmlIn('.').sort();
// Root-only by design: Google Search Console verification file, and
// sector-templates.html (locales link to the English page; worker.js rewrites
// href="sector-templates.html" to "/sector-templates.html" on locale pages).
const ROOT_ONLY = ['googleda1005973967e48b.html', 'sector-templates.html'];

test('locale directories mirror the English page set', () => {
  const want = rootPages.filter((p) => !ROOT_ONLY.includes(p));
  for (const loc of LOCALES) {
    const pages = htmlIn(loc).sort();
    assert.deepEqual(pages, want, loc + '/ page set differs from root');
  }
});

function* links(dir, file) {
  const src = readFileSync(join(root, dir, file), 'utf8');
  for (const m of src.matchAll(/(?:href|src)="([^"#]+?)(?:#[^"]*)?"/g)) {
    const u = m[1].split('?')[0];
    if (!u || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(u)) continue;
    yield [dir, file, u];
  }
}

test('internal links and assets resolve to existing files', () => {
  const broken = [];
  for (const dir of ['.', ...LOCALES]) {
    for (const file of htmlIn(dir)) {
      for (const [, from, u] of links(dir, file)) {
        if (u.startsWith('/')) {
          const p = join(root, u);
          if (!existsSync(p) && !existsSync(join(root, u, 'index.html'))) broken.push(from + ' -> ' + u);
        } else {
          const p = join(root, dir === '.' ? '' : dir, u);
          if (!existsSync(p)) broken.push(join(dir, from) + ' -> ' + u);
        }
      }
    }
  }
  assert.deepEqual(broken.slice(0, 20), [], broken.length + ' broken internal links');
});

test('blog jsonld files are valid JSON', () => {
  const bad = [];
  for (const f of readdirSync(root).filter((f) => f.endsWith('.jsonld'))) {
    try { JSON.parse(readFileSync(join(root, f), 'utf8')); } catch (e) { bad.push(f); }
  }
  assert.deepEqual(bad, []);
});

test('stale ansygroup.com strings are only the two the worker rewrites live', () => {
  // worker.js rewrites 'chatora.ansygroup.com' -> 'chatora.us.ci' and the
  // hello@ alias on every HTML response. Any OTHER ansygroup string in served
  // HTML would leak the old domain.
  const allowed = new Set(['chatora.ansygroup.com', 'hello@chatora.ansygroup.com']);
  const hits = new Set();
  for (const dir of ['.', ...LOCALES]) {
    for (const file of htmlIn(dir)) {
      const src = readFileSync(join(root, dir, file), 'utf8');
      for (const m of src.matchAll(/[a-zA-Z0-9.@-]*ansygroup[a-zA-Z0-9.@-]*/g)) {
        if (!allowed.has(m[0])) hits.add(join(dir, file) + ': ' + m[0]);
      }
    }
  }
  assert.deepEqual([...hits].slice(0, 10), [], hits.size + ' unrewritten stale references');
});

test('locale pages carry matching lang and dir attributes', () => {
  for (const loc of LOCALES) {
    const idx = readFileSync(join(root, loc, 'index.html'), 'utf8');
    assert.ok(idx.includes('lang="' + loc + '"'), loc + ': lang attribute');
    assert.equal(idx.includes('dir="rtl"'), loc === 'ar', loc + ': rtl only for Arabic');
  }
});

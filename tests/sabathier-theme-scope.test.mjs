import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/sabathier-theme.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('imports the generated tokens first', () => {
  assert.match(css.trimStart(), /^@import '\.\/sabathier-tokens\.css';/);
});

// Split a selector list on top-level commas only (not inside :is(...) / :not(...)).
function splitList(sel) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  return [...parts, cur];
}

test('every rule is scoped to the finance variant', () => {
  const selectors = [...css.replace(/@import[^;]+;/g, '').matchAll(/([^{}@]+)\{/g)].map((m) => m[1].trim()).filter(Boolean);
  assert.ok(selectors.length > 10);
  for (const sel of selectors) {
    for (const part of splitList(sel)) {
      assert.match(part.trim(), /^(:root)?\[data-variant="finance"\]/, `unscoped selector: ${part.trim()}`);
    }
  }
});

test('maps the main Terminal variables onto the site tokens', () => {
  for (const v of ['--bg', '--surface', '--panel-bg', '--border', '--text', '--text-dim', '--accent', '--green', '--font-body-base', '--font-mono']) {
    assert.match(css, new RegExp(`${v}:\\s*[^;]+;`), v);
  }
});

test('severity colours are left alone (only --semantic-positive follows --up, as the spec maps it)', () => {
  assert.doesNotMatch(css, /--semantic-(critical|high|elevated|normal|low|info)\s*:/);
  assert.doesNotMatch(css, /--(threat|defcon)-[a-z0-9-]+\s*:/);
});

test('main.ts loads the theme for the finance variant only', () => {
  assert.match(main, /SITE_VARIANT === 'finance'[\s\S]{0,200}loadVariantThemeStylesheet\('finance', \(\) => import\('\.\/styles\/sabathier-theme\.css'\)\)/);
});

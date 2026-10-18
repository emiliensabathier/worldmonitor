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
  const selectors = [...css.replace(/@import[^;]+;/g, '').replace(/@media[^{]+\{/g, '').matchAll(/([^{}@]+)\{/g)].map((m) => m[1].trim()).filter(Boolean);
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

test('the active-state restyle only targets controls, never overlays or markers that use .active for "shown"', () => {
  const rule = css.match(/([^{}]*\.mission-preset-button--active[^{}]*)\{/)[1];
  assert.match(rule, /:is\(button, \[role="tab"\], \[role="option"\], \.layer-toggle, \.mobile-tab\)/);
  assert.doesNotMatch(css, /\[data-variant="finance"\] :is\(\.active/);
});

test('the coverage row stays in the accessibility tree (visually hidden, not display:none)', () => {
  const rule = css.match(/\.digest-coverage-row\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /display:\s*none/);
  assert.match(rule, /clip:\s*rect\(0 0 0 0\)/);
});

test('on mobile the footer collapses like upstream (only the status container stays)', () => {
  assert.match(css, /@media \(max-width: 768px\)\s*\{[^@]*\[data-variant="finance"\] \.site-footer\.es-foot > :not\(\.status-panel-container\)\s*\{\s*display:\s*none;/);
});

test('the 2D map (drawn from --map-* variables) gets the paper palette, grid hidden in the water colour', () => {
  const light = css.match(/:root\[data-variant="finance"\]\s*\{([^}]*)\}/)[1];
  const dark = css.match(/:root\[data-variant="finance"\]\[data-theme="dark"\]\s*\{([^}]*)\}/)[1];
  for (const [block, bg, land] of [[light, '#e3e9f3', '#fbfaf6'], [dark, '#0f1420', '#1a1c21']]) {
    assert.match(block, new RegExp(`--map-bg:\\s*${bg};`));
    assert.match(block, new RegExp(`--map-grid:\\s*${bg};`));
    assert.match(block, new RegExp(`--map-country:\\s*${land};`));
    assert.match(block, /--map-stroke:\s*#[0-9a-f]{6};/);
  }
});

test('no space is reserved for the upstream Pro banner (the fork never shows it)', () => {
  assert.match(css, /:root\[data-variant="finance"\]\.wm-pro-banner-reserved \.pro-banner-slot\s*\{\s*min-height:\s*0;/);
  assert.match(css, /:root\[data-variant="finance"\]\.wm-pro-banner-reserved #app::before\s*\{\s*content:\s*none;\s*display:\s*none;/);
});

test('suggested Mission button and live data badge drop their hard-coded greens', () => {
  assert.match(css, /\[data-variant="finance"\] \.mission-preset-button--suggested\s*\{\s*border-color:\s*var\(--pen\);/);
  assert.match(css, /\[data-variant="finance"\] \.panel-data-badge\.live\s*\{[^}]*border-color:\s*var\(--rule\);[^}]*background:\s*transparent;/);
});

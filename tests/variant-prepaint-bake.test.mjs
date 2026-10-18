// The build bakes a non-full variant into index.html's inline prepaint script. The baked script
// must still parse and run: a syntax error there silently skips the first-paint theme and variant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeVariantIntoPrepaint } from '../shared/variant-prepaint.mjs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const prepaint = (html) => html.match(/<script data-wm-prepaint>([\s\S]*?)<\/script>/)[1];

function run(script, stored) {
  const dataset = {};
  const classes = new Set();
  const documentElement = { dataset, classList: { add: (c) => classes.add(c) }, removeAttribute: (a) => { if (a === 'data-variant') delete dataset.variant; } };
  const store = { ...stored };
  const localStorage = { getItem: (k) => store[k] ?? null, removeItem: (k) => { delete store[k]; } };
  const window = { matchMedia: () => ({ matches: false }) };
  window.self = window; window.top = window;
  new Function('location', 'document', 'localStorage', 'window', script)(
    { hostname: 'emiliensabathier.fr' }, { documentElement }, localStorage, window,
  );
  return { dataset, classes };
}

test('the baked finance prepaint parses and sets variant and stored theme before paint', () => {
  const script = prepaint(bakeVariantIntoPrepaint(indexHtml, 'finance'));
  assert.doesNotThrow(() => new Function(script));
  const { dataset, classes } = run(script, { 'worldmonitor-theme': 'light' });
  assert.equal(dataset.variant, 'finance');
  assert.equal(dataset.theme, 'light');
  assert.ok(classes.has('js'));
});

test('the full variant keeps the source script untouched', () => {
  assert.equal(bakeVariantIntoPrepaint(indexHtml, 'full'), indexHtml);
});

test('the source script still contains the pattern the bake relies on', () => {
  assert.notEqual(bakeVariantIntoPrepaint(indexHtml, 'finance'), indexHtml);
});

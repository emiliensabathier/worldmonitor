import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criticalSabathierCss } from '../shared/sabathier-critical.mjs';

test('critical CSS carries the token and variable-mapping blocks, no fonts and nothing unscoped beyond :root', () => {
  const tokens = readFileSync(new URL('../src/styles/sabathier-tokens.css', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../src/styles/sabathier-theme.css', import.meta.url), 'utf8');
  const out = criticalSabathierCss(tokens, theme);
  assert.match(out, /--paper:\s*#fdfdfb/);
  assert.match(out, /:root\[data-variant="finance"\]\s*\{[^}]*--bg:\s*var\(--paper\)/);
  assert.match(out, /:root\[data-variant="finance"\]\[data-theme="dark"\]/);
  assert.doesNotMatch(out, /@font-face|\.es-nav|\.panel/);
  assert.ok(out.length < 4000, `critical CSS too large: ${out.length}`);
});

test('the finance build injects it into index.html', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(vite, /data-sabathier-critical/);
});

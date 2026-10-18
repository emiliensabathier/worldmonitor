import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildTokens } from '../scripts/sync-sabathier-tokens.mjs';

const file = readFileSync(new URL('../src/styles/sabathier-tokens.css', import.meta.url), 'utf8');

test('the committed copy was not edited by hand', () => {
  const header = /body-sha256: ([0-9a-f]{64}) \*\/\n/.exec(file);
  assert.ok(header, 'generated header missing');
  const body = file.slice(header.index + header[0].length);
  assert.equal(createHash('sha256').update(body).digest('hex'), header[1]);
});

test('font URLs point at the Terminal copy of the fonts', () => {
  assert.doesNotMatch(file, /\/site\/fonts\//);
  assert.match(file, /url\("\/site-fonts\/source-serif-4-latin-opsz-normal\.woff2"\)/);
});

test('buildTokens is deterministic and rewrites font paths', () => {
  const a = buildTokens('a { src: url("/site/fonts/x.woff2"); }', '.es-nav{}');
  assert.equal(a, buildTokens('a { src: url("/site/fonts/x.woff2"); }', '.es-nav{}'));
  assert.match(a, /\/site-fonts\/x\.woff2/);
});

test('token names do not collide with the Terminal (no --text-sm etc. redefined elsewhere)', () => {
  assert.match(file, /--paper:/);
  assert.match(file, /\.es-nav\b/);
});

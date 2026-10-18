import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/app/panel-layout.ts', import.meta.url), 'utf8');

test('the site nav is rendered above the header for the web finance build', () => {
  assert.match(src, /import \{ mountSiteNav, renderSiteNav \} from '@\/app\/site-nav';/);
  assert.match(src, /\$\{esSite \? renderSiteNav\(getCurrentLanguage\(\)\) : ''\}\s*<div class="header" role="banner">/);
  assert.match(src, /if \(esSite\) mountSiteNav\(this\.ctx\.container\);/);
});

test('the fork-only Labs and Source header links are gone', () => {
  assert.doesNotMatch(src, /<a class="copy-link-btn" href="\/labs\/">Labs<\/a>/);
});

test('the footer keeps its hook class, the AGPL source link and the upstream credit', () => {
  assert.match(src, /<footer class="site-footer es-foot">/);
  assert.match(src, /href="\/labs\/source\.txt"/);
  assert.match(src, /Built on World Monitor/);
  assert.doesNotMatch(src, /SABATHIER TERMINAL<\/span>\s*<span class="site-footer-sub">/);
});

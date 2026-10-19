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

test('the footer keeps its hook class and the AGPL licence and source link (upstream copyright lives there)', () => {
  assert.match(src, /<footer class="site-footer es-foot">/);
  assert.match(src, /href="\/labs\/source\.txt">\$\{getCurrentLanguage\(\) === 'fr' \? 'Licence et source \(AGPL-3\.0\)' : 'Licence and source \(AGPL-3\.0\)'\}/);
  assert.doesNotMatch(src, /Built on World Monitor|Basé sur World Monitor/);
  assert.doesNotMatch(src, /SABATHIER TERMINAL<\/span>\s*<span class="site-footer-sub">/);
});

test('the footer speaks French on a French Terminal', () => {
  assert.match(src, /Licence et source \(AGPL-3\.0\)/);
});

test('restoring the desk asks through the in-app confirm dialog', () => {
  const eh = readFileSync(new URL('../src/app/event-handlers.ts', import.meta.url), 'utf8');
  const restore = eh.slice(eh.indexOf('restoreDesk:'), eh.indexOf(': undefined,', eh.indexOf('restoreDesk:')));
  assert.match(restore, /await import\('@\/components\/confirm-dialog'\)/);
  assert.doesNotMatch(restore, /window\.confirm\(/);
});

test('self-host tooling: memory-capped checks, fonts shipped with their licence', () => {
  const check = readFileSync(new URL('../selfhost/check.sh', import.meta.url), 'utf8');
  assert.match(check, /--memory=3g/);
  assert.ok(readFileSync(new URL('../public/site-fonts/OFL.txt', import.meta.url), 'utf8').includes('SIL OPEN FONT LICENSE'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sabathierShell } from '../shared/sabathier-shell.mjs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const paragraphs = ['First paragraph about the desk.', 'Second <one> & more.'];
const out = sabathierShell(index, { siteUrl: 'https://emiliensabathier.fr/terminal/', paragraphs });

test('no upstream product, domain or repository left in the page shell', () => {
  assert.doesNotMatch(out, /worldmonitor\.app/i);
  assert.doesNotMatch(out, /World ?Monitor/);
  assert.doesNotMatch(out, /koala73/);
  assert.doesNotMatch(out, /pricing/i);
});

test('one JSON-LD block describing Sabathier Terminal, published by Emilien Sabathier, with its licence', () => {
  const blocks = [...out.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const ld = JSON.parse(blocks[0][1]);
  assert.equal(ld['@type'], 'WebApplication');
  assert.equal(ld.name, 'Sabathier Terminal');
  assert.equal(ld.url, 'https://emiliensabathier.fr/terminal/');
  assert.equal(ld.publisher.name, 'Emilien Sabathier');
  assert.equal(ld.license, 'https://www.gnu.org/licenses/agpl-3.0.html');
});

test('heading, SEO summary and no-JS block are the Sabathier ones, escaped', () => {
  assert.match(out, /<h1 class="app-heading">Sabathier Terminal: markets desk by Emilien Sabathier<\/h1>/);
  assert.match(out, /<section class="app-seo-summary">\s*<p>First paragraph about the desk\.<\/p>\s*<p>Second &lt;one&gt; &amp; more\.<\/p>\s*<\/section>/);
  assert.match(out, /<noscript>[\s\S]*Sabathier Terminal needs JavaScript[\s\S]*href="\/labs\/source\.txt"[\s\S]*<\/noscript>/);
});

test('share image and alternates point at this host, nothing else of the page changes', () => {
  assert.match(out, /<meta property="og:image" content="https:\/\/emiliensabathier\.fr\/favico\/og-image\.png" \/>/);
  assert.doesNotMatch(out, /hreflang="x-default"/);
  assert.ok(out.includes('<div id="app">'));
  assert.ok(out.includes('data-wm-prepaint'));
});

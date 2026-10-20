// Terminal shell wiring inside the upstream layout manager (source checks, like the other panel-layout tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/app/panel-layout.ts', import.meta.url), 'utf8');
const body = (name) => {
  const i = src.indexOf(`  private ${name}(`);
  assert.ok(i > 0, name);
  return src.slice(i, src.indexOf('\n  }\n', i));
};

test('function switches in the Terminal shell load data once the key presses settle', () => {
  assert.match(src, /private readonly loadAllDataAfterSwitch = debounce\(\(\) => this\.scheduleLoadAllData\(\), 350\);/);
  const apply = body('applyTabPanelState');
  assert.match(apply, /if \(document\.documentElement\.classList\.contains\('bb-shell'\)\) this\.loadAllDataAfterSwitch\(\);\s*else this\.scheduleLoadAllData\(\);/);
});

test('revealing the map on phones scrolls the page to it in the Terminal shell (the page scrolls, not .main-content)', () => {
  const reveal = body('revealMobileMap');
  assert.match(reveal, /bb-shell[\s\S]*mapSection\.scrollIntoView\(\{ block: 'start' \}\)/);
});

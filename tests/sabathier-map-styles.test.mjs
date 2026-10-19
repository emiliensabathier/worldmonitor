import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repaint, PALETTES } from '../scripts/build-sabathier-map-styles.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`../public/map-styles/${f}`, import.meta.url), 'utf8'));
const layer = (s, id) => s.layers.find((l) => l.id === id);

for (const theme of ['light', 'dark']) {
  test(`${theme}: committed style equals a fresh build from happy-${theme}.json`, () => {
    assert.deepEqual(read(`sabathier-${theme}.json`), repaint(read(`happy-${theme}.json`), PALETTES[theme], `Sabathier ${theme}`));
  });

  test(`${theme}: paper land, wash water, thin country borders, same sources as happy`, () => {
    const s = read(`sabathier-${theme}.json`);
    const p = PALETTES[theme];
    assert.equal(layer(s, 'background').paint['background-color'], p.land);
    assert.equal(layer(s, 'water').paint['fill-color'], p.water);
    assert.equal(layer(s, 'boundary_country_inner').paint['line-color'], p.border);
    assert.deepEqual(s.sources, read(`happy-${theme}.json`).sources);
    assert.equal(layer(s, 'building').layout.visibility, 'none');
    assert.equal(layer(s, 'boundary_state').layout.visibility, 'none');
  });
}

test('DeckGLMap picks the Sabathier styles for the finance variant', () => {
  const src = readFileSync(new URL('../src/components/DeckGLMap.ts', import.meta.url), 'utf8');
  assert.match(src, /const SABATHIER_LIGHT_STYLE = '\/map-styles\/sabathier-light\.json';/);
  assert.match(src, /const usesVariantBasemap = isHappyVariant \|\| SITE_VARIANT === 'finance';/);
  // The happy choice may only appear once: inside variantBasemapStyle().
  assert.equal(src.match(/\? HAPPY_LIGHT_STYLE : HAPPY_DARK_STYLE/g)?.length, 1, 'style choice must go through variantBasemapStyle()');
});

test('city dots use the label colour, and the dark halo is black', () => {
  for (const theme of ['light', 'dark']) {
    const s = read(`sabathier-${theme}.json`);
    for (const l of s.layers.filter((x) => x.id.startsWith('place_') && x.paint?.['icon-color'] !== undefined)) {
      assert.equal(l.paint['icon-color'], PALETTES[theme].label, l.id);
    }
  }
  assert.equal(PALETTES.dark.halo, PALETTES.dark.water); // labels sit on black water and near-black land
});

test('variant basemaps: hover paint follows the page theme, and a fallback map stays on its fallback style', () => {
  const src = readFileSync(new URL('../src/components/DeckGLMap.ts', import.meta.url), 'utf8');
  assert.match(src, /const paintTheme = usesVariantBasemap \? getCurrentTheme\(\) : \(isLightMapTheme\(mapTheme\)/);
  assert.match(src, /this\.usedFallbackStyle\s*\?\s*\(getCurrentTheme\(\) === 'light' \? FALLBACK_LIGHT_STYLE : FALLBACK_DARK_STYLE\)/);
});

test('dark: Bloomberg map, black water, near-black land, dim amber borders', () => {
  assert.deepEqual(PALETTES.dark, { land: '#141414', water: '#000000', border: '#5a3a10', road: '#1f1f1f', label: '#8a6a3a', halo: '#000000' });
});

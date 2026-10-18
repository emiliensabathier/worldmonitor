import { describe, expect, it } from 'vitest';
import { SABATHIER_DESK, buildDeskTabs } from '@/config/sabathier-desk';

const base = Object.fromEntries(
  ['map', 'markets', 'insights', 'finance-labs', 'fear-greed', 'yield-curve', 'bonds', 'centralbanks', 'forex', 'fsi',
    'heatmap', 'earnings-calendar', 'macro-signals', 'market-breadth', 'crypto', 'commodities', 'energy-complex',
    'gold-intelligence', 'macro-tiles', 'economic-calendar', 'polymarket', 'consumer-prices', 'live-news',
    'markets-news', 'economic-news', 'stablecoins']
    .map((k) => [k, { name: k, enabled: k === 'stablecoins', priority: 1 }]),
);
let n = 0;
const ids = () => `tab-test-${(n++).toString(36)}`;

describe('buildDeskTabs', () => {
  it('builds the six desk tabs in order, with their keys', () => {
    const tabs = buildDeskTabs(base, 'en', ids);
    expect(tabs.map((t) => t.deskKey)).toEqual(['overview', 'rates-fx', 'equities', 'commodities', 'macro', 'news']);
    expect(tabs.map((t) => t.name)).toEqual(['Overview', 'Rates & FX', 'Equities', 'Commodities', 'Macro', 'News']);
    for (const t of tabs) expect(t.id).toMatch(/^tab-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('enables exactly the tab panels, in the desk order, and nothing else', () => {
    const [overview, , equities] = buildDeskTabs(base, 'en', ids);
    expect(overview.panelOrder).toEqual(['map', 'markets', 'insights', 'finance-labs', 'fear-greed']);
    expect(Object.entries(overview.panelSettings).filter(([, c]) => c.enabled).map(([k]) => k).sort())
      .toEqual(['fear-greed', 'finance-labs', 'insights', 'map', 'markets']);
    expect(equities.panelSettings.markets.enabled).toBe(true);
    expect(overview.panelSettings.stablecoins.enabled).toBe(false);
    expect(overview.bottomSet).toEqual([]);
  });

  it('copies the settings (no shared objects between tabs or with the base)', () => {
    const [a, b] = buildDeskTabs(base, 'en', ids);
    expect(a.panelSettings.markets).not.toBe(b.panelSettings.markets);
    expect(a.panelSettings.markets).not.toBe(base.markets);
    expect(base.markets.enabled).toBe(false);
  });

  it('skips panels unknown to this build without failing', () => {
    const { 'gold-intelligence': _gone, ...partial } = base;
    const commodities = buildDeskTabs(partial, 'en', ids)[3];
    expect(commodities.panelOrder).toEqual(['commodities', 'energy-complex', 'map']);
    expect(commodities.panelSettings['gold-intelligence']).toBeUndefined();
  });

  it('names tabs in French for a French Terminal', () => {
    expect(buildDeskTabs(base, 'fr', ids).map((t) => t.name))
      .toEqual(["Vue d'ensemble", 'Taux et change', 'Actions', 'Matières premières', 'Macro', 'Actualités']);
  });

  it('every desk panel is a known finance panel key', async () => {
    const { FINANCE_PANELS } = await import('@/config/panels');
    for (const tab of SABATHIER_DESK) for (const key of tab.panels) expect(FINANCE_PANELS).toHaveProperty(key);
  });
});

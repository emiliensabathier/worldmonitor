// Sabathier desk (finance variant on emiliensabathier.fr): six predefined dashboard tabs built on a
// visitor's first run instead of the single upstream "Main" tab. Panels may appear in several tabs.
import type { PanelConfig } from '@/types';
import type { PanelTab } from '@/services/tab-store';

export type DeskKey = 'overview' | 'rates-fx' | 'equities' | 'commodities' | 'macro' | 'news';

export const SABATHIER_DESK: ReadonlyArray<{ key: DeskKey; name: { en: string; fr: string }; panels: readonly string[] }> = [
  { key: 'overview', name: { en: 'Overview', fr: "Vue d'ensemble" }, panels: ['map', 'markets', 'insights', 'finance-labs', 'fear-greed'] },
  { key: 'rates-fx', name: { en: 'Rates & FX', fr: 'Taux et change' }, panels: ['yield-curve', 'bonds', 'centralbanks', 'forex', 'fsi'] },
  { key: 'equities', name: { en: 'Equities', fr: 'Actions' }, panels: ['markets', 'heatmap', 'earnings-calendar', 'macro-signals', 'market-breadth', 'crypto'] },
  { key: 'commodities', name: { en: 'Commodities', fr: 'Matières premières' }, panels: ['commodities', 'energy-complex', 'gold-intelligence', 'map'] },
  { key: 'macro', name: { en: 'Macro', fr: 'Macro' }, panels: ['macro-tiles', 'economic-calendar', 'polymarket', 'consumer-prices'] },
  { key: 'news', name: { en: 'News', fr: 'Actualités' }, panels: ['live-news', 'markets-news', 'economic-news'] },
];

export function buildDeskTabs(base: Record<string, PanelConfig>, lang: string, newId: () => string): PanelTab[] {
  const fr = lang.toLowerCase().startsWith('fr');
  return SABATHIER_DESK.map((tab) => {
    const panelOrder = tab.panels.filter((key) => key in base);
    const visible = new Set(panelOrder);
    const panelSettings: Record<string, PanelConfig> = {};
    for (const [key, config] of Object.entries(base)) panelSettings[key] = { ...config, enabled: visible.has(key) };
    return { id: newId(), name: fr ? tab.name.fr : tab.name.en, deskKey: tab.key, panelSettings, panelOrder, bottomSet: [] };
  });
}

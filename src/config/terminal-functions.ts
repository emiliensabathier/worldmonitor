// Sabathier Terminal functions (finance variant on emiliensabathier.fr): eight Bloomberg-style screens,
// each a fixed grid of existing panels. They are stored as eight dashboard tabs (deskKey = code) so the
// upstream tab machinery enables, mounts and persists their panels; the function keys replace the tab bar.
import type { PanelConfig } from '@/types';
import type { PanelTab, TabsState } from '@/services/tab-store';

export type FunctionCode = 'TOP' | 'WEI' | 'GOVT' | 'FX' | 'CMDTY' | 'ECO' | 'N' | 'LABS';

export interface TerminalFunction {
  code: FunctionCode;
  label: { en: string; fr: string };
  /** One string per grid row, space-separated panel keys ('map' is the map section). */
  areas: readonly string[];
  /** grid-template-columns / grid-template-rows (empty: equal tracks). */
  columns?: string;
  rows?: string;
  /** Stacking order under 768px. */
  mobile: readonly string[];
}

export const TERMINAL_FUNCTIONS: readonly TerminalFunction[] = [
  { code: 'TOP', label: { en: 'Overview', fr: "Vue d'ensemble" }, areas: ['markets map insights', 'markets live-news finance-labs'], columns: '1.1fr 1.4fr 1fr', mobile: ['markets', 'insights', 'live-news', 'map', 'finance-labs'] },
  { code: 'WEI', label: { en: 'Equities', fr: 'Actions' }, areas: ['markets heatmap earnings-calendar', 'markets market-breadth earnings-calendar'], columns: '1fr 1.3fr 1fr', mobile: ['markets', 'heatmap', 'market-breadth', 'earnings-calendar'] },
  { code: 'GOVT', label: { en: 'Rates', fr: 'Taux' }, areas: ['yield-curve yield-curve centralbanks', 'bonds bonds centralbanks'], rows: '1.2fr 1fr', mobile: ['yield-curve', 'bonds', 'centralbanks'] },
  { code: 'FX', label: { en: 'FX', fr: 'Devises' }, areas: ['forex crypto'], columns: '1.4fr 1fr', mobile: ['forex', 'crypto'] },
  { code: 'CMDTY', label: { en: 'Commodities', fr: 'Matières premières' }, areas: ['commodities energy-complex map', 'gold-intelligence energy-complex map'], columns: '1fr 1fr 1.3fr', mobile: ['commodities', 'energy-complex', 'gold-intelligence', 'map'] },
  { code: 'ECO', label: { en: 'Macro & risk', fr: 'Macro & risque' }, areas: ['economic-calendar macro-tiles fsi', 'economic-calendar macro-signals fear-greed', 'consumer-prices polymarket fear-greed'], mobile: ['macro-tiles', 'economic-calendar', 'fsi', 'macro-signals', 'fear-greed', 'consumer-prices', 'polymarket'] },
  { code: 'N', label: { en: 'News', fr: 'Actualité' }, areas: ['live-news markets-news economic-news'], mobile: ['live-news', 'markets-news', 'economic-news'] },
  { code: 'LABS', label: { en: 'Studies', fr: 'Études' }, areas: ['finance-labs'], mobile: ['finance-labs'] },
];

export const DEFAULT_FUNCTION: FunctionCode = 'TOP';

const CODES = new Set<string>(TERMINAL_FUNCTIONS.map((f) => f.code));

export function isFunctionCode(s: string | undefined | null): s is FunctionCode {
  return typeof s === 'string' && CODES.has(s);
}

export function getFunction(code: FunctionCode): TerminalFunction {
  return TERMINAL_FUNCTIONS.find((f) => f.code === code)!;
}

export function functionLabel(fn: TerminalFunction, lang: string): string {
  return lang.toLowerCase().startsWith('fr') ? fn.label.fr : fn.label.en;
}

const cellsOf = (areas: readonly string[]): string[][] => areas.map((row) => row.trim().split(/\s+/));

/** Panel keys of a function, unique, in the reading order of its grid. */
export function functionPanelKeys(fn: TerminalFunction): string[] {
  return [...new Set(cellsOf(fn.areas).flat())].filter((k) => k !== '.');
}

/** The function a panel belongs to: the first one, TOP aside, that holds it. */
export function panelHome(key: string): FunctionCode | null {
  return TERMINAL_FUNCTIONS.find((f) => f.code !== 'TOP' && functionPanelKeys(f).includes(key))?.code ?? null;
}

export function buildFunctionTabs(base: Record<string, PanelConfig>, _lang: string, newId: () => string): PanelTab[] {
  return TERMINAL_FUNCTIONS.map((fn) => {
    const panelOrder = fn.mobile.filter((key) => key in base);
    const visible = new Set(panelOrder);
    const panelSettings: Record<string, PanelConfig> = {};
    for (const [key, config] of Object.entries(base)) panelSettings[key] = { ...config, enabled: visible.has(key) };
    return { id: newId(), name: fn.code, deskKey: fn.code, panelSettings, panelOrder, bottomSet: [] };
  });
}

/**
 * The eight-function desk. A stored desk that already holds exactly the eight functions is kept (null when
 * nothing changes, or the same tabs with `initial` active); anything else (first visit, the former six-tab
 * desk, a hand-made layout) is replaced.
 */
export function prepareTerminalDesk(
  stored: TabsState | null,
  base: Record<string, PanelConfig>,
  lang: string,
  newId: () => string,
  initial?: FunctionCode,
): TabsState | null {
  const codes = TERMINAL_FUNCTIONS.map((f) => f.code);
  // A stored desk is current only if each function still enables exactly its own panels (a composition
  // changed since it was stored, or a hand-edited tab, rebuilds it).
  const current = (t: PanelTab, i: number) => {
    if (t.deskKey !== codes[i]) return false;
    const want = new Set(TERMINAL_FUNCTIONS[i]!.mobile.filter((k) => k in base));
    const enabled = Object.entries(t.panelSettings).filter(([, c]) => c.enabled).map(([k]) => k);
    return enabled.length === want.size && enabled.every((k) => want.has(k));
  };
  if (stored && stored.tabs.length === codes.length && stored.tabs.every(current)) {
    const target = initial ? stored.tabs.find((t) => t.deskKey === initial) : undefined;
    if (!target || target.id === stored.activeTabId) return null;
    return { ...stored, activeTabId: target.id };
  }
  const tabs = buildFunctionTabs(base, lang, newId);
  const active = tabs.find((t) => t.deskKey === (initial ?? DEFAULT_FUNCTION)) ?? tabs[0]!;
  return { activeTabId: active.id, tabs };
}

/** Every named area fills its bounding box, and every row has the same number of cells. */
export function isRectangular(areas: readonly string[]): boolean {
  const cells = cellsOf(areas);
  const width = cells[0]?.length ?? 0;
  if (cells.some((r) => r.length !== width)) return false;
  const boxes = new Map<string, { r0: number; r1: number; c0: number; c1: number; n: number }>();
  cells.forEach((row, r) => row.forEach((name, c) => {
    if (name === '.') return;
    const b = boxes.get(name);
    if (!b) boxes.set(name, { r0: r, r1: r, c0: c, c1: c, n: 1 });
    else { b.r0 = Math.min(b.r0, r); b.r1 = Math.max(b.r1, r); b.c0 = Math.min(b.c0, c); b.c1 = Math.max(b.c1, c); b.n++; }
  }));
  for (const [name, b] of boxes) {
    if (b.n !== (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1)) return false;
    for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) if (cells[r]![c] !== name) return false;
  }
  return true;
}

/**
 * Hands the cells of absent panels to a present neighbour (left, right, above, below: the first that keeps
 * every area rectangular), else leaves them empty ('.'), so a missing panel never leaves a hole.
 */
export function collapseAreas(areas: readonly string[], present: ReadonlySet<string>): string[] {
  const cells = cellsOf(areas);
  const out = () => cells.map((r) => r.join(' '));
  // First, whole areas: an absent panel's box goes to a present neighbour sharing its full edge.
  for (const name of new Set(cells.flat())) {
    if (name === '.' || present.has(name)) continue;
    const at = cells.flatMap((row, r) => row.map((n, c) => (n === name ? [r, c] as const : null))).filter((p) => p !== null);
    const r0 = Math.min(...at.map(([r]) => r)), r1 = Math.max(...at.map(([r]) => r));
    const c0 = Math.min(...at.map(([, c]) => c)), c1 = Math.max(...at.map(([, c]) => c));
    const rows = Array.from({ length: r1 - r0 + 1 }, (_, i) => r0 + i);
    const cols = Array.from({ length: c1 - c0 + 1 }, (_, i) => c0 + i);
    const edges = [
      rows.map((r) => cells[r]![c0 - 1]), rows.map((r) => cells[r]![c1 + 1]),
      cols.map((c) => cells[r0 - 1]?.[c]), cols.map((c) => cells[r1 + 1]?.[c]),
    ];
    for (const edge of edges) {
      const p = edge[0];
      if (!p || p === '.' || !present.has(p) || edge.some((n) => n !== p)) continue;
      for (const [r, c] of at) cells[r]![c] = p;
      if (isRectangular(out())) break;
      for (const [r, c] of at) cells[r]![c] = name;
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r]!.length; c++) {
        const name = cells[r]![c]!;
        if (name === '.' || present.has(name)) continue;
        const candidates = [cells[r]![c - 1], cells[r]![c + 1], cells[r - 1]?.[c], cells[r + 1]?.[c]]
          .filter((n): n is string => !!n && n !== '.' && present.has(n));
        let next = '.';
        for (const cand of candidates) {
          cells[r]![c] = cand;
          if (isRectangular(out())) { next = cand; break; }
        }
        cells[r]![c] = next;
        changed = true;
      }
    }
  }
  return out();
}

/** Plain layout for what is left when the function grid would keep holes: rows of three, the last panel
 *  stretching over the rest of its row. */
export function fallbackAreas(keys: readonly string[]): string[] {
  if (keys.length === 0) return [];
  const cols = keys.length === 4 ? 2 : Math.min(3, keys.length);
  const rows: string[] = [];
  for (let i = 0; i < keys.length; i += cols) {
    const row = keys.slice(i, i + cols);
    while (row.length < cols) row.push(row[row.length - 1]!);
    rows.push(row.join(' '));
  }
  return rows;
}

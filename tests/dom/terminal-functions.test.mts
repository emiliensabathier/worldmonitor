import { describe, expect, it } from 'vitest';
import { FINANCE_PANELS } from '@/config/panels';
import {
  TERMINAL_FUNCTIONS, DEFAULT_FUNCTION, functionPanelKeys, panelHome, buildFunctionTabs, prepareTerminalDesk,
  collapseAreas, isRectangular, isFunctionCode, fallbackAreas,
} from '@/config/terminal-functions';

const ids = () => { let i = 0; return () => `tab-${++i}-x`; };

describe('terminal functions', () => {
  it('eight functions in key order, TOP first and default', () => {
    expect(TERMINAL_FUNCTIONS.map((f) => f.code)).toEqual(['TOP', 'WEI', 'GOVT', 'FX', 'CMDTY', 'ECO', 'N', 'LABS']);
    expect(DEFAULT_FUNCTION).toBe('TOP');
    expect(isFunctionCode('GOVT')).toBe(true);
    expect(isFunctionCode('govt')).toBe(false);
  });
  it('every grid is rectangular and only names finance panels or the map', () => {
    for (const fn of TERMINAL_FUNCTIONS) {
      expect(isRectangular(fn.areas), fn.code).toBe(true);
      for (const key of functionPanelKeys(fn)) expect(key === 'map' || key in FINANCE_PANELS, `${fn.code}:${key}`).toBe(true);
    }
  });
  it('the mobile order covers exactly the grid panels', () => {
    for (const fn of TERMINAL_FUNCTIONS) expect([...fn.mobile].sort(), fn.code).toEqual(functionPanelKeys(fn).sort());
  });
  it('panel homes point to the first non-TOP function holding the panel', () => {
    expect(panelHome('markets')).toBe('WEI');
    expect(panelHome('live-news')).toBe('N');
    expect(panelHome('finance-labs')).toBe('LABS');
    expect(panelHome('map')).toBe('CMDTY');
    expect(panelHome('insights')).toBeNull();
  });
  it('one tab per function, deskKey = code, only that function panels enabled', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 }, 'fx-majors': { name: 'F', enabled: true, priority: 1 } };
    const tabs = buildFunctionTabs(base, 'fr', ids());
    expect(tabs.map((t) => t.deskKey)).toEqual(TERMINAL_FUNCTIONS.map((f) => f.code));
    expect(tabs[0]!.name).toBe('TOP');
    const fx = tabs.find((t) => t.deskKey === 'FX')!;
    expect(fx.panelSettings['fx-majors']!.enabled).toBe(true);
    expect(fx.panelSettings.markets!.enabled).toBe(false);
    expect(fx.panelOrder).toEqual(['fx-majors']);
  });
  it('rebuilds an old desk, keeps a current one, opens the requested function', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 } };
    const fresh = prepareTerminalDesk(null, base, 'en', ids(), 'GOVT')!;
    expect(fresh.tabs).toHaveLength(8);
    expect(fresh.activeTabId).toBe(fresh.tabs.find((t) => t.deskKey === 'GOVT')!.id);
    expect(prepareTerminalDesk(fresh, base, 'en', ids())).toBeNull();
    const old = { activeTabId: 'a', tabs: [{ id: 'a', name: 'Overview', deskKey: 'overview', panelSettings: {}, panelOrder: [], bottomSet: [] }] };
    expect(prepareTerminalDesk(old, base, 'en', ids())!.tabs).toHaveLength(8);
  });
  it('rebuilds a desk whose functions hold another panel set (composition changed since it was stored)', () => {
    const base = { 'yield-curve': { name: 'Y', enabled: true, priority: 1 }, 'rates-board': { name: 'R', enabled: true, priority: 1 } };
    const desk = prepareTerminalDesk(null, base, 'en', ids())!;
    const govt = desk.tabs.find((t) => t.deskKey === 'GOVT')!;
    govt.panelSettings['rates-board'] = { ...govt.panelSettings['rates-board']!, enabled: false };
    expect(prepareTerminalDesk(desk, base, 'en', ids())).not.toBeNull();
  });

  it('a current desk switches to the requested function', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 } };
    const desk = prepareTerminalDesk(null, base, 'en', ids())!;
    const next = prepareTerminalDesk(desk, base, 'en', ids(), 'N')!;
    expect(next.tabs).toBe(desk.tabs);
    expect(next.activeTabId).toBe(desk.tabs.find((t) => t.deskKey === 'N')!.id);
  });
});

describe('collapseAreas', () => {
  it('keeps the grid when every panel is present', () => {
    expect(collapseAreas(['a b', 'a c'], new Set(['a', 'b', 'c']))).toEqual(['a b', 'a c']);
  });
  it('gives a missing cell to its left neighbour', () => {
    expect(collapseAreas(['a b c'], new Set(['a', 'b']))).toEqual(['a b b']);
    expect(collapseAreas(['a b x', 'a c x'], new Set(['a', 'b', 'c']))).toEqual(['a b b', 'a c c']);
  });
  it('falls back to the right, upper then lower neighbour, then to an empty cell', () => {
    expect(collapseAreas(['a m i', 'a x y'], new Set(['a', 'm', 'i']))).toEqual(['a m i', 'a m i']);
    expect(collapseAreas(['x b'], new Set(['b']))).toEqual(['b b']);
    expect(collapseAreas(['a x', 'a y'], new Set(['a', 'y']))).toEqual(['a y', 'a y']);
    expect(collapseAreas(['x'], new Set())).toEqual(['.']);
  });
  it('always returns a rectangular grid', () => {
    expect(isRectangular(collapseAreas(['a x', 'a y'], new Set(['a', 'y'])))).toBe(true);
    expect(isRectangular(['a b', 'b a'])).toBe(false);
  });
  it('hands a whole missing area to a neighbour sharing its full edge before going cell by cell', () => {
    expect(collapseAreas(['y y c', 'b b c'], new Set(['b', 'c']))).toEqual(['b b c', 'b b c']);
    expect(collapseAreas(['a x', 'a x'], new Set(['a']))).toEqual(['a a', 'a a']);
  });

describe('fallbackAreas', () => {
  it('lays out what is left in rows of three, the last panel filling its row', () => {
    expect(fallbackAreas(['a'])).toEqual(['a']);
    expect(fallbackAreas(['a', 'b'])).toEqual(['a b']);
    expect(fallbackAreas(['a', 'b', 'c'])).toEqual(['a b c']);
    expect(fallbackAreas(['a', 'b', 'c', 'd'])).toEqual(['a b', 'c d']);
    expect(fallbackAreas(['a', 'b', 'c', 'd', 'e'])).toEqual(['a b c', 'd e e']);
    expect(fallbackAreas(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['a b c', 'd e f', 'g g g']);
    expect(fallbackAreas([])).toEqual([]);
  });
});
});

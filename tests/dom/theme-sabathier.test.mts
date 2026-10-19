import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStoredTheme, getCurrentTheme, getThemePreference, readSharedThemeCookie, setThemePreference } from '@/utils/theme-manager';

// happy-dom keeps an empty `es-theme=` after Max-Age=0 where browsers delete it; both read as "no choice".
const clearCookie = () => { document.cookie = 'es-theme=; Path=/; Max-Age=0'; };
beforeEach(() => {
  localStorage.clear();
  clearCookie();
  document.documentElement.dataset.variant = 'finance';
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    matches: false, addEventListener: () => {}, removeEventListener: () => {},
  } as unknown as MediaQueryList));
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'theme-color'); document.head.append(meta); }
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); clearCookie(); });

describe('Sabathier shared theme cookie (finance variant)', () => {
  it('writes the cookie for an explicit choice and removes it for auto', () => {
    setThemePreference('light');
    expect(document.cookie).toContain('es-theme=light');
    expect(readSharedThemeCookie()).toBe('light');
    setThemePreference('auto');
    expect(document.cookie).not.toMatch(/es-theme=(light|dark)/);
    expect(readSharedThemeCookie()).toBeNull();
  });

  it('reads the cookie when localStorage has no preference', () => {
    document.cookie = 'es-theme=dark; Path=/';
    expect(getThemePreference()).toBe('dark');
    applyStoredTheme();
    expect(getCurrentTheme()).toBe('dark');
  });

  it('the shared cookie wins over a stale localStorage (choice made on analyse. or the site)', () => {
    document.cookie = 'es-theme=dark; Path=/';
    localStorage.setItem('worldmonitor-theme', 'light');
    expect(getThemePreference()).toBe('dark');
    applyStoredTheme();
    expect(getCurrentTheme()).toBe('dark');
  });

  it('ignores an invalid cookie value', () => {
    document.cookie = 'es-theme=blue; Path=/';
    expect(readSharedThemeCookie()).toBeNull();
    expect(getThemePreference()).toBe('auto');
  });

  it('stays dark whatever the preference, and keeps the choice for the rest of the site', () => {
    setThemePreference('light');
    expect(getCurrentTheme()).toBe('dark');
    expect(getThemePreference()).toBe('light');
    expect(document.cookie).toContain('es-theme=light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#000000');
    document.cookie = 'es-theme=light; Path=/';
    applyStoredTheme();
    expect(getCurrentTheme()).toBe('dark');
  });

  it('a preference change that leaves the Terminal dark fires no theme-changed (no basemap reload)', () => {
    setThemePreference('dark');
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push(e);
    window.addEventListener('theme-changed', on);
    setThemePreference('light');
    setThemePreference('auto');
    window.removeEventListener('theme-changed', on);
    expect(seen).toHaveLength(0);
    expect(getThemePreference()).toBe('auto');
  });

  it('other variants still switch to light', () => {
    document.documentElement.dataset.variant = 'full';
    setThemePreference('light');
    expect(getCurrentTheme()).toBe('light');
  });

  it('other variants never write the cookie', () => {
    document.documentElement.dataset.variant = 'full';
    setThemePreference('light');
    expect(document.cookie).not.toMatch(/es-theme=(light|dark)/);
  });
});

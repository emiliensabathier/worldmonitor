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

  it('paints the site paper colour in the browser chrome', () => {
    setThemePreference('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#fdfdfb');
    setThemePreference('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#121316');
  });

  it('other variants never write the cookie', () => {
    document.documentElement.dataset.variant = 'full';
    setThemePreference('light');
    expect(document.cookie).not.toMatch(/es-theme=(light|dark)/);
  });
});

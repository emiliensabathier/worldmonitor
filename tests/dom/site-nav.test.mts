import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSiteNav, renderSiteNav } from '@/app/site-nav';
import { getThemePreference } from '@/utils/theme-manager';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.variant = 'finance';
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    matches: false, addEventListener: () => {}, removeEventListener: () => {},
  } as unknown as MediaQueryList));
});
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); document.cookie = 'es-theme=; Path=/; Max-Age=0'; });

describe('renderSiteNav', () => {
  it('renders the site nav in English with Terminal as current page', () => {
    const html = renderSiteNav('en');
    expect(html).toContain('<header class="es-nav">');
    expect(html).toContain('<a href="/terminal/" aria-current="page">Terminal</a>');
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<a href="/cv/emilien-sabathier-cv-en.pdf">CV</a>');
    expect(html).toContain('<a href="/fr/" lang="fr" hreflang="fr">Français</a>');
    expect(html).toContain('data-label-auto="Theme: auto"');
  });

  it('renders French labels for a French Terminal, with the English home as other language', () => {
    const html = renderSiteNav('fr');
    expect(html).toContain('<a href="/fr/">Accueil</a>');
    expect(html).toContain('<a href="/fr/labs/">Labs</a>');
    expect(html).toContain('<a href="/" lang="en" hreflang="en">English</a>');
    expect(html).toContain('data-label-dark="Thème : sombre"');
  });

  it('treats regional French tags as French and anything else as English', () => {
    expect(renderSiteNav('fr-CA')).toContain('Accueil');
    expect(renderSiteNav('de')).toContain('Home');
  });
});

describe('mountSiteNav', () => {
  it('shows the current preference and cycles auto → light → dark → auto', () => {
    document.body.innerHTML = renderSiteNav('en');
    mountSiteNav();
    const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!;
    expect(button.textContent).toBe('Theme: auto');
    button.click();
    expect(getThemePreference()).toBe('light');
    expect(button.textContent).toBe('Theme: light');
    button.click();
    expect(getThemePreference()).toBe('dark');
    button.click();
    expect(getThemePreference()).toBe('auto');
    expect(button.textContent).toBe('Theme: auto');
  });

  it('follows a change made elsewhere (Terminal settings)', () => {
    document.body.innerHTML = renderSiteNav('en');
    mountSiteNav();
    localStorage.setItem('worldmonitor-theme', 'dark');
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: 'dark' } }));
    expect(document.querySelector('[data-theme-toggle]')!.textContent).toBe('Theme: dark');
  });
});

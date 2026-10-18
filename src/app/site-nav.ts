// The emiliensabathier.fr site nav (same markup and es- classes as the site, styled by
// src/styles/sabathier-tokens.css), shown above the Terminal toolbar on the finance variant.
import { getThemePreference, setThemePreference, type ThemePreference } from '@/utils/theme-manager';

interface NavLabels {
  label: string; home: string; homeHref: string; labsHref: string; cvHref: string;
  other: string; otherHref: string; otherLang: string;
  auto: string; light: string; dark: string;
}

const LABELS: Record<'en' | 'fr', NavLabels> = {
  en: {
    label: 'Site', home: 'Home', homeHref: '/', labsHref: '/labs/', cvHref: '/cv/emilien-sabathier-cv-en.pdf',
    other: 'Français', otherHref: '/fr/', otherLang: 'fr',
    auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark',
  },
  fr: {
    label: 'Site', home: 'Accueil', homeHref: '/fr/', labsHref: '/fr/labs/', cvHref: '/cv/emilien-sabathier-cv-fr.pdf',
    other: 'English', otherHref: '/', otherLang: 'en',
    auto: 'Thème : auto', light: 'Thème : clair', dark: 'Thème : sombre',
  },
};

function labelsFor(lang: string): NavLabels {
  return lang.toLowerCase().startsWith('fr') ? LABELS.fr : LABELS.en;
}

export function renderSiteNav(lang: string): string {
  const l = labelsFor(lang);
  return `<header class="es-nav"><div class="es-nav-inner">
<a class="es-nav-mark" href="${l.homeHref}">Emilien Sabathier</a>
<nav aria-label="${l.label}"><ul class="es-nav-links">
<li><a href="${l.homeHref}">${l.home}</a></li>
<li><a href="/terminal/" aria-current="page">Terminal</a></li>
<li><a href="${l.labsHref}">Labs</a></li>
<li><a href="${l.cvHref}">CV</a></li>
<li><a href="${l.otherHref}" lang="${l.otherLang}" hreflang="${l.otherLang}">${l.other}</a></li>
<li><button type="button" class="es-nav-theme" data-theme-toggle data-label-auto="${l.auto}" data-label-light="${l.light}" data-label-dark="${l.dark}">${l.auto}</button></li>
</ul></nav>
</div></header>`;
}

const NEXT: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };

export function mountSiteNav(root: ParentNode = document): void {
  const button = root.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!button) return;
  const paint = () => { button.textContent = button.getAttribute(`data-label-${getThemePreference()}`); };
  paint();
  button.addEventListener('click', () => {
    setThemePreference(NEXT[getThemePreference()]);
    paint();
  });
  window.addEventListener('theme-changed', paint);
}

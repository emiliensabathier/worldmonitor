import { describe, expect, it } from 'vitest';
import { LAB_LINKS, attachLabLinks, resolveLabLinks } from '@/app/lab-links';

const labs = [
  { tag: 'rates-lab', question: 'What the yield curve prices', report: 'https://r/' },
  { tag: 'valuation-lab', question: 'What a share price already assumes', report: 'https://v/' },
  { tag: 'equity-lab · live', question: 'How much growth is already in the price?', report: 'https://analyse.emiliensabathier.fr' },
];
const fr = { 'rates-lab': { question: 'Ce que la courbe des taux intègre' } };

describe('lab links', () => {
  it('maps the agreed panels', () => {
    expect(LAB_LINKS['yield-curve']).toEqual(['rates-lab']);
    expect(LAB_LINKS.heatmap).toEqual(['valuation-lab', 'equity-lab · live']);
    expect(LAB_LINKS['live-news']).toBeUndefined();
  });

  it('resolves English and French texts, falling back to English', () => {
    expect(resolveLabLinks('yield-curve', labs, fr, 'en')).toEqual([{ text: 'Related study: What the yield curve prices →', href: 'https://r/' }]);
    expect(resolveLabLinks('yield-curve', labs, fr, 'fr')).toEqual([{ text: 'Étude liée : Ce que la courbe des taux intègre →', href: 'https://r/' }]);
    expect(resolveLabLinks('heatmap', labs, fr, 'fr').map((l) => l.text)).toEqual([
      'Étude liée : What a share price already assumes →',
      'Outil lié : How much growth is already in the price? →',
    ]);
  });

  it('skips tags missing from labs.json', () => {
    expect(resolveLabLinks('fsi', labs, fr, 'en')).toEqual([]);
  });

  it('appends one link row after the panel content, as text, once', async () => {
    const panel = document.createElement('div');
    panel.innerHTML = '<div class="panel-header"></div><div class="panel-content"></div>';
    const loader = async () => ({ labs: [{ tag: 'rates-lab', question: '<b>x</b>', report: 'https://r/' }], fr: {} });
    await attachLabLinks('yield-curve', panel, 'en', loader);
    await attachLabLinks('yield-curve', panel, 'en', loader);
    const rows = panel.querySelectorAll('.es-lab-link');
    expect(rows.length).toBe(1);
    expect(panel.lastElementChild).toBe(rows[0]);
    expect(rows[0].querySelector('a')!.textContent).toBe('Related study: <b>x</b> →');
    expect(rows[0].querySelector('b')).toBeNull();
  });

  it('adds nothing when labs.json cannot be loaded', async () => {
    const panel = document.createElement('div');
    panel.innerHTML = '<div class="panel-content"></div>';
    await attachLabLinks('yield-curve', panel, 'en', async () => { throw new Error('offline'); });
    expect(panel.querySelector('.es-lab-link')).toBeNull();
  });
});

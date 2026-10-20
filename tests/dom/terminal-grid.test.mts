import { afterEach, describe, expect, it } from 'vitest';
import { TerminalGrid } from '@/app/terminal-grid';

function dom() {
  const main = document.createElement('main');
  main.className = 'main-content';
  main.innerHTML = `<div id="mapSection" class="map-section"><div class="panel-header"><span class="panel-title">Map</span></div></div>
    <div id="panelsGrid" class="panels-grid">
      <div class="panel" data-panel="markets"><div class="panel-header"><span class="panel-title">Markets</span></div></div>
      <div class="panel" data-panel="insights"><div class="panel-header"><span class="panel-title">AI</span></div></div>
      <div class="panel hidden" data-panel="forex"><div class="panel-header"><span class="panel-title">FX</span></div></div>
    </div>`;
  document.body.append(main);
  return main;
}
afterEach(() => document.body.replaceChildren());

describe('TerminalGrid', () => {
  it('lays out the function grid, numbers panels in reading order and links their home function', () => {
    const main = dom(); const opened: string[] = [];
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: (c) => opened.push(c) });
    grid.apply('TOP');
    expect(main.dataset.fn).toBe('TOP');
    // live-news and finance-labs are absent: their cells go to the panel above (map, insights).
    expect(main.style.gridTemplateAreas).toBe('"markets map insights" "markets map insights"');
    expect(main.style.gridTemplateColumns).toBe('minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 1fr)');
    expect(main.style.gridTemplateRows).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    const markets = main.querySelector<HTMLElement>('[data-panel="markets"]')!;
    expect(markets.style.gridArea).toBe('markets');
    expect(markets.classList.contains('bb-placed')).toBe(true);
    expect(main.querySelector('[data-panel="forex"]')!.classList.contains('bb-placed')).toBe(false);
    expect(main.querySelector<HTMLElement>('#mapSection')!.style.gridArea).toBe('map');
    expect(markets.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('1');
    expect(main.querySelector('#mapSection .panel-title')!.getAttribute('data-bb-n')).toBe('2');
    const link = markets.querySelector<HTMLButtonElement>('.bb-fn-link')!;
    expect(link.textContent).toBe('WEI');
    link.click();
    expect(opened).toEqual(['WEI']);
    expect(main.querySelector('[data-panel="insights"] .bb-fn-link')).toBeNull();
  });
  it('a panel mounted later takes its cell back', async () => {
    const main = dom();
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    grid.apply('TOP');
    const news = document.createElement('div');
    news.className = 'panel'; news.dataset.panel = 'live-news';
    main.querySelector('#panelsGrid')!.append(news);
    grid.refresh();
    expect(main.style.gridTemplateAreas).toBe('"markets map insights" "markets live-news live-news"');
    grid.destroy();
  });
  it('no home link to the function on screen', () => {
    const main = dom();
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    main.querySelector('[data-panel="forex"]')!.classList.remove('hidden');
    grid.apply('FX');
    expect(main.querySelector('[data-panel="forex"] .bb-fn-link')).toBeNull();
  });
  it('on phones, numbers and orders panels by the mobile order, and follows width changes', () => {
    const main = dom();
    let listener: ((e: { matches: boolean }) => void) | null = null;
    const mq = { matches: true, addEventListener: (_: string, l: (e: { matches: boolean }) => void) => { listener = l; }, removeEventListener: () => {} };
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {}, mobileQuery: mq as unknown as MediaQueryList });
    grid.apply('TOP'); // mobile order: markets, insights, live-news, map, finance-labs
    const insights = main.querySelector<HTMLElement>('[data-panel="insights"]')!;
    const map = main.querySelector<HTMLElement>('#mapSection')!;
    expect(insights.style.order).toBe('1');
    expect(map.style.order).toBe('3');
    expect(insights.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('2');
    expect(map.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('3'); // live-news is absent: no gap
    // Upstream mobile rules are layered !important (they beat unlayered sheets): only inline !important wins.
    const grid0 = main.querySelector<HTMLElement>('#panelsGrid')!;
    expect(grid0.style.getPropertyValue('display')).toBe('contents');
    expect(grid0.style.getPropertyPriority('display')).toBe('important');
    expect(map.style.getPropertyValue('height')).toBe('40vh');
    expect(map.style.getPropertyPriority('min-height')).toBe('important');
    expect(insights.style.getPropertyValue('min-height')).toBe('0px');
    mq.matches = false; listener!({ matches: false });
    expect(insights.style.order).toBe('');
    expect(grid0.style.getPropertyValue('display')).toBe('');
    expect(map.style.getPropertyValue('height')).toBe('');
    expect(insights.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('3');
    grid.destroy();
  });

  it('numbers only the panels on screen (no gap for a missing one)', () => {
    const main = dom();
    main.querySelector('[data-panel="markets"]')!.classList.add('hidden');
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    grid.apply('TOP');
    expect(main.querySelector('#mapSection .panel-title')!.getAttribute('data-bb-n')).toBe('1');
    expect(main.querySelector('[data-panel="insights"] .panel-title')!.getAttribute('data-bb-n')).toBe('2');
    grid.destroy();
  });
  it('falls back to a plain layout when the function grid would keep holes', () => {
    const main = dom();
    main.querySelector('#mapSection')!.classList.add('hidden');
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    grid.apply('TOP'); // only markets and insights left: map, live-news and finance-labs missing
    expect(main.style.gridTemplateAreas).toBe('"markets insights"');
    expect(main.style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    grid.destroy();
  });
});

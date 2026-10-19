// Sabathier Terminal function screens: lays the active function's fixed grid on <main>. #panelsGrid is
// `display: contents` in the shell CSS, so the map section and every panel are direct grid items placed by
// grid-area = their key. Panels mounted later (lazy/deferred) take their cell back through a
// MutationObserver; absent ones hand their cells to a neighbour (collapseAreas).
import {
  collapseAreas, functionLabel, functionPanelKeys, getFunction, panelHome, type FunctionCode,
} from '@/config/terminal-functions';

export class TerminalGrid {
  private code: FunctionCode | null = null;
  private lastAreas = '';
  private frame = 0;
  private readonly observer: MutationObserver;

  constructor(private readonly main: HTMLElement, private readonly opts: { lang: string; onOpen: (code: FunctionCode) => void }) {
    this.observer = new MutationObserver(() => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.refresh(); });
    });
    this.observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  apply(code: FunctionCode): void {
    this.code = code;
    this.lastAreas = '';
    this.layout();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  refresh(): void {
    if (this.code) this.layout();
  }

  destroy(): void {
    this.observer.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  private items(): Map<string, HTMLElement> {
    const out = new Map<string, HTMLElement>();
    const map = this.main.querySelector<HTMLElement>('#mapSection');
    if (map && !map.classList.contains('hidden')) out.set('map', map);
    const grid = this.main.querySelector('#panelsGrid');
    for (const el of grid ? Array.from(grid.children) : []) {
      if (!(el instanceof HTMLElement) || !el.dataset.panel || el.classList.contains('hidden')) continue;
      out.set(el.dataset.panel, el);
    }
    return out;
  }

  private layout(): void {
    const fn = getFunction(this.code!);
    const keys = functionPanelKeys(fn);
    const items = this.items();
    const areas = collapseAreas(fn.areas, new Set(keys.filter((k) => items.has(k))));
    const template = areas.map((row) => `"${row}"`).join(' ');
    if (template === this.lastAreas) return;
    this.lastAreas = template;

    // Writing styles and links below mutates the observed subtree: pause the observer meanwhile.
    this.observer.disconnect();
    this.main.dataset.fn = fn.code;
    this.main.style.gridTemplateAreas = template;
    this.main.style.gridTemplateColumns = fn.columns ?? '';
    this.main.style.gridTemplateRows = fn.rows ?? '';
    for (const [key, el] of items) {
      const n = keys.indexOf(key);
      el.style.gridArea = n >= 0 ? key : '';
      const header = el.querySelector<HTMLElement>(':scope > .panel-header');
      const title = header?.querySelector<HTMLElement>('.panel-title');
      if (n >= 0) title?.setAttribute('data-bb-n', String(n + 1));
      else title?.removeAttribute('data-bb-n');
      header?.querySelector(':scope > .bb-fn-link')?.remove();
      const home = n >= 0 ? panelHome(key) : null;
      if (header && home && home !== fn.code) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'bb-fn-link';
        link.textContent = home;
        link.title = functionLabel(getFunction(home), this.opts.lang);
        link.addEventListener('click', (e) => { e.stopPropagation(); this.opts.onOpen(home); });
        header.append(link);
      }
    }
    this.observer.observe(this.main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}

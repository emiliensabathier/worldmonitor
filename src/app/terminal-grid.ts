// Sabathier Terminal function screens: lays the active function's fixed grid on <main>. #panelsGrid is
// `display: contents` in the shell CSS, so the map section and every panel are direct grid items placed by
// grid-area = their key. Panels mounted later (lazy/deferred) take their cell back through a
// MutationObserver; absent ones hand their cells to a neighbour (collapseAreas).
import {
  collapseAreas, functionLabel, functionPanelKeys, getFunction, panelHome, type FunctionCode,
} from '@/config/terminal-functions';

function tracks(spec: string | undefined, count: number): string {
  const sizes = spec ? spec.trim().split(/\s+/) : Array.from({ length: count }, () => '1fr');
  return sizes.map((size) => `minmax(0, ${size})`).join(' ');
}

export class TerminalGrid {
  private code: FunctionCode | null = null;
  private frame = 0;
  private readonly observer: MutationObserver;
  private readonly mobile: MediaQueryList | null;
  private readonly onWidth = () => this.refresh();

  constructor(
    private readonly main: HTMLElement,
    private readonly opts: { lang: string; onOpen: (code: FunctionCode) => void; mobileQuery?: MediaQueryList },
  ) {
    // Phones stack the panels in the function's mobile order (CSS order); numbers follow what is on screen.
    this.mobile = opts.mobileQuery ?? (typeof matchMedia === 'function' ? matchMedia('(max-width: 768px)') : null);
    this.mobile?.addEventListener('change', this.onWidth);
    // Only structural changes matter: grid children added/removed/shown/hidden, not panel content updates.
    this.observer = new MutationObserver((records) => {
      const relevant = records.some((r) => {
        const t = r.target as HTMLElement;
        return t === this.main || t.id === 'panelsGrid' || t.id === 'mapSection' || t.parentElement?.id === 'panelsGrid';
      });
      if (!relevant || this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.refresh(); });
    });
    this.observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  apply(code: FunctionCode): void {
    this.code = code;
    this.layout();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  refresh(): void {
    if (this.code) this.layout();
  }

  destroy(): void {
    this.observer.disconnect();
    this.mobile?.removeEventListener('change', this.onWidth);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  private items(): Map<string, HTMLElement> {
    const out = new Map<string, HTMLElement>();
    const map = this.main.querySelector<HTMLElement>('#mapSection');
    if (map && !map.classList.contains('hidden')) out.set('map', map);
    const grid = this.main.querySelector('#panelsGrid');
    for (const el of grid ? Array.from(grid.children) : []) {
      if (!(el instanceof HTMLElement)) continue;
      if (!el.dataset.panel || el.classList.contains('hidden')) { el.classList.remove('bb-placed'); continue; }
      out.set(el.dataset.panel, el);
    }
    return out;
  }

  private layout(): void {
    const fn = getFunction(this.code!);
    const keys = functionPanelKeys(fn);
    const stacked = !!this.mobile?.matches;
    const order: readonly string[] = stacked ? fn.mobile : keys;
    const items = this.items();
    const areas = collapseAreas(fn.areas, new Set(keys.filter((k) => items.has(k))));
    const template = areas.map((row) => `"${row}"`).join(' ');

    // Writing styles and links below mutates the observed subtree: pause the observer meanwhile.
    this.observer.disconnect();
    this.main.dataset.fn = fn.code;
    this.main.style.gridTemplateAreas = template;
    // Tracks never grow with their content (minmax(0, …)): the screen is fixed, panels scroll inside.
    this.main.style.gridTemplateColumns = tracks(fn.columns, areas[0]!.trim().split(/\s+/).length);
    this.main.style.gridTemplateRows = tracks(fn.rows, areas.length);
    for (const [key, el] of items) {
      const n = keys.indexOf(key);
      // Important: upstream row-span classes (.panel.span-N) set grid-row with !important.
      if (n >= 0) el.style.setProperty('grid-area', key, 'important');
      else el.style.removeProperty('grid-area');
      el.classList.toggle('bb-placed', n >= 0);
      const header = el.querySelector<HTMLElement>(':scope > .panel-header');
      const title = header?.querySelector<HTMLElement>('.panel-title');
      if (n >= 0) title?.setAttribute('data-bb-n', String(order.indexOf(key) + 1));
      else title?.removeAttribute('data-bb-n');
      if (n >= 0 && stacked) el.style.order = String(fn.mobile.indexOf(key));
      else el.style.removeProperty('order');
      const home = n >= 0 ? panelHome(key) : null;
      const want = home && home !== fn.code ? home : null;
      const existing = header?.querySelector<HTMLElement>(':scope > .bb-fn-link');
      if (existing && existing.textContent !== want) existing.remove();
      if (header && want && !existing?.isConnected) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'bb-fn-link';
        link.textContent = want;
        link.title = functionLabel(getFunction(want), this.opts.lang);
        link.addEventListener('click', (e) => { e.stopPropagation(); this.opts.onOpen(want); });
        header.append(link);
      }
    }
    this.observer.observe(this.main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}

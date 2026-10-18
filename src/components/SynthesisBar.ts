// Sabathier synthesis band: nine key figures and a two-sentence brief above the desk tabs.
import type { DeskKey } from '@/config/sabathier-desk';
import { buildSynthesisItems, firstSentences, formatSynthesisStamp, type SynthesisData } from '@/components/synthesis-format';

export class SynthesisBar {
  private readonly el: HTMLElement;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: { load: () => Promise<SynthesisData>; lang: string; onSelectDesk: (k: DeskKey) => void }) {
    this.el = document.createElement('section');
    this.el.className = 'es-syn';
    this.el.setAttribute('aria-label', opts.lang.startsWith('fr') ? 'Synthèse du jour' : 'Daily synthesis');
    this.el.hidden = true;
  }

  getElement(): HTMLElement { return this.el; }

  async refresh(): Promise<void> {
    let data: SynthesisData;
    try { data = await this.opts.load(); } catch { return; } // keep what is shown
    const items = buildSynthesisItems(data, this.opts.lang);
    const brief = data.brief ? firstSentences(data.brief, 2) : '';
    const figures = document.createElement('div');
    figures.className = 'es-syn-figures';
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'es-syn-item';
      const k = document.createElement('span');
      k.className = 'es-syn-k';
      k.textContent = item.label;
      b.append(k, ` ${item.value}`);
      if (item.change) {
        const c = document.createElement('span');
        c.className = `es-syn-c ${item.dir}`.trim();
        c.textContent = ` ${item.change}`;
        b.append(c);
      }
      b.addEventListener('click', () => this.opts.onSelectDesk(item.desk));
      figures.append(b);
    }
    const nodes: Node[] = [figures];
    if (brief) {
      const p = document.createElement('p');
      p.className = 'es-syn-brief';
      p.textContent = brief;
      nodes.push(p);
    }
    if (data.asOf && items.length) {
      const t = document.createElement('span');
      t.className = 'es-syn-stamp';
      t.textContent = formatSynthesisStamp(data.asOf, this.opts.lang);
      figures.append(t);
    }
    this.el.replaceChildren(...nodes);
    this.el.hidden = items.length === 0 && !brief;
  }

  start(intervalMs = 5 * 60_000): void {
    void this.refresh();
    this.stop();
    this.timer = setInterval(() => { if (document.visibilityState === 'visible') void this.refresh(); }, intervalMs);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

// Sabathier synthesis band: nine key figures and a two-sentence brief above the desk tabs. In ticker mode
// (Terminal shell) the figures scroll in a doubled track, the brief is left to AI Insights and the time
// stamp goes to the status bar.
import type { FunctionCode } from '@/config/terminal-functions';
import { buildSynthesisItems, firstSentences, formatSynthesisStamp, type SynthesisData } from '@/components/synthesis-format';

export class SynthesisBar {
  private readonly el: HTMLElement;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastLoad = 0;
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - this.lastLoad > this.intervalMs) void this.refresh();
  };
  private intervalMs = 5 * 60_000;

  constructor(private readonly opts: {
    load: () => Promise<SynthesisData>; lang: string; onSelectDesk: (k: FunctionCode) => void;
    ticker?: boolean; stampTarget?: HTMLElement;
  }) {
    this.el = document.createElement('section');
    this.el.className = 'es-syn';
    this.el.setAttribute('aria-label', opts.lang.startsWith('fr') ? 'Synthèse du jour' : 'Daily synthesis');
    this.el.hidden = true;
  }

  getElement(): HTMLElement { return this.el; }

  async refresh(): Promise<void> {
    let data: SynthesisData;
    this.lastLoad = Date.now();
    try { data = await this.opts.load(); } catch { return; } // keep what is shown
    const items = buildSynthesisItems(data, this.opts.lang);
    // The World Brief carries source markers ([1], [12]...) meant for its own panel: drop them here.
    const brief = data.brief ? firstSentences(data.brief.replace(/\s*\[\d+\]/g, ''), 2) : '';
    const buttons = items.map((item) => {
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
      return b;
    });
    const figures = document.createElement('div');
    figures.className = 'es-syn-figures';
    const stamp = data.asOf && items.length ? formatSynthesisStamp(data.asOf, this.opts.lang) : '';
    if (this.opts.ticker) {
      // Two identical groups scrolled by -50%: a seamless loop. The copy is for the eye only.
      const track = document.createElement('div');
      track.className = 'es-syn-track';
      track.style.setProperty('--bb-tick-s', `${Math.max(30, items.length * 6)}s`);
      const group = document.createElement('div');
      group.className = 'es-syn-group';
      group.append(...buttons);
      const copy = group.cloneNode(true) as HTMLElement;
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => {
        b.tabIndex = -1;
        b.addEventListener('click', () => this.opts.onSelectDesk(items[i]!.desk));
      });
      track.append(group, copy);
      figures.append(track);
      if (this.opts.stampTarget) this.opts.stampTarget.textContent = stamp;
      this.el.replaceChildren(figures);
      this.el.hidden = items.length === 0;
      return;
    }
    figures.append(...buttons);
    const nodes: Node[] = [figures];
    if (brief) {
      const p = document.createElement('p');
      p.className = 'es-syn-brief';
      p.textContent = brief;
      nodes.push(p);
    }
    if (stamp) {
      const t = document.createElement('span');
      t.className = 'es-syn-stamp';
      t.textContent = stamp;
      figures.append(t);
    }
    this.el.replaceChildren(...nodes);
    this.el.hidden = items.length === 0 && !brief;
  }

  /** First load after `delayMs` (off the startup path), then every `intervalMs` while visible. */
  start(intervalMs = 5 * 60_000, delayMs = 1_500): void {
    this.stop();
    this.intervalMs = intervalMs;
    setTimeout(() => void this.refresh(), delayMs);
    this.timer = setInterval(() => { if (document.visibilityState === 'visible') void this.refresh(); }, intervalMs);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
  }
}

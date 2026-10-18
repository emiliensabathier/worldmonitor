import { describe, expect, it, vi } from 'vitest';
import { SynthesisBar } from '@/components/SynthesisBar';
import type { SynthesisData } from '@/components/synthesis-format';

const data: SynthesisData = {
  quotes: { '^GSPC': { price: 7659, change: -1.09 }, 'BZ=F': { price: 109.86, change: 3.7 } },
  eurusd: null, eu10y: 3.39, us2y: null, us10y: null,
  brief: 'Yields fell. Stocks slipped. Third sentence.', asOf: Date.parse('2026-10-17T22:29:38Z'),
};

describe('SynthesisBar', () => {
  it('renders figures as buttons and the two-sentence brief, as text only', async () => {
    const bar = new SynthesisBar({ load: async () => ({ ...data, brief: 'A <b>bold</b> claim. Two.' }), lang: 'en', onSelectDesk: () => {} });
    await bar.refresh();
    const el = bar.getElement();
    expect(el.tagName).toBe('SECTION');
    expect(el.getAttribute('aria-label')).toBe('Daily synthesis');
    expect([...el.querySelectorAll('button.es-syn-item')].map((b) => b.textContent)).toEqual(['EUR 10Y AAA 3.39%', 'S&P 500 7,659 −1.09%', 'Brent $109.86 +3.70%']);
    expect(el.querySelector('.es-syn-brief')!.textContent).toBe('A <b>bold</b> claim. Two.');
    expect(el.querySelector('b')).toBeNull();
  });

  it('opens the matching desk tab on click', async () => {
    const onSelectDesk = vi.fn();
    const bar = new SynthesisBar({ load: async () => data, lang: 'en', onSelectDesk });
    await bar.refresh();
    bar.getElement().querySelector<HTMLButtonElement>('button.es-syn-item:last-of-type')!.click();
    expect(onSelectDesk).toHaveBeenCalledWith('commodities');
  });

  it('keeps the previous content when a refresh fails, and hides when there is nothing', async () => {
    let fail = false;
    const bar = new SynthesisBar({ load: async () => { if (fail) throw new Error('down'); return data; }, lang: 'en', onSelectDesk: () => {} });
    await bar.refresh();
    fail = true;
    await bar.refresh();
    expect(bar.getElement().querySelectorAll('button.es-syn-item').length).toBe(3);
    const empty = new SynthesisBar({ load: async () => ({ ...data, quotes: {}, eu10y: null, brief: null }), lang: 'en', onSelectDesk: () => {} });
    await empty.refresh();
    expect(empty.getElement().hidden).toBe(true);
  });

  it('uses the French label for the region', () => {
    expect(new SynthesisBar({ load: async () => data, lang: 'fr', onSelectDesk: () => {} }).getElement().getAttribute('aria-label')).toBe('Synthèse du jour');
  });
});

describe('SynthesisBar lifecycle', () => {
  it('defers the first load off the startup path, and refreshes on return when stale', async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(async () => data);
      const bar = new SynthesisBar({ load, lang: 'en', onSelectDesk: () => {} });
      bar.start(300_000, 1_500);
      expect(load).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_500);
      expect(load).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(301_000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
      bar.stop();
    } finally { vi.useRealTimers(); }
  });
});

describe('SynthesisBar brief cleanup', () => {
  it('drops the World Brief source markers like [1] or [12]', async () => {
    const bar = new SynthesisBar({ load: async () => ({ ...data, brief: 'Yields fell [1][2]. Stocks slipped [12]. Third.' }), lang: 'en', onSelectDesk: () => {} });
    await bar.refresh();
    expect(bar.getElement().querySelector('.es-syn-brief')!.textContent).toBe('Yields fell. Stocks slipped.');
  });
});

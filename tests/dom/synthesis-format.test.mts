import { describe, expect, it } from 'vitest';
import { buildSynthesisItems, firstSentences, formatSynthesisStamp, type SynthesisData } from '@/components/synthesis-format';

const full: SynthesisData = {
  quotes: {
    '^TNX': { price: 4.2, change: -0.7109 }, '^GSPC': { price: 7659.44, change: -1.0927 },
    '^FCHI': { price: 8123.5, change: 0.4 }, '^VIX': { price: 19.99, change: 21.4459 },
    'BZ=F': { price: 109.86, change: 0 }, 'GC=F': { price: 4181.1, change: 0.52 },
  },
  eurusd: { rate: 1.1253, change1d: 0.0045 }, eu10y: 3.39, us2y: 4.74, us10y: 5.09,
  brief: 'Yields fell after the auction. Stocks slipped. Oil held near highs.', asOf: Date.parse('2026-10-17T22:29:38Z'),
};

describe('buildSynthesisItems', () => {
  it('renders the nine figures in order, with desks and units (English)', () => {
    expect(buildSynthesisItems(full, 'en')).toEqual([
      { label: 'US 10Y', value: '4.20%', change: '−3 bp', dir: 'down', desk: 'rates-fx' },
      { label: '2s10s', value: '+35 bp', change: '', dir: '', desk: 'rates-fx' },
      { label: 'EUR 10Y AAA', value: '3.39%', change: '', dir: '', desk: 'rates-fx' },
      { label: 'S&P 500', value: '7,659', change: '−1.09%', dir: 'down', desk: 'equities' },
      { label: 'CAC 40', value: '8,124', change: '+0.40%', dir: 'up', desk: 'equities' },
      { label: 'VIX', value: '19.99', change: '+21.45%', dir: 'up', desk: 'equities' },
      { label: 'EUR/USD', value: '1.1253', change: '+0.40%', dir: 'up', desk: 'rates-fx' },
      { label: 'Brent', value: '$109.86', change: '', dir: '', desk: 'commodities' },
      { label: 'Gold', value: '$4,181', change: '+0.52%', dir: 'up', desk: 'commodities' },
    ]);
  });

  it('uses French formats and labels', () => {
    const items = buildSynthesisItems(full, 'fr');
    expect(items[0]).toMatchObject({ value: '4,20%', change: '−3 pb' });
    expect(items[1].value).toBe('+35 pb');
    expect(items[8].label).toBe('Or');
    expect(items[3].value).toMatch(/^7\s659$/u);
  });

  it('drops any figure whose data is missing, never printing NaN', () => {
    const items = buildSynthesisItems({ quotes: { '^GSPC': { price: null, change: null } }, eurusd: null, eu10y: null, us2y: 4.7, us10y: null, brief: null, asOf: null }, 'en');
    expect(items).toEqual([]);
  });
});

describe('firstSentences', () => {
  it('keeps the first n sentences', () => {
    expect(firstSentences(full.brief!, 2)).toBe('Yields fell after the auction. Stocks slipped.');
  });
  it('does not split on decimals or abbreviations like U.S.', () => {
    expect(firstSentences('The U.S. 10-year rose to 4.2%. Then it fell. Third.', 2)).toBe('The U.S. 10-year rose to 4.2%. Then it fell.');
  });
  it('returns short text unchanged and trims whitespace', () => {
    expect(firstSentences('  Only one  ', 2)).toBe('Only one');
  });
});

describe('formatSynthesisStamp', () => {
  it('gives Paris time', () => {
    expect(formatSynthesisStamp(full.asOf!, 'en')).toBe('18 Oct, 00:29');
  });
});

describe('firstSentences length cap', () => {
  it('never returns more than 320 characters, even when no sentence break is found', () => {
    const out = firstSentences('word '.repeat(200), 2);
    expect(out.length).toBeLessThanOrEqual(320);
    expect(out.endsWith('…')).toBe(true);
  });
});

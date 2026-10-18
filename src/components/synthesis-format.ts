// Pure formatting for the Sabathier synthesis band (no DOM, no fetch).
import type { DeskKey } from '@/config/sabathier-desk';

export interface SynthesisData {
  quotes: Record<string, { price: number | null; change: number | null }>;
  eurusd: { rate: number; change1d: number } | null;
  eu10y: number | null;
  us2y: number | null;
  us10y: number | null;
  brief: string | null;
  asOf: number | null;
}

export interface SynthesisItem { label: string; value: string; change: string; dir: 'up' | 'down' | ''; desk: DeskKey }

const LOCALE = (lang: string) => (lang.toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-GB');
const fmt = (lang: string, n: number, digits: number) =>
  new Intl.NumberFormat(LOCALE(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const signed = (lang: string, n: number, digits: number, unit: string) =>
  (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(lang, Math.abs(n), digits) + unit;
const dirOf = (n: number): SynthesisItem['dir'] => (n > 0 ? 'up' : n < 0 ? 'down' : '');
const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

function pct(lang: string, label: string, desk: DeskKey, q: { price: number | null; change: number | null } | undefined, digits: number, prefix = ''): SynthesisItem | null {
  if (!q || !ok(q.price)) return null;
  const c = ok(q.change) && q.change !== 0 ? q.change : null;
  return { label, value: prefix + fmt(lang, q.price, digits), change: c === null ? '' : signed(lang, c, 2, '%'), dir: c === null ? '' : dirOf(c), desk };
}

export function buildSynthesisItems(d: SynthesisData, lang: string): SynthesisItem[] {
  const fr = LOCALE(lang) === 'fr-FR';
  const bp = fr ? ' pb' : ' bp';
  const out: Array<SynthesisItem | null> = [];
  const tnx = d.quotes['^TNX'];
  if (tnx && ok(tnx.price)) {
    const move = ok(tnx.change) ? Math.round((tnx.price - tnx.price / (1 + tnx.change / 100)) * 100) : 0;
    out.push({ label: 'US 10Y', value: fmt(lang, tnx.price, 2) + '%', change: move === 0 ? '' : signed(lang, move, 0, bp), dir: dirOf(move), desk: 'rates-fx' });
  }
  if (ok(d.us2y) && ok(d.us10y)) {
    out.push({ label: '2s10s', value: signed(lang, Math.round((d.us10y - d.us2y) * 100), 0, bp), change: '', dir: '', desk: 'rates-fx' });
  }
  if (ok(d.eu10y)) out.push({ label: 'EUR 10Y AAA', value: fmt(lang, d.eu10y, 2) + '%', change: '', dir: '', desk: 'rates-fx' });
  out.push(pct(lang, 'S&P 500', 'equities', d.quotes['^GSPC'], 0));
  out.push(pct(lang, 'CAC 40', 'equities', d.quotes['^FCHI'], 0));
  out.push(pct(lang, 'VIX', 'equities', d.quotes['^VIX'], 2));
  if (d.eurusd && ok(d.eurusd.rate)) {
    const base = d.eurusd.rate - d.eurusd.change1d;
    const c = ok(d.eurusd.change1d) && d.eurusd.change1d !== 0 && base > 0 ? (d.eurusd.change1d / base) * 100 : null;
    out.push({ label: 'EUR/USD', value: fmt(lang, d.eurusd.rate, 4), change: c === null ? '' : signed(lang, c, 2, '%'), dir: c === null ? '' : dirOf(c), desk: 'rates-fx' });
  }
  out.push(pct(lang, 'Brent', 'commodities', d.quotes['BZ=F'], 2, '$'));
  out.push(pct(lang, fr ? 'Or' : 'Gold', 'commodities', d.quotes['GC=F'], 0, '$'));
  return out.filter((x): x is SynthesisItem => x !== null);
}

// A sentence ends at . ! or ? followed by a space and a capital letter; dots inside numbers (4.2) or
// single-letter abbreviations (U.S.) never end one.
export function firstSentences(text: string, n: number): string {
  const s = text.trim();
  const ends: number[] = [];
  const re = /[.!?](?=\s+[A-ZÀ-Ý])/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (/(?:^|[\s.])[A-Z]$/.test(s.slice(0, m.index))) continue; // U.S. / J.P.
    ends.push(m.index + 1);
    if (ends.length === n) break;
  }
  return ends.length === n ? s.slice(0, ends[n - 1]) : s;
}

export function formatSynthesisStamp(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(LOCALE(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(ms));
}

// Shared market number formatters. Kept off the `@/utils` barrel so Node tests
// can import pulse HTML without loading `proxy.ts` → `import.meta.env.DEV`.

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function formatPrice(price: number | null | undefined): string {
  if (!isFiniteNumber(price)) return '--';
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }
  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Indices whose Yahoo symbol has no caret.
const UNCARETED_INDICES = new Set(['000001.SS', 'DX-Y.NYB', 'FTSEMIB.MI', 'DFMGI.AE']);

// Listing suffix → currency sign (US listings have none and keep '$').
const LISTING_CURRENCY: Record<string, string> = {
  PA: '€', DE: '€', AS: '€', MI: '€', MC: '€', BR: '€',
  L: '£', SW: 'CHF ', HK: 'HK$', T: '¥', KS: '₩', SS: '¥', SZ: '¥', NS: '₹', SR: 'SAR ', TO: 'C$',
};

/**
 * A quote in its own unit: indices in points and currency pairs as rates (no currency sign),
 * shares in the currency of their listing.
 */
export function formatQuotePrice(symbol: string, price: number | null | undefined): string {
  if (!isFiniteNumber(price)) return '--';
  const fixed = (digits: number) => price.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (symbol.endsWith('=X')) return fixed(price >= 20 ? 2 : 4);
  if (symbol.startsWith('^') || UNCARETED_INDICES.has(symbol)) return fixed(2);
  const suffix = symbol.includes('.') ? symbol.slice(symbol.lastIndexOf('.') + 1) : '';
  const sign = LISTING_CURRENCY[suffix] ?? '$';
  return `${sign}${fixed(price >= 1000 ? 0 : 2)}`;
}

export function formatChange(change: number | null | undefined): string {
  if (!isFiniteNumber(change)) return '--';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function getChangeClass(change: number | null | undefined): string {
  if (!isFiniteNumber(change)) return '';
  return change >= 0 ? 'up' : 'down';
}

export function getHeatmapClass(change: number | null | undefined): string {
  if (!isFiniteNumber(change)) return '';
  const abs = Math.abs(change);
  const direction = change >= 0 ? 'up' : 'down';

  if (abs >= 2) return `${direction}-3`;
  if (abs >= 1) return `${direction}-2`;
  return `${direction}-1`;
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same loading trick as format-price-nullsafe: market-format.ts is pure, the barrel is not.
async function loadFormat(): Promise<{ formatQuotePrice: (symbol: string, p: number | null | undefined) => string }> {
  const src = readFileSync(resolve(__dirname, '../src/utils/market-format.ts'), 'utf-8');
  const { code } = transformSync(src, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${Date.now()}`);
}

const plain = (n: number, digits: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

describe('formatQuotePrice', () => {
  it('quotes indices as points, with no currency sign', async () => {
    const { formatQuotePrice } = await loadFormat();
    assert.equal(formatQuotePrice('^FCHI', 7911.6), plain(7911.6, 2));
    assert.equal(formatQuotePrice('^VIX', 17.3), plain(17.3, 2));
    assert.equal(formatQuotePrice('000001.SS', 3301.25), plain(3301.25, 2));
    assert.equal(formatQuotePrice('DX-Y.NYB', 98.1234), plain(98.1234, 2));
  });

  it('quotes currency pairs to four decimals, yen-sized pairs to two', async () => {
    const { formatQuotePrice } = await loadFormat();
    assert.equal(formatQuotePrice('EURUSD=X', 1.12318), plain(1.12318, 4));
    assert.equal(formatQuotePrice('JPY=X', 151.237), plain(151.237, 2));
  });

  it('prices shares in their listing currency', async () => {
    const { formatQuotePrice } = await loadFormat();
    assert.equal(formatQuotePrice('MC.PA', 612.4), `€${plain(612.4, 2)}`);
    assert.equal(formatQuotePrice('NESN.SW', 81.2), `CHF ${plain(81.2, 2)}`);
    assert.equal(formatQuotePrice('0700.HK', 512), `HK$${plain(512, 2)}`);
    assert.equal(formatQuotePrice('AAPL', 231.5), `$${plain(231.5, 2)}`);
    assert.equal(formatQuotePrice('7203.T', 2875), `¥${plain(2875, 0)}`);
  });

  it('keeps the unavailable placeholder', async () => {
    const { formatQuotePrice } = await loadFormat();
    assert.equal(formatQuotePrice('^GSPC', undefined), '--');
    assert.equal(formatQuotePrice('EURUSD=X', null), '--');
  });
});

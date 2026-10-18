// Loads the synthesis band data through the app's existing services (their breakers cache 5 min / 4 h).
import { fetchCommodityQuotes, fetchMultipleStocks } from '@/services/market';
import { getEcbFxRatesData } from '@/services/economic';
import { fetchServerInsights } from '@/services/insights-loader';
import type { EconomicServiceClient } from '@/generated/client/worldmonitor/economic/v1/service_client';
import { memoize, type SynthesisData } from '@/components/synthesis-format';

const STOCKS = [
  { symbol: '^TNX', name: 'US 10-Year Yield', display: 'US 10Y' },
  { symbol: '^GSPC', name: 'S&P 500', display: 'SPX' },
  { symbol: '^FCHI', name: 'CAC 40', display: 'CAC' },
];
const COMMODITIES = [
  { symbol: '^VIX', name: 'VIX', display: 'VIX' },
  { symbol: 'BZ=F', name: 'Brent', display: 'BRENT' },
  { symbol: 'GC=F', name: 'Gold', display: 'GOLD' },
];

let client: EconomicServiceClient | null = null;
async function economic(): Promise<EconomicServiceClient> {
  if (!client) {
    const { EconomicServiceClient } = await import('@/generated/client/worldmonitor/economic/v1/service_client');
    const { getRpcBaseUrl } = await import('@/services/rpc-client');
    client = new EconomicServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
  }
  return client;
}

// Yield curves change once a day: cache them 30 min instead of asking on every 5-min refresh.
const euCurve = memoize(async () => (await economic()).getEuYieldCurve({}), 30 * 60_000);
const usCurve = memoize(async () => (await economic()).getUsTreasuryParYieldCurve({ history: false }), 30 * 60_000);

const settled = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

export async function loadSynthesisData(): Promise<SynthesisData> {
  const [stocks, commodities, fx, eu, us, insights] = await Promise.allSettled([
    fetchMultipleStocks(STOCKS),
    fetchCommodityQuotes(COMMODITIES),
    getEcbFxRatesData(),
    euCurve(),
    usCurve(),
    fetchServerInsights(),
  ]);
  const quotes: SynthesisData['quotes'] = {};
  for (const q of [...(settled(stocks)?.data ?? []), ...(settled(commodities)?.data ?? [])]) quotes[q.symbol] = { price: q.price, change: q.change };
  const pair = settled(fx)?.rates?.find((r) => r.pair === 'EURUSD');
  const curves = settled(us)?.curves ?? [];
  const curve = curves[curves.length - 1];
  const ins = settled(insights);
  const stamps = [settled(stocks)?.asOf, settled(commodities)?.asOf].map((s) => (s ? Date.parse(String(s)) : NaN)).filter(Number.isFinite);
  return {
    quotes,
    eurusd: pair ? { rate: pair.rate, change1d: pair.change1d } : null,
    eu10y: settled(eu)?.data?.rates?.['10Y'] ?? null,
    us2y: curve?.twoYear ?? null,
    us10y: curve?.tenYear ?? null,
    brief: ins && ins.status !== 'degraded' && ins.worldBrief ? ins.worldBrief : null,
    asOf: stamps.length ? Math.max(...stamps) : null,
  };
}

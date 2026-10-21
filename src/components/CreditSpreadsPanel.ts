import type { EconomicServiceClient } from '@/generated/client/worldmonitor/economic/v1/service_client';
import { Panel } from './Panel';
import { getCurrentLanguage, t } from '@/services/i18n';
import { joinSafeHtml, safeHtml, unsafeRawHtml } from '@/utils/sanitize';
import { miniSparkline } from '@/utils/sparkline';

/**
 * Sabathier Terminal ECO screen: US corporate credit spreads (ICE BofA option-adjusted spreads, seeded
 * from FRED), with their day and one-month moves and where they sit in the window shown.
 */

let _client: EconomicServiceClient | null = null;
async function getEconomicClient(): Promise<EconomicServiceClient> {
  if (!_client) {
    const { EconomicServiceClient } = await import('@/generated/client/worldmonitor/economic/v1/service_client');
    const { getRpcBaseUrl } = await import('@/services/rpc-client');
    _client = new EconomicServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
  }
  return _client;
}

const SERIES = [
  { id: 'BAMLC0A0CM', key: 'ig' },
  { id: 'BAMLH0A0HYM2', key: 'hy' },
] as const;

/** About a year of business days. */
const OBSERVATIONS = 260;

export interface SpreadObservation {
  date: string;
  value: number;
}

export interface SpreadStats {
  bp: number;
  dayBp: number | null;
  monthBp: number | null;
  /** 0-100: where the latest value sits between the window's low and high. */
  rank: number | null;
  low: number;
  high: number;
  date: string;
}

/** Spread statistics in basis points from percent observations (ascending dates). */
export function spreadStats(obs: readonly SpreadObservation[]): SpreadStats | null {
  const clean = obs.filter((o) => Number.isFinite(o.value));
  const last = clean[clean.length - 1];
  if (!last) return null;
  const bp = (v: number) => Math.round(v * 100);
  const prev = clean.length > 1 ? clean[clean.length - 2] : undefined;
  const monthAgo = clean.length > 21 ? clean[clean.length - 22] : undefined;
  const values = clean.map((o) => o.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    bp: bp(last.value),
    dayBp: prev ? bp(last.value) - bp(prev.value) : null,
    monthBp: monthAgo ? bp(last.value) - bp(monthAgo.value) : null,
    rank: high > low ? Math.round(((last.value - low) / (high - low)) * 100) : null,
    low: bp(low),
    high: bp(high),
    date: last.date,
  };
}

function signed(v: number | null): string {
  if (v === null) return '--';
  return `${v > 0 ? '+' : ''}${v}`;
}

// Wider spreads mean more credit stress: a widening reads red, a tightening green.
function moveClass(v: number | null): string {
  if (v === null || v === 0) return 'fx-flat';
  return v > 0 ? 'change-negative' : 'change-positive';
}

export class CreditSpreadsPanel extends Panel {
  constructor() {
    super({ id: 'credit-spreads', title: t('panels.creditSpreads'), showCount: false, infoTooltip: t('components.creditSpreads.infoTooltip') });
  }

  public async fetchData(): Promise<boolean> {
    try {
      const client = await getEconomicClient();
      const resp = await client.getFredSeriesBatch({ seriesIds: SERIES.map((s) => s.id), limit: OBSERVATIONS });
      const rows = SERIES.map((s) => {
        const obs = (resp.results?.[s.id]?.observations ?? []) as SpreadObservation[];
        return { ...s, obs, stats: spreadStats(obs) };
      }).filter((r) => r.stats !== null);
      if (!this.element?.isConnected) return false;
      if (rows.length === 0) {
        this.showError(t('components.creditSpreads.unavailable'), () => void this.fetchData());
        return false;
      }
      const lang = getCurrentLanguage();
      const body = joinSafeHtml(rows.map((r) => {
        const st = r.stats!;
        const date = new Date(`${st.date}T00:00:00Z`).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
        return safeHtml`<tr>
          <td class="fx-ccy"><span class="fx-ccy-code">${t(`components.creditSpreads.${r.key}`)}</span><span class="fx-ccy-country">${t(`components.creditSpreads.${r.key}Long`)}</span></td>
          <td>${unsafeRawHtml(miniSparkline(r.obs.slice(-120).map((o) => o.value), st.monthBp === null ? null : -st.monthBp, 60, 16), 'sparkline svg built from numbers')}</td>
          <td>${st.bp}</td>
          <td class="${moveClass(st.dayBp)}">${signed(st.dayBp)}</td>
          <td class="${moveClass(st.monthBp)}">${signed(st.monthBp)}</td>
          <td class="fx-window">${st.rank === null ? '--' : `${st.rank}%`}<span class="fx-window-dates">${st.low}–${st.high}</span></td>
          <td class="fx-window">${date}</td>
        </tr>`;
      }));
      this.setSafeContent(safeHtml`<div class="fx-scroll"><table class="fx-table">
        <thead><tr>
          <th scope="col" class="fx-ccy">${t('components.creditSpreads.index')}</th>
          <th scope="col">${t('components.creditSpreads.trend')}</th>
          <th scope="col">${t('components.creditSpreads.oas')}</th>
          <th scope="col">${t('components.creditSpreads.day')}</th>
          <th scope="col">${t('components.creditSpreads.month')}</th>
          <th scope="col">${t('components.creditSpreads.rank')}</th>
          <th scope="col">${t('components.creditSpreads.date')}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      <div class="fx-footer">${t('components.creditSpreads.footer')}</div>`);
      return true;
    } catch (error) {
      if (!this.element?.isConnected) return false;
      console.warn('[CreditSpreadsPanel] failed', error);
      this.showError(t('components.creditSpreads.unavailable'), () => void this.fetchData());
      return false;
    }
  }
}

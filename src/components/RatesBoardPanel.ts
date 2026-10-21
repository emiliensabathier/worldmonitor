import { Panel } from './Panel';
import { t, getCurrentLanguage } from '@/services/i18n';
import { joinSafeHtml, safeHtml } from '@/utils/sanitize';
import type { SafeHtml } from '@/utils/sanitize';

/**
 * Sabathier Terminal GOVT screen: 10-year sovereign yields, spreads and policy rates, from the
 * `ratesBoard` on-demand bootstrap key (scripts/seed-rates-board.mjs).
 */

export interface RatesBoardRow {
  id: string;
  label: string;
  value: number;
  previous: number | null;
  date: string;
  frequency: 'daily' | 'monthly';
  source: string;
}

export interface RatesBoardSpread {
  id: string;
  label: string;
  bp: number;
  previousBp: number | null;
  date: string;
  frequency: 'daily' | 'monthly';
}

export interface RatesBoard {
  sovereign: RatesBoardRow[];
  spreads: RatesBoardSpread[];
  policy: RatesBoardRow[];
}

/** The payload, enveloped ({ _seed, data }) or not; null when it is not a board. */
export function toRatesBoard(payload: unknown): RatesBoard | null {
  const raw = (payload && typeof payload === 'object' && '_seed' in payload && 'data' in payload)
    ? (payload as { data: unknown }).data
    : payload;
  const board = raw as Partial<RatesBoard> | null | undefined;
  if (!board || !Array.isArray(board.sovereign) || !Array.isArray(board.policy)) return null;
  return { sovereign: board.sovereign, spreads: Array.isArray(board.spreads) ? board.spreads : [], policy: board.policy };
}

/** Change in basis points, signed; null without a previous value. */
export function changeBp(value: number, previous: number | null): number | null {
  return previous === null || !Number.isFinite(previous) ? null : Math.round((value - previous) * 100);
}

export function formatBp(bp: number | null): string {
  if (bp === null) return '--';
  return `${bp > 0 ? '+' : ''}${bp}`;
}

/** 2026-10-20 → 20/10 (daily), 2026-09 → sept. 2026 (monthly). */
export function formatObservationDate(date: string, lang: string): string {
  const monthly = /^\d{4}-\d{2}$/.test(date);
  const parsed = new Date(`${monthly ? `${date}-01` : date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(lang, monthly
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function changeClass(bp: number | null): string {
  if (bp === null || bp === 0) return 'fx-flat';
  return bp > 0 ? 'change-positive' : 'change-negative';
}

const REFRESH_RETRY_MS = 60_000;

export class RatesBoardPanel extends Panel {
  private inFlight = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ id: 'rates-board', title: t('panels.ratesBoard'), infoTooltip: t('components.ratesBoard.infoTooltip') });
  }

  public async fetchData(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const { ensureHydrated } = await import('@/services/bootstrap');
      const board = toRatesBoard(await ensureHydrated('ratesBoard').catch(() => undefined));
      if (!this.element?.isConnected) return;
      if (!board || board.sovereign.length === 0) {
        this.showError(t('common.failedMarketData'), () => void this.fetchData());
        this.scheduleRetry();
        return;
      }
      this.render(board);
    } finally {
      this.inFlight = false;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.element?.isConnected) void this.fetchData();
    }, REFRESH_RETRY_MS);
  }

  public destroy(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    super.destroy();
  }

  private render(board: RatesBoard): void {
    const lang = getCurrentLanguage();
    const region = (() => {
      try { return new Intl.DisplayNames([lang], { type: 'region' }); } catch { return null; }
    })();
    const place = (id: string) => (id === 'EA' ? t('components.ratesBoard.euroArea') : region?.of(id) ?? id);
    const when = (row: { date: string; frequency: string }) =>
      `${formatObservationDate(row.date, lang)}${row.frequency === 'monthly' ? ` · ${t('components.ratesBoard.monthly')}` : ''}`;

    const sovereign = joinSafeHtml(board.sovereign.map((r) => {
      const bp = changeBp(r.value, r.previous);
      return safeHtml`<tr>
        <td class="fx-ccy"><span class="fx-ccy-code">${r.label}</span><span class="fx-ccy-country">${place(r.id)}</span></td>
        <td>${r.value.toFixed(2)}%</td>
        <td class="${changeClass(bp)}">${formatBp(bp)}</td>
        <td class="fx-window">${when(r)}</td>
      </tr>`;
    }));
    const spreads = joinSafeHtml(board.spreads.map((s) => {
      const bp = s.previousBp === null ? null : s.bp - s.previousBp;
      return safeHtml`<tr>
        <td class="fx-ccy"><span class="fx-ccy-code">${s.label}</span></td>
        <td>${s.bp}</td>
        <td class="${changeClass(bp)}">${formatBp(bp)}</td>
        <td class="fx-window">${when(s)}</td>
      </tr>`;
    }));
    const policy = joinSafeHtml(board.policy.map((r) => {
      const bp = changeBp(r.value, r.previous);
      return safeHtml`<tr>
        <td class="fx-ccy"><span class="fx-ccy-code">${r.label}</span><span class="fx-ccy-country">${place(r.id)}</span></td>
        <td>${r.value.toFixed(2)}%</td>
        <td class="${changeClass(bp)}">${formatBp(bp)}</td>
        <td class="fx-window">${when(r)}</td>
      </tr>`;
    }));

    const head = (first: string, value: string, change: string) => safeHtml`<thead><tr>
      <th scope="col" class="fx-ccy">${first}</th><th scope="col">${value}</th><th scope="col">${change}</th><th scope="col">${t('components.ratesBoard.date')}</th>
    </tr></thead>`;
    const sources = [...new Set([...board.sovereign, ...board.policy].map((r) => r.source))].join(', ');

    const sections: SafeHtml[] = [
      safeHtml`<div class="fx-section-title">${t('components.ratesBoard.sovereign')}</div>
        <table class="fx-table">${head(t('components.ratesBoard.bond'), t('components.ratesBoard.yield'), t('components.ratesBoard.changeBp'))}<tbody>${sovereign}</tbody></table>`,
    ];
    if (board.spreads.length > 0) {
      sections.push(safeHtml`<div class="fx-section-title">${t('components.ratesBoard.spreads')}</div>
        <table class="fx-table">${head(t('components.ratesBoard.spread'), t('components.ratesBoard.bp'), t('components.ratesBoard.changeBp'))}<tbody>${spreads}</tbody></table>`);
    }
    if (board.policy.length > 0) {
      sections.push(safeHtml`<div class="fx-section-title">${t('components.ratesBoard.policy')}</div>
        <table class="fx-table">${head(t('components.ratesBoard.centralBank'), t('components.ratesBoard.rate'), t('components.ratesBoard.lastMoveBp'))}<tbody>${policy}</tbody></table>`);
    }
    this.setSafeContent(safeHtml`<div class="fx-scroll">${joinSafeHtml(sections)}</div>
      <div class="fx-footer">${t('components.ratesBoard.sources', { sources })}</div>`);
  }
}

import { Panel } from './Panel';
import type { OilAnalytics, CrudeInventoryWeek, NatGasStorageWeek, GetEuGasStorageResponse, GetOilStocksAnalysisResponse, LngVulnerabilityData } from '@/services/economic';
import { formatOilValue, getTrendColor, getTrendIndicator } from '@/services/economic';
import type { MarketData } from '@/types';
import { t } from '@/services/i18n';
import { escapeHtml, unsafeRawHtml } from '@/utils/sanitize';
import { formatPrice, formatChange, getChangeClass } from '@/utils';
import { miniSparkline } from '@/utils/sparkline';

const EC = 'components.energyComplex';

const METRIC_NAME_KEYS: Record<string, string> = {
  wti: 'metrics.wti',
  brent: 'metrics.brent',
  production: 'metrics.production',
  inventory: 'metrics.inventory',
};

const UNIT_KEYS: Record<string, string> = {
  '$/barrel': 'units.usdPerBarrel',
};

const TAPE_LABEL_KEYS: Record<string, string> = {
  'CL=F': 'tape.oil',
  'BZ=F': 'tape.brent',
  'NG=F': 'tape.natgas',
};

const EU_TREND_KEYS: Record<string, string> = {
  stable: 'euTrend.stable',
  injecting: 'euTrend.injecting',
  withdrawing: 'euTrend.withdrawing',
};

function ec(key: string, params?: Record<string, unknown>): string {
  return t(`${EC}.${key}`, params);
}

function mapped(map: Record<string, string>, value: string, fallback = value): string {
  const key = map[value];
  return key ? ec(key) : fallback;
}

function hasAnalytics(data: OilAnalytics | null): boolean {
  return !!(data?.wtiPrice || data?.brentPrice || data?.usProduction || data?.usInventory);
}

export class EnergyComplexPanel extends Panel {
  private analytics: OilAnalytics | null = null;
  private tape: MarketData[] = [];
  private crudeWeeks: CrudeInventoryWeek[] = [];
  private natGasWeeks: NatGasStorageWeek[] = [];
  private euGas: GetEuGasStorageResponse | null = null;
  private oilStocksAnalysis: GetOilStocksAnalysisResponse | null = null;
  private lngVulnerability: LngVulnerabilityData | null = null;

  constructor() {
    super({
      id: 'energy-complex',
      title: t('panels.energyComplex'),
      defaultRowSpan: 2,
      infoTooltip: t('components.energyComplex.infoTooltip'),
    });
  }

  public updateAnalytics(data: OilAnalytics): void {
    this.analytics = data;
    this.render();
  }

  public updateTape(data: MarketData[]): void {
    this.tape = data.filter((item) => item.price !== null);
    this.render();
  }

  public updateCrudeInventories(weeks: CrudeInventoryWeek[]): void {
    this.crudeWeeks = weeks;
    this.render();
  }

  public updateNatGas(weeks: NatGasStorageWeek[]): void {
    this.natGasWeeks = weeks;
    this.render();
  }

  public updateEuGasStorage(data: GetEuGasStorageResponse): void {
    this.euGas = data.unavailable ? null : data;
    this.render();
  }

  public setOilStocksAnalysis(data: GetOilStocksAnalysisResponse): void {
    this.oilStocksAnalysis = data.unavailable ? null : data;
    this.render();
  }

  public updateLngVulnerability(data: LngVulnerabilityData | null): void {
    this.lngVulnerability = data?.top20LngDependent?.length ? data : null;
    this.render();
  }

  private renderOilStocksSection(): string {
    const d = this.oilStocksAnalysis;
    if (!d || d.ieaMembers.length === 0) return '';

    const rows = d.ieaMembers.map(m => {
      const daysDisplay = m.netExporter
        ? `<span class="energy-net-exporter-badge">${escapeHtml(ec('oilStocks.netExporter'))}</span>`
        : m.daysOfCover != null
          ? escapeHtml(ec('oilStocks.daysValue', { days: m.daysOfCover }))
          : '—';
      const warningBadge = m.belowObligation
        ? `<span class="energy-below-obligation-badge">${escapeHtml(ec('oilStocks.below90'))}</span>`
        : '';
      return `
        <tr class="oil-stocks-row">
          <td class="oil-stocks-rank">${escapeHtml(String(m.rank))}</td>
          <td class="oil-stocks-iso">${escapeHtml(m.iso2)}</td>
          <td class="oil-stocks-days">${daysDisplay}${warningBadge}</td>
          <td class="oil-stocks-vs">${m.vsObligation != null ? (m.vsObligation > 0 ? '+' : '') + escapeHtml(String(m.vsObligation)) : '—'}</td>
        </tr>`;
    }).join('');

    const reg = d.regionalSummary;
    const euRow = reg?.europe?.avgDays != null
      ? `<div class="oil-stocks-region-row"><span class="oil-stocks-region-name">${escapeHtml(ec('oilStocks.regions.europe'))}</span><span>${escapeHtml(ec('oilStocks.avgMin', { avg: reg.europe.avgDays, min: reg.europe?.minDays ?? '—' }))}</span>${(reg.europe.countBelowObligation ?? 0) > 0 ? `<span class="energy-below-obligation-badge">${escapeHtml(ec('oilStocks.belowCount', { count: reg.europe.countBelowObligation }))}</span>` : ''}</div>`
      : '';
    const apRow = reg?.asiaPacific?.avgDays != null
      ? `<div class="oil-stocks-region-row"><span class="oil-stocks-region-name">${escapeHtml(ec('oilStocks.regions.asiaPacific'))}</span><span>${escapeHtml(ec('oilStocks.avgMin', { avg: reg.asiaPacific.avgDays, min: reg.asiaPacific?.minDays ?? '—' }))}</span>${(reg.asiaPacific.countBelowObligation ?? 0) > 0 ? `<span class="energy-below-obligation-badge">${escapeHtml(ec('oilStocks.belowCount', { count: reg.asiaPacific.countBelowObligation }))}</span>` : ''}</div>`
      : '';
    const naRow = reg?.northAmerica
      ? `<div class="oil-stocks-region-row"><span class="oil-stocks-region-name">${escapeHtml(ec('oilStocks.regions.northAmerica'))}</span><span>${escapeHtml(ec('oilStocks.netExporters', { count: reg.northAmerica.netExporters ?? 0 }))}${reg.northAmerica.avgDays != null ? escapeHtml(ec('oilStocks.avgSuffix', { avg: reg.northAmerica.avgDays })) : ''}</span></div>`
      : '';

    return `
      <div class="energy-tape-section" style="margin-top:8px">
        <div class="energy-section-title">${escapeHtml(ec('oilStocks.title'))}</div>
        <table class="oil-stocks-table">
          <thead><tr><th scope="col">#</th><th scope="col">${escapeHtml(ec('oilStocks.colCountry'))}</th><th scope="col">${escapeHtml(ec('oilStocks.colDays'))}</th><th scope="col">${escapeHtml(ec('oilStocks.colVs90'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="oil-stocks-regional" style="margin-top:6px">
          ${euRow}${apRow}${naRow}
        </div>
        <div class="indicator-date" style="margin-top:4px">${escapeHtml(ec('dataSource', { month: d.dataMonth, source: ec('sources.iea') }))}</div>
      </div>`;
  }

  private renderLngVulnerabilitySection(): string {
    const d = this.lngVulnerability;
    if (!d || d.top20LngDependent.length === 0) return '';

    const top5 = d.top20LngDependent.slice(0, 5);
    const rows = top5.map(e => `
      <tr class="oil-stocks-row">
        <td class="oil-stocks-iso">${escapeHtml(e.iso2)}</td>
        <td class="oil-stocks-days">${escapeHtml((e.lngShareOfImports * 100).toFixed(1))}%</td>
        <td class="oil-stocks-vs">${escapeHtml(String(Math.round(e.lngImportsTj)))} TJ</td>
      </tr>`).join('');

    return `
      <div class="energy-tape-section" style="margin-top:8px">
        <div class="energy-section-title">${escapeHtml(ec('lng.title'))}</div>
        <table class="oil-stocks-table">
          <thead><tr><th scope="col">${escapeHtml(ec('lng.colCountry'))}</th><th scope="col">${escapeHtml(ec('lng.colShare'))}</th><th scope="col">${escapeHtml(ec('lng.colImports'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="indicator-date" style="margin-top:4px">${escapeHtml(ec('dataSource', { month: d.dataMonth, source: 'JODI Gas' }))}</div>
      </div>`;
  }

  private render(): void {
    // Suppress EIA price cards when live tape already covers the same commodity
    // to avoid showing two different prices for the same product (EIA is weekly/stale).
    const tapeCoveredSymbols = new Set(this.tape.filter(d => d.price !== null).map(d => d.symbol));
    const wtiInTape = tapeCoveredSymbols.has('CL=F');
    const brentInTape = tapeCoveredSymbols.has('BZ=F');

    const metrics = [
      wtiInTape ? null : this.analytics?.wtiPrice,
      brentInTape ? null : this.analytics?.brentPrice,
      this.analytics?.usProduction,
      this.analytics?.usInventory,
    ].filter(Boolean);

    if (metrics.length === 0 && this.tape.length === 0 && this.crudeWeeks.length === 0 && this.natGasWeeks.length === 0 && !this.euGas && !this.oilStocksAnalysis && !this.lngVulnerability) {
      this.setSafeContent(unsafeRawHtml(`<div class="economic-empty">${t('components.energyComplex.noData')}</div>`, 'legacy Panel.setContent() migration'));
      return;
    }

    const footerParts = [];
    if (hasAnalytics(this.analytics)) footerParts.push('EIA');
    if (this.tape.length > 0) footerParts.push(t('components.energyComplex.liveTapeSource'));
    if (this.euGas) footerParts.push('GIE AGSI+');
    if (this.oilStocksAnalysis) footerParts.push(ec('sources.iea'));
    if (this.lngVulnerability) footerParts.push('JODI Gas');

    const latestWeek = this.crudeWeeks[0] ?? null;
    const wowChange = latestWeek?.weeklyChangeMb ?? null;
    const wowSign = wowChange !== null && wowChange > 0 ? '+' : '';
    const wowClass = wowChange === null ? '' : wowChange > 0 ? 'change-negative' : 'change-positive';
    const crudeSparklineValues = this.crudeWeeks.slice().reverse().map(w => w.stocksMb);

    // US nat gas storage
    const latestNg = this.natGasWeeks[0] ?? null;
    const ngChange = latestNg?.weeklyChangeBcf ?? null;
    const ngSign = ngChange !== null && ngChange > 0 ? '+' : '';
    const ngClass = ngChange === null ? '' : ngChange > 0 ? 'change-negative' : 'change-positive';
    const ngSparklineValues = this.natGasWeeks.slice().reverse().map(w => w.storBcf);

    // EU gas storage
    const euFillPct = this.euGas?.fillPct ?? null;
    const euChange1d = this.euGas?.fillPctChange1d ?? null;
    const euSign = euChange1d !== null && euChange1d > 0 ? '+' : '';
    const euClass = euChange1d === null ? '' : euChange1d > 0 ? 'change-positive' : 'change-negative';
    const euTrend = this.euGas?.trend ?? '';
    const euSparklineValues = (this.euGas?.history ?? []).slice().reverse().map(h => h.fillPct);

    this.setSafeContent(unsafeRawHtml(`
      <div class="energy-complex-content">
        ${metrics.length > 0 ? `
          <div class="energy-summary-grid">
            ${metrics.map((metric) => {
              if (!metric) return '';
              const trendColor = getTrendColor(metric.trend, metric.name.includes('Production'));
              const change = `${metric.changePct > 0 ? '+' : ''}${metric.changePct.toFixed(1)}%`;
              return `
                <div class="energy-summary-card">
                  <div class="energy-summary-head">
                    <span class="energy-summary-name">${escapeHtml(mapped(METRIC_NAME_KEYS, metric.id, metric.name))}</span>
                    <span class="energy-summary-trend" style="color:${escapeHtml(trendColor)}">${escapeHtml(getTrendIndicator(metric.trend))}</span>
                  </div>
                  <div class="energy-summary-value">${escapeHtml(formatOilValue(metric.current, metric.unit))} <span class="energy-unit">${escapeHtml(mapped(UNIT_KEYS, metric.unit))}</span></div>
                  <div class="energy-summary-change" style="color:${escapeHtml(trendColor)}">${escapeHtml(change)}</div>
                  <div class="indicator-date">${escapeHtml(metric.lastUpdated.slice(0, 10))}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        ${this.crudeWeeks.length > 0 ? `
          <div class="energy-tape-section" style="margin-top:8px">
            <div class="energy-section-title">${escapeHtml(ec('crude.title'))}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
              ${miniSparkline(crudeSparklineValues, wowChange, 80, 22)}
              <div>
                <span class="commodity-price">${escapeHtml(latestWeek ? latestWeek.stocksMb.toFixed(1) : '—')} Mb</span>
                ${wowChange !== null ? `<span class="commodity-change ${escapeHtml(wowClass)}" style="margin-left:6px">${escapeHtml(ec('wow', { value: wowSign + wowChange.toFixed(1) }))}</span>` : ''}
              </div>
            </div>
            <div class="indicator-date" style="margin-top:2px">${escapeHtml(latestWeek?.period ?? '')}</div>
          </div>
        ` : ''}
        ${this.natGasWeeks.length > 0 ? `
          <div class="energy-tape-section" style="margin-top:8px">
            <div class="energy-section-title">${escapeHtml(ec('natGas.title'))}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
              ${miniSparkline(ngSparklineValues, ngChange, 80, 22)}
              <div>
                <span class="commodity-price">${escapeHtml(latestNg ? latestNg.storBcf.toFixed(0) : '—')} ${escapeHtml(ec('natGas.unit'))}</span>
                ${ngChange !== null ? `<span class="commodity-change ${escapeHtml(ngClass)}" style="margin-left:6px">${escapeHtml(ec('wow', { value: ngSign + ngChange.toFixed(0) }))}</span>` : ''}
              </div>
            </div>
            <div class="indicator-date" style="margin-top:2px">${escapeHtml(latestNg?.period ?? '')}</div>
          </div>
        ` : ''}
        ${euFillPct !== null ? `
          <div class="energy-tape-section" style="margin-top:8px">
            <div class="energy-section-title">${escapeHtml(ec('euGas.title'))}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
              ${miniSparkline(euSparklineValues, euChange1d, 80, 22)}
              <div>
                <span class="commodity-price">${escapeHtml(euFillPct.toFixed(1))}%</span>
                ${euChange1d !== null ? `<span class="commodity-change ${escapeHtml(euClass)}" style="margin-left:6px">${escapeHtml(ec('euGas.change1d', { value: euSign + euChange1d.toFixed(2) }))}</span>` : ''}
                ${euTrend ? `<span style="margin-left:6px;font-size:calc(10px * var(--wm-panel-effective-scale, 1));color:var(--text-dim)">${escapeHtml(mapped(EU_TREND_KEYS, euTrend))}</span>` : ''}
              </div>
            </div>
            <div class="indicator-date" style="margin-top:2px">${escapeHtml(this.euGas?.updatedAt ?? '')}</div>
          </div>
        ` : ''}
        ${this.tape.length > 0 ? `
          <div class="energy-tape-section">
            <div class="energy-section-title">${t('components.energyComplex.liveTape')}</div>
            <div class="commodities-grid energy-tape-grid">
              ${this.tape.map((item) => `
                <div class="commodity-item energy-tape-card">
                  <div class="commodity-name">${escapeHtml(mapped(TAPE_LABEL_KEYS, item.symbol, item.display))}</div>
                  ${miniSparkline(item.sparkline, item.change, 60, 18)}
                  <div class="commodity-price">${formatPrice(item.price!)}</div>
                  <div class="commodity-change ${getChangeClass(item.change ?? 0)}">${formatChange(item.change ?? 0)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${this.renderOilStocksSection()}
        ${this.renderLngVulnerabilitySection()}
      </div>
      <div class="economic-footer">
        <span class="economic-source">${escapeHtml(footerParts.join(' • '))}</span>
      </div>
    `, 'legacy Panel.setContent() migration'));
  }
}

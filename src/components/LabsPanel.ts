import { Panel } from './Panel';
import { escapeHtml, sanitizeUrl, unsafeRawHtml } from '@/utils/sanitize';

// Headline results of the finance labs, served next to the labs hub so the
// figures can be refreshed without rebuilding the dashboard.
const LABS_DATA_URL = '/labs/labs.json';
const FETCH_TIMEOUT_MS = 5_000;
const RETRY_SECONDS = 300;

interface LabMetric {
  label: string;
  value: string;
}

interface LabEntry {
  tag: string;
  question: string;
  answer: string;
  asOf: string;
  metrics: LabMetric[];
  report: string;
  source: string;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function parseMetric(raw: unknown): LabMetric | null {
  if (!raw || typeof raw !== 'object') return null;
  const { label, value } = raw as Record<string, unknown>;
  return isString(label) && isString(value) ? { label, value } : null;
}

function parseLab(raw: unknown): LabEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (![r.tag, r.question, r.answer, r.asOf, r.report, r.source].every(isString)) return null;
  if (!Array.isArray(r.metrics)) return null;
  const metrics = r.metrics.map(parseMetric).filter((m): m is LabMetric => m !== null);
  return {
    tag: r.tag as string,
    question: r.question as string,
    answer: r.answer as string,
    asOf: r.asOf as string,
    metrics,
    report: r.report as string,
    source: r.source as string,
  };
}

export function parseLabs(raw: unknown): LabEntry[] {
  const labs = (raw as { labs?: unknown } | null)?.labs;
  if (!Array.isArray(labs)) return [];
  return labs.map(parseLab).filter((lab): lab is LabEntry => lab !== null);
}

function renderLab(lab: LabEntry): string {
  const metrics = lab.metrics.map((m) => `
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:calc(11px * var(--wm-panel-effective-scale, 1))">
      <span style="color:var(--text-dim)">${escapeHtml(m.label)}</span>
      <span style="font-weight:600;font-variant-numeric:tabular-nums;text-align:right">${escapeHtml(m.value)}</span>
    </div>`).join('');
  return `
    <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="display:flex;justify-content:space-between;font-size:calc(9px * var(--wm-panel-effective-scale, 1));color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">
        <span>${escapeHtml(lab.tag)}</span><span>${escapeHtml(lab.asOf)}</span>
      </div>
      <div style="font-size:calc(12px * var(--wm-panel-effective-scale, 1));font-weight:600;margin:3px 0">${escapeHtml(lab.question)}</div>
      <div style="font-size:calc(11px * var(--wm-panel-effective-scale, 1));color:var(--text-dim);margin-bottom:6px">${escapeHtml(lab.answer)}</div>
      ${metrics}
      <div style="display:flex;gap:12px;margin-top:6px;font-size:calc(10px * var(--wm-panel-effective-scale, 1))">
        <a href="${sanitizeUrl(lab.report)}" target="_blank" rel="noopener">Report</a>
        <a href="${sanitizeUrl(lab.source)}" target="_blank" rel="noopener">Source</a>
      </div>
    </div>`;
}

export class LabsPanel extends Panel {
  constructor() {
    super({
      id: 'finance-labs',
      title: 'Finance Labs',
      showCount: false,
      infoTooltip: 'Headline results of six reproducible quantitative finance studies by Emilien Sabathier: term premium, implied growth, default scores, allocation rules and implied volatility.',
    });
    void this.fetchData();
  }

  public async fetchData(): Promise<boolean> {
    try {
      const resp = await fetch(LABS_DATA_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const labs = parseLabs(await resp.json());
      if (labs.length === 0) throw new Error('no labs in payload');
      this.setSafeContent(unsafeRawHtml(
        `<div style="padding:4px 14px 10px">${labs.map(renderLab).join('')}</div>`,
        'escaped lab entries',
      ));
      return true;
    } catch (error) {
      console.warn('[LabsPanel] failed to load labs data', error);
      this.showError('Labs data unavailable', () => { void this.fetchData(); }, RETRY_SECONDS);
      return false;
    }
  }
}

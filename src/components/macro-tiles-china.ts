import { formatChinaSignalText } from './china-signal-labels';
import type {
  ChinaMacroIndicator,
  GetChinaMacroSnapshotResponse,
} from '@/generated/client/worldmonitor/economic/v1/service_client';
import { escapeHtml } from '@/utils/sanitize';
import {
  CHINA_MACRO_REQUIRED_SERIES,
  CHINA_MACRO_SCHEMA_VERSION,
} from '../../shared/china-macro-contract.js';
import {
  normalizeChinaMacroObservations,
  normalizeChinaMacroPreflight,
  normalizeChinaMacroSourceDecision,
  normalizeChinaReleaseEvent,
  recomputeChinaMacroPillars,
  validateChinaMacroAvailabilityBindings,
} from '../../shared/china-macro-normalization';

/**
 * Translator injected by MacroTilesPanel (wraps `t()` from '@/services/i18n').
 * This module stays free of the i18n service so it can be imported by
 * node:test suites; the default renders the English fallback.
 */
export type ChinaTileTranslator = (
  key: string,
  fallback: string,
  params?: Record<string, string>,
) => string;

const englishTranslator: ChinaTileTranslator = (_key, fallback, params) => (
  params ? fallback.replace(/\{\{(\w+)\}\}/g, (match, name: string) => params[name] ?? match) : fallback
);

const K = 'components.macroTiles.china';

// Indicator units as published by the contract (e.g. "CNY 100 million").
const CHINA_UNIT_LABELS: Record<string, [string, string]> = {
  'USD 100 million': ['usd100m', 'USD 100 million'],
  'CNY 100 million': ['cny100m', 'CNY 100 million'],
  'USD million': ['usdMillion', 'USD million'],
  'CNY million': ['cnyMillion', 'CNY million'],
};

function chinaUnitLabel(unit: string, tr: ChinaTileTranslator): string {
  const entry = CHINA_UNIT_LABELS[unit];
  return entry ? tr(`${K}.units.${entry[0]}`, entry[1]) : unit;
}

function chinaValueFmt(indicator: ChinaMacroIndicator, value: number, tr: ChinaTileTranslator, locale?: string): string {
  if (indicator.unit === '%') return `${value.toFixed(1)}%`;
  if (indicator.unit === 'index') return value.toFixed(2);
  if (indicator.unit.includes('per')) return value.toFixed(4);
  return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}${indicator.unit ? ` ${chinaUnitLabel(indicator.unit, tr)}` : ''}`;
}

// State code → [i18n key under components.macroTiles.china.states, English fallback]
const CHINA_STATE_LABELS: Record<string, [string, string]> = {
  LIVE: ['live', 'Live'],
  STALE: ['stale', 'Stale'],
  UNAVAILABLE: ['unavailable', 'Unavailable'],
  strengthening: ['strengthening', 'Strengthening'],
  weakening: ['weakening', 'Weakening'],
  unchanged: ['unchanged', 'Unchanged'],
  ROBOTS_DISALLOW: ['sourceBlocked', 'Source blocked'],
  TLS_CERTIFICATE_ERROR: ['sourceUnavailable', 'Source unavailable'],
  HTTP_429: ['rateLimited', 'Rate limited'],
  HTTP_503: ['sourceUnavailable', 'Source unavailable'],
  SCHEMA_DRIFT: ['schemaMismatch', 'Schema mismatch'],
  STALE_OBSERVATION: ['observationStale', 'Observation stale'],
  TRANSPORT_STALE: ['transportStale', 'Transport stale'],
  TRANSPORT_RECOVERING: ['transportRecovering', 'Transport recovering'],
  TRANSPORT_MISSING: ['transportUnavailable', 'Transport unavailable'],
};

function chinaStateLabel(state: string, tr: ChinaTileTranslator): string {
  const entry = CHINA_STATE_LABELS[state];
  if (entry) return tr(`${K}.states.${entry[0]}`, entry[1]);
  return state.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CHINA_PERIOD_KIND_LABELS: Record<string, [string, string]> = {
  month: ['month', 'month'],
  quarter: ['quarter', 'quarter'],
  year: ['year', 'year'],
  cumulative_year: ['cumulativeYear', 'cumulative year'],
  point_in_time: ['pointInTime', 'point in time'],
};

function chinaPeriodKindLabel(kind: string, tr: ChinaTileTranslator): string {
  if (!kind) return tr(`${K}.periodUnknown`, 'period unknown');
  const entry = CHINA_PERIOD_KIND_LABELS[kind];
  return entry ? tr(`${K}.periodKinds.${entry[0]}`, entry[1]) : kind.replace(/_/g, ' ');
}

const CHINA_REVISION_LABELS: Record<string, [string, string]> = {
  original: ['original', 'original'],
  preliminary: ['preliminary', 'preliminary'],
  revised: ['revised', 'revised'],
  corrected: ['corrected', 'corrected'],
  cancelled: ['cancelled', 'cancelled'],
  final: ['final', 'final'],
};

function chinaRevisionLabel(revision: string, tr: ChinaTileTranslator): string {
  if (!revision) return tr(`${K}.revisionUnavailable`, 'Revision state unavailable');
  const entry = CHINA_REVISION_LABELS[revision];
  return entry ? tr(`${K}.revisions.${entry[0]}`, entry[1]) : revision.replace(/_/g, ' ');
}

const CHINA_RELEASE_STATUS_LABELS: Record<string, [string, string]> = {
  known: ['known', 'known'],
  scheduled: ['scheduled', 'scheduled'],
  confirmed: ['confirmed', 'confirmed'],
  provisional: ['provisional', 'provisional'],
  tentative: ['tentative', 'tentative'],
  released: ['released', 'released'],
  published: ['released', 'released'],
  delayed: ['delayed', 'delayed'],
  cancelled: ['cancelled', 'cancelled'],
};

export function chinaReleaseStatusLabel(status: string, tr: ChinaTileTranslator = englishTranslator): string {
  const entry = CHINA_RELEASE_STATUS_LABELS[status];
  return entry ? tr(`${K}.releaseStatuses.${entry[0]}`, entry[1]) : status;
}

function chinaStateTone(
  state: string,
  available: boolean,
  stale: boolean,
): 'positive' | 'warning' | 'negative' | 'neutral' {
  if (stale || state === 'STALE_OBSERVATION' || state === 'TRANSPORT_STALE') return 'warning';
  if (!available || state === 'UNAVAILABLE' || state === 'ROBOTS_DISALLOW' || state === 'TLS_CERTIFICATE_ERROR') return 'negative';
  if (state === 'weakening' || state === 'HTTP_429' || state === 'HTTP_503' || state === 'SCHEMA_DRIFT') return 'negative';
  if (state === 'TRANSPORT_RECOVERING' || state === 'TRANSPORT_MISSING') return 'warning';
  if (state === 'unchanged') return 'neutral';
  return 'positive';
}

export function chinaTileHtml(
  indicator: ChinaMacroIndicator,
  tr: ChinaTileTranslator = englishTranslator,
  locale?: string,
): string {
  const available = indicator.hasValue && Number.isFinite(indicator.value);
  const value = available
    ? escapeHtml(chinaValueFmt(indicator, indicator.value, tr, locale))
    : escapeHtml(tr('components.macroTiles.notAvailable', 'N/A'));
  const transportProblem = indicator.transportStatus
    && indicator.transportStatus !== 'fresh'
    ? `TRANSPORT_${indicator.transportStatus.toUpperCase()}`
    : '';
  const direction = indicator.direction && indicator.direction !== 'unavailable'
    ? indicator.direction
    : '';
  const state = indicator.stale
    ? 'STALE'
    : (
      indicator.unavailableReason
      || indicator.transportFailureReason
      || transportProblem
      || direction
      || (available ? 'LIVE' : 'UNAVAILABLE')
    );
  const observed = indicator.observationPeriod || tr(`${K}.noObservationPeriod`, 'No observation period');
  const released = indicator.releaseTime || tr(`${K}.releaseTimeUnavailable`, 'Release time unavailable');
  const revision = chinaRevisionLabel(indicator.revisionState, tr);
  const source = indicator.source || tr(`${K}.sourceUnavailable`, 'Source unavailable');
  const stateLabel = chinaStateLabel(state, tr);
  const stateTone = chinaStateTone(state, available, indicator.stale);
  const valueClass = available ? '' : ' macro-summary-value--unavailable';

  return `<div class="macro-summary-card">
    <div class="macro-summary-head">
      <span class="indicator-name">${escapeHtml(formatChinaSignalText(indicator.label))}</span>
      <span class="macro-summary-state macro-summary-state--${stateTone}" data-state="${escapeHtml(state)}">${escapeHtml(stateLabel)}</span>
    </div>
    <div class="macro-summary-value${valueClass}">${value}</div>
    <div class="macro-summary-meta">
      <span>${escapeHtml(tr(`${K}.period`, 'Period {{period}}', { period: observed }))} · ${escapeHtml(chinaPeriodKindLabel(indicator.periodKind, tr))}</span>
      <span>${escapeHtml(tr(`${K}.released`, 'Released {{time}}', { time: released }))} · ${escapeHtml(revision)}</span>
    </div>
    <div class="macro-summary-source">${escapeHtml(tr(`${K}.source`, 'Source: {{source}}', { source }))}</div>
  </div>`;
}

export function normalizeHydratedChina(
  macro: unknown,
  calendar: unknown,
  now = Date.now(),
): GetChinaMacroSnapshotResponse | null {
  if (!macro || typeof macro !== 'object') return null;
  const raw = macro as Record<string, unknown>;
  if (raw.schemaVersion !== CHINA_MACRO_SCHEMA_VERSION || raw.countryCode !== 'CN') return null;
  const rawObservations = Array.isArray(raw.observations) ? raw.observations : [];
  const generatedAt = String(raw.generatedAt ?? '');
  const indicators = normalizeChinaMacroObservations(rawObservations, now, generatedAt);
  if (indicators === null) return null;
  const macroDecisions = normalizeChinaMacroPreflight(
    Array.isArray(raw.sourceDecisions) ? raw.sourceDecisions : [],
    generatedAt,
    now,
  );
  if (macroDecisions === null) return null;
  if (!validateChinaMacroAvailabilityBindings(rawObservations, macroDecisions)) return null;
  const calendarRecord = calendar && typeof calendar === 'object'
    ? calendar as Record<string, unknown>
    : {};
  const releaseEvents = Array.isArray(calendarRecord.events)
    ? calendarRecord.events.map(normalizeChinaReleaseEvent)
    : [];

  const launchReady = raw.launchReady === true && CHINA_MACRO_REQUIRED_SERIES.every((seriesId) => (
    indicators.some((indicator) => (
      indicator.id === seriesId
      && indicator.hasValue
      && !indicator.stale
      && !indicator.unavailableReason
      && indicator.transportStatus === 'fresh'
    ))
  ));
  const degraded = indicators.some((indicator) => (
    !indicator.hasValue
    || indicator.stale
    || indicator.unavailableReason !== ''
    || indicator.transportStatus !== 'fresh'
  ))
    || macroDecisions.some((decision) => decision.status !== 'accepted')
    || releaseEvents.length === 0;
  const requiredPeriods = CHINA_MACRO_REQUIRED_SERIES.map((seriesId) => (
    indicators.find((indicator) => indicator.id === seriesId)?.observationPeriod ?? ''
  )).filter(Boolean).sort();
  return {
    countryCode: 'CN',
    generatedAt,
    status: launchReady && !degraded ? 'ready' : 'degraded',
    launchReady,
    contentObservationDate: requiredPeriods[0] ?? '',
    latestObservationDate: requiredPeriods[requiredPeriods.length - 1] ?? '',
    indicators,
    sourceDecisions: [
      ...macroDecisions,
      ...(Array.isArray(calendarRecord.sourceDecisions)
        ? calendarRecord.sourceDecisions.map(normalizeChinaMacroSourceDecision)
        : []),
    ],
    releaseEvents,
    unavailable: false,
    schemaVersion: CHINA_MACRO_SCHEMA_VERSION,
    pillars: recomputeChinaMacroPillars(indicators),
  };
}

export function isChinaLaunchReady(snapshot: GetChinaMacroSnapshotResponse | null): boolean {
  if (snapshot?.launchReady !== true || snapshot.unavailable) return false;
  return snapshot.schemaVersion === CHINA_MACRO_SCHEMA_VERSION
    && CHINA_MACRO_REQUIRED_SERIES.every((seriesId) => snapshot.indicators.some((indicator) => (
      indicator.id === seriesId
      && indicator.hasValue
      && Number.isFinite(indicator.value)
      && !indicator.stale
      && !indicator.unavailableReason
      && indicator.transportStatus === 'fresh'
    )));
}

export function hasChinaMacroData(snapshot: GetChinaMacroSnapshotResponse | null): boolean {
  return snapshot !== null
    && snapshot.unavailable !== true
    && snapshot.schemaVersion === CHINA_MACRO_SCHEMA_VERSION
    && snapshot.indicators.length > 0;
}

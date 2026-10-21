#!/usr/bin/env node
// Sabathier Terminal GOVT screen: 10-year sovereign yields, spreads and central bank policy rates in
// one payload (economic:rates-board:v1).
//   - France OAT 10Y: Banque de France TEC 10 (daily, needs BANQUE_DE_FRANCE_API_KEY); without the key,
//     or if Webstat fails, the ECB monthly convergence rate.
//   - Germany, Italy, Spain: ECB long-term interest rates for convergence purposes (monthly; the
//     Bundesbank daily curve sits behind a bot challenge).
//   - Euro area AAA 10Y: ECB yield curve (daily). US 10Y and 2Y: the seeded FRED series. UK and Japan
//     10Y: the seeded BoE and MoF curves.
//   - Policy rates: ECB deposit facility (daily) and BIS policy rates for the other central banks.
// Spreads are only computed between observations of the same date (or month).

import { loadEnvFile, CHROME_UA, runSeed, readCanonicalValue } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

export const CANONICAL_KEY = 'economic:rates-board:v1';
const TTL_SECONDS = 3 * 24 * 3600;
const ECB_API = 'https://data-api.ecb.europa.eu/service/data';
const WEBSTAT_OBSERVATIONS = 'https://webstat.banque-france.fr/api/explore/v2.1/catalog/datasets/observations/exports/json';
// Banque de France constant-maturity OAT yields (TEC), one series per tenor.
export const FR_TEC_TENORS = ['1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '25Y', '30Y'];
const tecSeries = (tenor) => `FM.D.FR.EUR.FR2.BB.FRMOYTEC${tenor.replace('Y', '')}.HSTA`;

// ─── Pure helpers (exported for tests) ──────────────────────────────────────────

/** Parses an ECB `format=csvdata` answer into { seriesKey: [{ date, value }] }, dates ascending. */
export function parseEcbCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = splitCsvLine(lines.shift() ?? '');
  const iKey = header.indexOf('KEY');
  const iDate = header.indexOf('TIME_PERIOD');
  const iValue = header.indexOf('OBS_VALUE');
  if (iKey < 0 || iDate < 0 || iValue < 0) return {};
  const out = {};
  for (const line of lines) {
    const cells = splitCsvLine(line);
    const value = Number.parseFloat(cells[iValue]);
    if (!cells[iDate] || !Number.isFinite(value)) continue;
    (out[cells[iKey]] ??= []).push({ date: cells[iDate], value });
  }
  for (const obs of Object.values(out)) obs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Webstat (Opendatasoft) records → [{ date, value }] ascending, whatever the period and value field names. */
export function parseWebstatRecords(payload) {
  const out = [];
  // The exports endpoint answers a bare array; the records endpoint wraps it in { results }.
  for (const record of Array.isArray(payload) ? payload : payload?.results ?? []) {
    const dateField = Object.keys(record).find((k) => /^time_period/i.test(k) || /^date/i.test(k));
    const valueField = Object.keys(record).find((k) => /obs_value|^valeur|^value/i.test(k));
    const date = dateField ? String(record[dateField]).slice(0, 10) : null;
    const value = valueField ? Number.parseFloat(record[valueField]) : Number.NaN;
    if (date && Number.isFinite(value)) out.push({ date, value });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Webstat observations of several series → { seriesKey: [{ date, value }] }, dates ascending. */
export function groupWebstatSeries(payload) {
  const out = {};
  for (const record of Array.isArray(payload) ? payload : payload?.results ?? []) {
    const key = record?.series_key;
    if (typeof key !== 'string') continue;
    (out[key] ??= []).push(record);
  }
  for (const key of Object.keys(out)) out[key] = parseWebstatRecords(out[key]);
  return out;
}

/**
 * French curve from the TEC series: every tenor on the latest date they all share, and on the shared
 * date before it. Null when fewer than half the tenors are there.
 */
export function frCurveFrom(byTenor) {
  const tenors = FR_TEC_TENORS.filter((t) => byTenor[t]?.length);
  if (tenors.length < FR_TEC_TENORS.length / 2) return null;
  const dateSets = tenors.map((t) => new Set(byTenor[t].map((o) => o.date)));
  const common = [...dateSets[0]].filter((d) => dateSets.every((set) => set.has(d))).sort();
  const date = common.at(-1);
  if (!date) return null;
  const previousDate = common.length > 1 ? common.at(-2) : null;
  const at = (t, d) => byTenor[t].find((o) => o.date === d)?.value ?? null;
  return {
    date,
    previousDate,
    tenors: tenors.map((t) => ({ tenor: t, value: round(at(t, date)), previous: previousDate ? round(at(t, previousDate)) : null })),
  };
}

/** A board row from an ascending observation list: latest value, the one before it, its date. */
export function rowFrom(id, label, observations, frequency, source) {
  const last = observations?.at(-1);
  if (!last) return null;
  const prev = observations.length > 1 ? observations.at(-2) : null;
  return { id, label, value: round(last.value), previous: prev ? round(prev.value) : null, date: last.date, frequency, source };
}

/**
 * Spread in basis points between two observation lists, on their latest common date, with the change
 * since the common date before it.
 */
export function spreadFrom(id, label, a, b, frequency) {
  if (!a?.length || !b?.length) return null;
  const bByDate = new Map(b.map((o) => [o.date, o.value]));
  const common = a.filter((o) => bByDate.has(o.date));
  const last = common.at(-1);
  if (!last) return null;
  const prev = common.length > 1 ? common.at(-2) : null;
  const bp = (o) => Math.round((o.value - bByDate.get(o.date)) * 100);
  return { id, label, bp: bp(last), previousBp: prev ? bp(prev) : null, date: last.date, frequency };
}

/** 10-year point of a seeded yield-curve payload ({ curves: [{ date, tenors }] }), ascending. */
export function tenYearFromCurves(payload) {
  const curves = unwrap(payload)?.curves ?? [];
  return curves
    .map((c) => ({ date: c.date, value: Number(c.tenors?.['10y'] ?? c.tenors?.['10Y']) }))
    .filter((o) => o.date && Number.isFinite(o.value))
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/** Observations of a seeded FRED series key ({ series: { observations } }). */
export function fredObservations(payload) {
  return (unwrap(payload)?.series?.observations ?? []).filter((o) => o?.date && Number.isFinite(o.value));
}

/** Policy rows from the seeded BIS payload, in the given central-bank order. */
export function policyRowsFromBis(payload, wanted) {
  const rates = unwrap(payload)?.rates ?? [];
  return wanted.map(({ code, label }) => {
    const r = rates.find((x) => x.countryCode === code);
    if (!r || !Number.isFinite(r.rate)) return null;
    return { id: code, label, value: r.rate, previous: Number.isFinite(r.previousRate) ? r.previousRate : null, date: r.date, frequency: 'monthly', source: 'BIS' };
  }).filter(Boolean);
}

function unwrap(v) {
  return v && typeof v === 'object' && v._seed && 'data' in v ? v.data : v;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────────

async function fetchEcb(flowAndKey, lastN) {
  const res = await fetch(`${ECB_API}/${flowAndKey}?lastNObservations=${lastN}&format=csvdata`, {
    headers: { Accept: 'text/csv', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ECB ${flowAndKey}: HTTP ${res.status}`);
  return parseEcbCsv(await res.text());
}

/** The French TEC curve, { tenor: [{ date, value }] }; null without a Banque de France key or on failure. */
async function fetchFrenchTec() {
  const key = process.env.BANQUE_DE_FRANCE_API_KEY;
  if (!key) return null;
  try {
    const since = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const keys = FR_TEC_TENORS.map((t) => `"${tecSeries(t)}"`).join(',');
    const query = new URLSearchParams({
      select: 'series_key,time_period_start,obs_value',
      where: `series_key in (${keys}) and time_period_start >= date'${since}'`,
      order_by: 'time_period_start desc',
    });
    const res = await fetch(`${WEBSTAT_OBSERVATIONS}?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Apikey ${key}`, 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bySeries = groupWebstatSeries(await res.json());
    const byTenor = Object.fromEntries(FR_TEC_TENORS.map((t) => [t, bySeries[tecSeries(t)] ?? []]));
    if (!byTenor['10Y'].length) throw new Error('no TEC 10 observations');
    return byTenor;
  } catch (err) {
    console.warn(`  Banque de France TEC unavailable (${err.message}); falling back to the ECB monthly rate`);
    return null;
  }
}

async function readSeeded(key) {
  try {
    return await readCanonicalValue(key);
  } catch {
    return null;
  }
}

const POLICY_BANKS = [
  { code: 'US', label: 'Fed' },
  { code: 'GB', label: 'BoE' },
  { code: 'JP', label: 'BoJ' },
  { code: 'CH', label: 'BNS' },
  { code: 'CA', label: 'BoC' },
];

export async function fetchRatesBoard() {
  const irsKey = (cc) => `IRS.M.${cc}.L.L40.CI.0000.EUR.N.Z`;
  const [irs, aaa, dfr, frTec, dgs10, dgs2, gbCurve, jpCurve, bis] = await Promise.all([
    fetchEcb('IRS/M.FR+DE+IT+ES.L.L40.CI.0000.EUR.N.Z', 3),
    fetchEcb('YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y', 30),
    fetchEcb('FM/D.U2.EUR.4F.KR.DFR.LEV', 400),
    fetchFrenchTec(),
    readSeeded('economic:fred:v1:DGS10:0'),
    readSeeded('economic:fred:v1:DGS2:0'),
    readSeeded(`economic:yield-curve:gb:v1:${new Date().getUTCFullYear()}`),
    readSeeded(`economic:yield-curve:jp:v1:${new Date().getUTCFullYear()}`),
    readSeeded('economic:bis:policy:v1'),
  ]);

  const aaa10 = aaa['YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y'] ?? [];
  const us10 = fredObservations(dgs10);
  const us2 = fredObservations(dgs2);
  const oatDaily = frTec?.['10Y'] ?? null;
  const oat = oatDaily
    ? rowFrom('FR', 'OAT', oatDaily, 'daily', 'Banque de France')
    : rowFrom('FR', 'OAT', irs[irsKey('FR')], 'monthly', 'ECB');

  const sovereign = [
    oat,
    rowFrom('DE', 'Bund', irs[irsKey('DE')], 'monthly', 'ECB'),
    rowFrom('IT', 'BTP', irs[irsKey('IT')], 'monthly', 'ECB'),
    rowFrom('ES', 'Bonos', irs[irsKey('ES')], 'monthly', 'ECB'),
    rowFrom('EA', 'AAA', aaa10, 'daily', 'ECB'),
    rowFrom('US', 'T-Note', us10, 'daily', 'FRED'),
    rowFrom('GB', 'Gilt', tenYearFromCurves(gbCurve), 'daily', 'BoE'),
    rowFrom('JP', 'JGB', tenYearFromCurves(jpCurve), 'daily', 'MoF'),
  ].filter(Boolean);

  const spreads = [
    oatDaily
      ? spreadFrom('oat-aaa', 'OAT - AAA', oatDaily, aaa10, 'daily')
      : null,
    spreadFrom('oat-bund', 'OAT - Bund', irs[irsKey('FR')], irs[irsKey('DE')], 'monthly'),
    spreadFrom('btp-bund', 'BTP - Bund', irs[irsKey('IT')], irs[irsKey('DE')], 'monthly'),
    spreadFrom('us-2s10s', 'US 10Y - 2Y', us10, us2, 'daily'),
  ].filter(Boolean);

  // The deposit rate moves a few times a year: the "previous" value is the last different one.
  const dfrObs = dfr['FM.D.U2.EUR.4F.KR.DFR.LEV'] ?? [];
  const dfrLast = dfrObs.at(-1);
  const dfrPrev = dfrLast ? [...dfrObs].reverse().find((o) => o.value !== dfrLast.value) : null;
  const policy = [
    dfrLast ? { id: 'EA', label: 'BCE', value: dfrLast.value, previous: dfrPrev?.value ?? null, date: dfrLast.date, frequency: 'daily', source: 'ECB' } : null,
    ...policyRowsFromBis(bis, POLICY_BANKS),
  ].filter(Boolean);

  return { sovereign, spreads, policy, frCurve: frTec ? frCurveFrom(frTec) : null, updatedAt: new Date().toISOString() };
}

export function declareRecords(data) {
  return (data?.sovereign?.length ?? 0) + (data?.policy?.length ?? 0);
}

if (process.argv[1]?.endsWith('seed-rates-board.mjs')) {
  await runSeed('economic', 'rates-board', CANONICAL_KEY, fetchRatesBoard, {
    ttlSeconds: TTL_SECONDS,
    validateFn: (data) => (data?.sovereign?.length ?? 0) >= 4 && (data?.policy?.length ?? 0) >= 1,
    recordCount: declareRecords,
    declareRecords,
    sourceVersion: 'rates-board-v1',
    schemaVersion: 1,
    maxStaleMin: 2 * 24 * 60,
  });
}

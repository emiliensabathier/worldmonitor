import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEcbCsv,
  parseWebstatRecords,
  policyRowsFromBis,
  rowFrom,
  spreadFrom,
  tenYearFromCurves,
} from '../scripts/seed-rates-board.mjs';

describe('seed-rates-board', () => {
  it('parses ECB csvdata per series, dates ascending', () => {
    const csv = [
      'KEY,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE',
      'IRS.M.FR.L.L40.CI.0000.EUR.N.Z,M,FR,2026-09,4.44,A,"France, long-term rate"',
      'IRS.M.FR.L.L40.CI.0000.EUR.N.Z,M,FR,2026-08,4,A,"France, long-term rate"',
      'IRS.M.DE.L.L40.CI.0000.EUR.N.Z,M,DE,2026-09,3.473,A,"Germany, long-term rate"',
      'IRS.M.DE.L.L40.CI.0000.EUR.N.Z,M,DE,2026-10,,A,"no value yet"',
    ].join('\n');
    const out = parseEcbCsv(csv);
    assert.deepEqual(out['IRS.M.FR.L.L40.CI.0000.EUR.N.Z'], [{ date: '2026-08', value: 4 }, { date: '2026-09', value: 4.44 }]);
    assert.deepEqual(out['IRS.M.DE.L.L40.CI.0000.EUR.N.Z'], [{ date: '2026-09', value: 3.473 }]);
  });

  it('reads Webstat records whatever the period and value field names', () => {
    const obs = parseWebstatRecords({ results: [
      { time_period_end: '2026-10-20', obs_value: '3.412' },
      { time_period_end: '2026-10-17T00:00:00+00:00', obs_value: 3.38 },
      { time_period_end: '2026-10-16', obs_value: null },
    ] });
    assert.deepEqual(obs, [{ date: '2026-10-17', value: 3.38 }, { date: '2026-10-20', value: 3.412 }]);
  });

  it('builds a row from the last two observations', () => {
    assert.deepEqual(
      rowFrom('DE', 'Bund', [{ date: '2026-08', value: 3.185 }, { date: '2026-09', value: 3.473 }], 'monthly', 'ECB'),
      { id: 'DE', label: 'Bund', value: 3.473, previous: 3.185, date: '2026-09', frequency: 'monthly', source: 'ECB' },
    );
    assert.equal(rowFrom('DE', 'Bund', [], 'monthly', 'ECB'), null);
  });

  it('computes spreads in bp on common dates only', () => {
    const oat = [{ date: '2026-10-16', value: 3.30 }, { date: '2026-10-17', value: 3.38 }, { date: '2026-10-20', value: 3.41 }];
    const aaa = [{ date: '2026-10-16', value: 2.80 }, { date: '2026-10-17', value: 2.85 }];
    assert.deepEqual(spreadFrom('oat-aaa', 'OAT - AAA', oat, aaa, 'daily'), {
      id: 'oat-aaa', label: 'OAT - AAA', bp: 53, previousBp: 50, date: '2026-10-17', frequency: 'daily',
    });
    assert.equal(spreadFrom('x', 'x', oat, [{ date: '2025-01-01', value: 1 }], 'daily'), null);
  });

  it('takes the 10-year point of seeded curves, enveloped or not', () => {
    const curves = { curves: [{ date: '2026-10-20', tenors: { '2y': 4.7, '10y': 5.384 } }, { date: '2026-10-17', tenors: { '10y': 5.414 } }] };
    assert.deepEqual(tenYearFromCurves({ _seed: {}, data: curves }), [{ date: '2026-10-17', value: 5.414 }, { date: '2026-10-20', value: 5.384 }]);
  });

  it('keeps the requested central banks in order, skipping missing ones', () => {
    const bis = { rates: [
      { countryCode: 'GB', rate: 3.75, previousRate: 3.75, date: '2026-09' },
      { countryCode: 'US', rate: 3.875, previousRate: 3.625, date: '2026-09' },
    ] };
    const rows = policyRowsFromBis(bis, [{ code: 'US', label: 'Fed' }, { code: 'XX', label: 'None' }, { code: 'GB', label: 'BoE' }]);
    assert.deepEqual(rows.map((r) => [r.label, r.value, r.previous]), [['Fed', 3.875, 3.625], ['BoE', 3.75, 3.75]]);
  });
});

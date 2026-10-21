/**
 * Sabathier Terminal GOVT screen: the rates board renders the seeded payload (enveloped as the
 * on-demand bootstrap serves it) as three tables, and falls back to the error state without data.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initTestI18n, tt } from './helpers/i18n.mts';

const { mockEnsureHydrated } = vi.hoisted(() => ({ mockEnsureHydrated: vi.fn() }));

vi.mock('@/services/bootstrap', () => ({ ensureHydrated: mockEnsureHydrated }));

const { RatesBoardPanel, changeBp, formatBp, formatObservationDate, toRatesBoard } = await import('@/components/RatesBoardPanel');

/** The shape scripts/seed-rates-board.mjs publishes, in its runSeed envelope. */
const PAYLOAD = {
  _seed: { fetchedAt: 1, recordCount: 4, sourceVersion: 'rates-board-v1', schemaVersion: 1, state: 'OK' },
  data: {
    sovereign: [
      { id: 'FR', label: 'OAT', value: 3.412, previous: 3.38, date: '2026-10-20', frequency: 'daily', source: 'Banque de France' },
      { id: 'DE', label: 'Bund', value: 3.473, previous: 3.185, date: '2026-09', frequency: 'monthly', source: 'ECB' },
    ],
    spreads: [{ id: 'oat-bund', label: 'OAT - Bund', bp: 97, previousBp: 82, date: '2026-09', frequency: 'monthly' }],
    policy: [{ id: 'EA', label: 'BCE', value: 2.5, previous: 2.25, date: '2026-10-21', frequency: 'daily', source: 'ECB' }],
    updatedAt: '2026-10-21T15:00:00.000Z',
  },
};

let panel: InstanceType<typeof RatesBoardPanel>;

async function mount(payload: unknown): Promise<void> {
  mockEnsureHydrated.mockResolvedValue(payload);
  panel = new RatesBoardPanel();
  document.body.appendChild(panel.getElement());
  await panel.fetchData();
  await vi.advanceTimersByTimeAsync(151);
}

const body = (): string => panel.getElement().textContent ?? '';

beforeAll(async () => {
  await initTestI18n();
  expect(tt('panels.ratesBoard')).toBe('Rates & central banks');
});

beforeEach(() => {
  vi.useFakeTimers();
  mockEnsureHydrated.mockReset();
});

afterEach(() => {
  panel?.destroy();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('rates board helpers', () => {
  it('unwraps the seed envelope and rejects anything else', () => {
    expect(toRatesBoard(PAYLOAD)?.sovereign).toHaveLength(2);
    expect(toRatesBoard(PAYLOAD.data)?.policy).toHaveLength(1);
    expect(toRatesBoard({ rates: [] })).toBeNull();
    expect(toRatesBoard(undefined)).toBeNull();
  });

  it('expresses changes in signed basis points', () => {
    expect(changeBp(3.412, 3.38)).toBe(3);
    expect(changeBp(2.5, 2.25)).toBe(25);
    expect(changeBp(2.5, null)).toBeNull();
    expect(formatBp(25)).toBe('+25');
    expect(formatBp(-4)).toBe('-4');
    expect(formatBp(null)).toBe('--');
  });

  it('dates daily observations by day and monthly ones by month', () => {
    expect(formatObservationDate('2026-10-20', 'fr')).toBe('20/10');
    expect(formatObservationDate('2026-09', 'en')).toBe('Sep 2026');
  });
});

describe('RatesBoardPanel', () => {
  it('renders yields, spreads and policy rates with their changes', async () => {
    await mount(PAYLOAD);
    expect(panel.getElement().querySelectorAll('table.fx-table')).toHaveLength(3);
    const text = body();
    expect(text).toContain('OAT');
    expect(text).toContain('3.41%');
    expect(text).toContain('+29');
    expect(text).toContain('OAT - Bund');
    expect(text).toContain('97');
    expect(text).toContain('+15');
    expect(text).toContain('BCE');
    expect(text).toContain('2.50%');
    expect(text).toContain('+25');
    expect(text).toContain('monthly');
    expect(text).toContain('Sources: Banque de France, ECB');
  });

  it('shows the error state when the key is missing', async () => {
    await mount(undefined);
    expect(panel.getElement().querySelector('table')).toBeNull();
    expect(body()).toContain(tt('common.failedMarketData'));
  });
});

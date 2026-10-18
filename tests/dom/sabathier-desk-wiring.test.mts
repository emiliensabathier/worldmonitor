import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.resetModules(); vi.doUnmock('@/config/variant'); vi.doUnmock('@/services/gates/export-resolver'); localStorage.clear(); });

describe('Sabathier desk wiring', () => {
  it('finance builds are never tab-capped', async () => {
    vi.doMock('@/config/variant', async (orig) => ({ ...(await orig<object>()), SITE_VARIANT: 'finance' }));
    const { evaluateTabCap } = await import('@/services/gates/export');
    const verdict = evaluateTabCap({ user: null, isPending: false } as never, 12);
    expect(verdict.allowed).toBe(true);
    expect(verdict.cap).toBeNull();
  });

  it('other variants still go through the upstream resolver', async () => {
    const resolveTabCap = vi.fn(() => ({ allowed: false, cap: 3, pendingActivation: false }));
    vi.doMock('@/services/gates/export-resolver', async (orig) => ({ ...(await orig<object>()), resolveTabCap }));
    const { evaluateTabCap } = await import('@/services/gates/export');
    expect(evaluateTabCap({ user: null, isPending: false } as never, 5)).toEqual({ allowed: false, cap: 3, pendingActivation: false });
    expect(resolveTabCap).toHaveBeenCalledOnce();
  });

  it('clearTabsState forgets the stored tabs', async () => {
    const { saveTabsState, loadTabsState, clearTabsState } = await import('@/services/tab-store');
    saveTabsState({ activeTabId: 'tab-a-b', tabs: [{ id: 'tab-a-b', name: 'x', panelSettings: {}, panelOrder: [], bottomSet: [] }] });
    expect(loadTabsState()).not.toBeNull();
    clearTabsState();
    expect(loadTabsState()).toBeNull();
  });
});

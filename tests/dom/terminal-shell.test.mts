import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalShell, functionFromHash } from '@/app/terminal-shell';

let shell: TerminalShell; let opened: string[];
beforeEach(() => {
  history.replaceState(null, '', '/terminal/');
  opened = [];
  shell = new TerminalShell({ lang: 'fr', onOpen: (c) => opened.push(c), now: () => new Date('2026-10-19T12:00:00Z') });
  document.body.append(shell.getElement());
  shell.start();
});
afterEach(() => { shell.destroy(); document.body.replaceChildren(); vi.restoreAllMocks(); });

const input = () => shell.getElement().querySelector<HTMLInputElement>('.bb-cmd input')!;
const submit = (v: string) => { input().value = v; input().form!.requestSubmit(); };

describe('functionFromHash', () => {
  it('reads codes in any case, falls back to TOP', () => {
    expect(functionFromHash('#govt')).toBe('GOVT');
    expect(functionFromHash('#WEI')).toBe('WEI');
    expect(functionFromHash('#XYZ')).toBe('TOP');
    expect(functionFromHash('')).toBe('TOP');
  });
});

describe('TerminalShell', () => {
  it('renders eight keys with French labels and the prompt', () => {
    const keys = [...shell.getElement().querySelectorAll<HTMLButtonElement>('.bb-key')];
    expect(keys.map((k) => k.dataset.fn)).toEqual(['TOP', 'WEI', 'GOVT', 'FX', 'CMDTY', 'ECO', 'N', 'LABS']);
    expect(keys[2]!.textContent).toContain('Taux');
    expect(input().placeholder).toBe('Tapez un code ou cliquez une touche');
    expect(shell.getElement().querySelector('.bb-clock')!.textContent).toMatch(/PAR 14:00:00.*NY 08:00:00/);
  });
  it('a key click opens the function and writes the address', () => {
    shell.getElement().querySelector<HTMLButtonElement>('.bb-key[data-fn="FX"]')!.click();
    expect(opened).toEqual(['FX']);
    expect(location.hash).toBe('#FX');
    expect(shell.getElement().querySelector('.bb-key[data-fn="FX"]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('typed commands open functions; unknown codes and HELP show the list', () => {
    submit('govt <GO>');
    expect(opened).toEqual(['GOVT']);
    expect(input().value).toBe('');
    submit('xyz');
    const help = shell.getElement().querySelector<HTMLElement>('.bb-help')!;
    expect(help.hidden).toBe(false);
    expect(help.textContent).toContain('Code inconnu : XYZ');
    expect(help.querySelectorAll('button[data-fn]')).toHaveLength(8);
    help.querySelector<HTMLButtonElement>('button[data-fn="ECO"]')!.click();
    expect(opened.at(-1)).toBe('ECO');
    expect(help.hidden).toBe(true);
  });
  it('a letter typed anywhere goes to the command line, never from another field', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe('w');
    const other = document.createElement('input'); document.body.append(other); other.focus();
    other.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    expect(input().value).toBe('w');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(input().value).toBe('w');
  });
  it('never steals Space, keys aimed at buttons or links, or anything typed inside a dialog', () => {
    const key = shell.getElement().querySelector<HTMLButtonElement>('.bb-key[data-fn="GOVT"]')!;
    key.focus();
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    key.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    key.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog');
    const inner = document.createElement('div'); dialog.append(inner); document.body.append(dialog);
    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    expect(input().value).toBe('');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(input().value).toBe('');
  });

  it('Escape clears the line and closes the help', () => {
    submit('?');
    input().value = 'ab';
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input().value).toBe('');
    expect(shell.getElement().querySelector<HTMLElement>('.bb-help')!.hidden).toBe(true);
  });
  it('back/forward (popstate) reopens the function without pushing', () => {
    const push = vi.spyOn(history, 'pushState');
    history.replaceState(null, '', '/terminal/#CMDTY');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(opened.at(-1)).toBe('CMDTY');
    expect(push).not.toHaveBeenCalled();
  });
  it('brings the active key into view', () => {
    const key = shell.getElement().querySelector<HTMLElement>('.bb-key[data-fn="LABS"]')!;
    const spy = vi.fn();
    key.scrollIntoView = spy;
    shell.setActive('LABS');
    expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });
  it('announces unknown codes and ties the help list to the command line', () => {
    submit('xyz');
    const msg = shell.getElement().querySelector('.bb-help-msg')!;
    expect(msg.getAttribute('role')).toBe('status');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().getAttribute('aria-controls')).toBe(shell.getElement().querySelector('.bb-help')!.id);
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });
  it('rewrites a lowercase or unknown address to its canonical code without a new history entry', () => {
    const push = vi.spyOn(history, 'pushState');
    history.replaceState(null, '', '/terminal/#govt');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(location.hash).toBe('#GOVT');
    expect(push).not.toHaveBeenCalled();
  });
  it('popstate and hashchange for the same navigation open the function once', () => {
    history.replaceState(null, '', '/terminal/#FX');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(opened.filter((c) => c === 'FX')).toHaveLength(1);
  });
});

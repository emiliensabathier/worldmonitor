// Sabathier Terminal shell (finance variant): the Bloomberg-style command line, the eight function keys
// and the #CODE address. Opening a function is delegated to `onOpen` (tab switch + grid layout).
import { parseCommand } from '@/app/terminal-command';
import {
  DEFAULT_FUNCTION, TERMINAL_FUNCTIONS, functionLabel, isFunctionCode, type FunctionCode,
} from '@/config/terminal-functions';

export function functionFromHash(hash: string): FunctionCode {
  const code = hash.replace(/^#/, '').trim().toUpperCase();
  return isFunctionCode(code) ? code : DEFAULT_FUNCTION;
}

const TEXT = {
  en: { prompt: 'Type a code or click a key', unknown: 'Unknown code: ', keys: 'Functions' },
  fr: { prompt: 'Tapez un code ou cliquez une touche', unknown: 'Code inconnu : ', keys: 'Fonctions' },
};

function clockPart(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}

// Keys typed on a control (Space/Enter activate it, letters may drive it) or inside a dialog belong there.
const KEEP = 'input, textarea, select, button, a[href], summary, [role="button"], [role="link"], [role="menuitem"], '
  + '[role="tab"], [role="option"], [role="checkbox"], [role="slider"], [contenteditable], [contenteditable] *, '
  + '[role="dialog"] *, [aria-modal="true"] *';
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches(KEEP);
}

export class TerminalShell {
  private readonly el: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly help: HTMLElement;
  private readonly helpMsg: HTMLElement;
  private readonly live: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly clockPar: HTMLElement;
  private readonly clockNy: HTMLElement;
  private readonly keys = new Map<FunctionCode, HTMLButtonElement>();
  private readonly text: typeof TEXT.en;
  private readonly now: () => Date;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active: FunctionCode | null = null;

  private readonly onKeydown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === ' ') return;
    if (isEditable(e.target)) return;
    e.preventDefault();
    this.input.focus();
    this.input.value += e.key;
  };
  // Back/forward fire popstate and hashchange together: act once, and keep the address canonical (#GOVT).
  private readonly onLocation = () => {
    // In-page anchors (the skip link's #main…) are not function addresses: leave them alone.
    const raw = location.hash.replace(/^#/, '').trim().toUpperCase();
    if (raw && !isFunctionCode(raw)) return;
    const code = functionFromHash(location.hash);
    if (location.hash !== `#${code}`) history.replaceState(history.state, '', `#${code}`);
    if (code !== this.active) this.open(code, false);
  };

  constructor(private readonly opts: { lang: string; onOpen: (code: FunctionCode) => void; now?: () => Date }) {
    const lang = opts.lang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    this.text = TEXT[lang];
    this.now = opts.now ?? (() => new Date());

    this.el = document.createElement('section');
    this.el.className = 'bb-shell';

    const form = document.createElement('form');
    form.className = 'bb-cmd';
    form.setAttribute('role', 'search');
    const prompt = document.createElement('span');
    prompt.className = 'bb-prompt';
    prompt.textContent = '>';
    prompt.setAttribute('aria-hidden', 'true');
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.placeholder = this.text.prompt;
    this.input.setAttribute('aria-label', this.text.prompt);
    this.input.setAttribute('aria-controls', 'bb-help');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.input.value = ''; this.hideHelp(); }
    });
    this.clock = document.createElement('span');
    this.clock.className = 'bb-clock';
    this.clock.setAttribute('translate', 'no');
    this.clockPar = document.createElement('span');
    this.clockPar.className = 'bb-clock-par';
    this.clockNy = document.createElement('span');
    this.clockNy.className = 'bb-clock-ny';
    this.clock.append(this.clockPar, this.clockNy);
    form.append(prompt, this.input, this.clock);
    form.addEventListener('submit', (e) => { e.preventDefault(); this.run(this.input.value); });

    this.help = document.createElement('div');
    this.help.className = 'bb-help';
    this.help.id = 'bb-help';
    this.help.hidden = true;
    this.helpMsg = document.createElement('p');
    this.helpMsg.className = 'bb-help-msg';
    // Announced through a live region that is always rendered (a region revealed already filled is not read).
    this.live = document.createElement('span');
    this.live.className = 'bb-sr-status';
    this.live.setAttribute('role', 'status');
    const list = document.createElement('div');
    list.className = 'bb-help-list';
    for (const fn of TERMINAL_FUNCTIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.fn = fn.code;
      const code = document.createElement('b');
      code.textContent = fn.code;
      b.append(code, ` ${functionLabel(fn, lang)}`);
      b.addEventListener('click', () => { this.hideHelp(); this.input.value = ''; this.open(fn.code); });
      list.append(b);
    }
    this.help.append(this.helpMsg, list);

    const nav = document.createElement('nav');
    nav.className = 'bb-keys';
    nav.setAttribute('aria-label', this.text.keys);
    for (const fn of TERMINAL_FUNCTIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bb-key';
      b.dataset.fn = fn.code;
      b.setAttribute('aria-pressed', 'false');
      const code = document.createElement('b');
      code.textContent = fn.code;
      const label = document.createElement('small');
      label.textContent = functionLabel(fn, lang);
      b.append(code, label);
      b.addEventListener('click', () => this.open(fn.code));
      this.keys.set(fn.code, b);
      nav.append(b);
    }

    this.el.append(form, this.help, nav, this.live);
    this.tick();
  }

  getElement(): HTMLElement { return this.el; }

  open(code: FunctionCode, push = true): void {
    if (push && location.hash !== `#${code}`) history.pushState(null, '', `#${code}`);
    this.setActive(code);
    this.opts.onOpen(code);
  }

  setActive(code: FunctionCode): void {
    this.active = code;
    for (const [c, key] of this.keys) key.setAttribute('aria-pressed', String(c === code));
    // Phones scroll the key row: keep the active key in view.
    this.keys.get(code)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }

  start(): void {
    document.addEventListener('keydown', this.onKeydown);
    window.addEventListener('popstate', this.onLocation);
    window.addEventListener('hashchange', this.onLocation);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeydown);
    window.removeEventListener('popstate', this.onLocation);
    window.removeEventListener('hashchange', this.onLocation);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private run(value: string): void {
    const cmd = parseCommand(value);
    if (cmd.kind === 'empty') return;
    if (cmd.kind === 'open') {
      this.input.value = '';
      this.hideHelp();
      this.open(cmd.code);
      return;
    }
    this.helpMsg.textContent = cmd.kind === 'unknown' ? this.text.unknown + cmd.input : '';
    // Clear, then write on the next tick, so a repeated identical message is announced again.
    const message = this.helpMsg.textContent;
    this.live.textContent = '';
    if (message) setTimeout(() => { this.live.textContent = message; }, 0);
    this.helpMsg.hidden = cmd.kind !== 'unknown';
    this.help.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  private hideHelp(): void {
    this.help.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
  }

  private tick(): void {
    const d = this.now();
    this.clockPar.textContent = `PAR ${clockPart(d, 'Europe/Paris')}`;
    this.clockNy.textContent = ` · NY ${clockPart(d, 'America/New_York')}`;
  }
}

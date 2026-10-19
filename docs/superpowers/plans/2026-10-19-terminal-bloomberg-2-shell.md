# Terminal Bloomberg — sous-projet 2 : shell des fonctions (ordinateur) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer, sur ordinateur, la barre d'outils, les onglets et la grille libre par une ligne de commande, 8 touches de fonction, un bandeau de cotes défilant, des écrans figés par fonction et une barre d'état.

**Architecture :** les 8 fonctions sont stockées comme 8 « onglets » du mécanisme existant (`tab-store`, `applyWebMcpTabAction`).
Celui-ci sait déjà activer un jeu de panneaux, monter les panneaux différés et enregistrer l'état. Leur barre d'onglets est
masquée. Un shell (`terminal-shell.ts`) gère la ligne de commande, les touches et l'adresse `#CODE`. La mise en page devient une grille CSS
posée sur `<main>` (`grid-template-areas` de la fonction active, en style inline). `#panelsGrid` passe en
`display: contents`, si bien que chaque panneau et la carte sont placés par `grid-area` = leur clé. Un `MutationObserver`
replace les panneaux montés plus tard et retire de la grille les emplacements sans panneau.

**Tech Stack :** TypeScript, CSS grid, vitest (happy-dom), node:test, Playwright (audit).

**Spec :** `docs/superpowers/specs/2026-10-19-terminal-bloomberg-design.md`, section 3 (et le bandeau de la section 5).

## Global Constraints
- Concerne seulement la variante finance hors application de bureau (`SITE_VARIANT === 'finance' && !ctx.isDesktopApp`) et seulement au-delà de 768 px de large pour la mise en page. Le mobile (≤ 768 px) garde la pile actuelle jusqu'au sous-projet 3, mais reçoit déjà le shell (commande et touches).
- Codes et ordre : TOP, WEI, GOVT, FX, CMDTY, ECO, N, LABS. TOP est la fonction par défaut.
- Libellés : TOP Vue d'ensemble / Overview ; WEI Actions / Equities ; GOVT Taux / Rates ; FX Devises / FX ; CMDTY Matières premières / Commodities ; ECO Macro & risque / Macro & risk ; N Actualité / News ; LABS Études / Studies.
- Invite : « Tapez un code ou cliquez une touche » / « Type a code or click a key ». Code inconnu : « Code inconnu : XYZ » / « Unknown code: XYZ ».
- Lien « Licence et source (AGPL-3.0) » vers `/labs/source.txt` toujours présent dans la barre d'état.
- Couleurs et police : variables `--bb-*` de `bloomberg-theme.css` (sous-projet 1).
- Tests via `./selfhost/check.sh` ; commits en conventional commits, sans trailer d'attribution.

## Review Focus
- Visiteur revenant avec l'ancien desk à 6 onglets dans `localStorage` (`worldmonitor-tabs-v1:finance`) : il doit obtenir les 8 fonctions, pas un mélange.
- Adresse `/terminal/#govt` (minuscules), `#XYZ` (inconnu) ou `#` vide : on arrive respectivement sur GOVT, TOP et TOP, sans erreur.
- Frappe d'une lettre pendant qu'un champ de saisie d'un panneau (watchlist, recherche) a le focus : elle ne doit pas être volée par la ligne de commande.
- Panneau d'une fonction jamais créé (par exemple `economic-news` absent des flux) : pas de trou noir dans la grille.
- Carte déplacée dans la grille : elle doit se redimensionner (pas de canvas étiré ou vide) après un changement de fonction.

---

### Task 1 : configuration des fonctions et analyse des commandes (modules purs)

**Files :**
- Create : `src/config/terminal-functions.ts`
- Create : `src/app/terminal-command.ts`
- Delete : `src/config/sabathier-desk.ts`, `tests/dom/sabathier-desk.test.mts`
- Modify : `src/components/synthesis-format.ts` (`DeskKey` → `FunctionCode`), `src/components/SynthesisBar.ts` (type)
- Test : `tests/dom/terminal-functions.test.mts`, `tests/dom/terminal-command.test.mts`, `tests/dom/synthesis-bar.test.mts` (clés de desk)

**Interfaces :**
- Produces :
```ts
export type FunctionCode = 'TOP' | 'WEI' | 'GOVT' | 'FX' | 'CMDTY' | 'ECO' | 'N' | 'LABS';
export interface TerminalFunction {
  code: FunctionCode; label: { en: string; fr: string };
  areas: readonly string[];   // one string per grid row, space-separated panel keys ('map' = the map)
  columns?: string; rows?: string; // grid-template-columns / -rows (default: equal fr)
  mobile: readonly string[];  // stacking order under 768px
}
export const TERMINAL_FUNCTIONS: readonly TerminalFunction[];
export const DEFAULT_FUNCTION: FunctionCode; // 'TOP'
export function getFunction(code: FunctionCode): TerminalFunction;
export function isFunctionCode(s: string): s is FunctionCode;
export function functionPanelKeys(fn: TerminalFunction): string[]; // unique, reading order of areas
export function panelHome(key: string): FunctionCode | null; // first non-TOP function containing key
export function functionLabel(fn: TerminalFunction, lang: string): string;
export function buildFunctionTabs(base: Record<string, PanelConfig>, lang: string, newId: () => string): PanelTab[];
export function prepareTerminalDesk(stored: TabsState | null, base: Record<string, PanelConfig>, lang: string, newId: () => string, initial?: FunctionCode): TabsState | null;
export function collapseAreas(areas: readonly string[], present: ReadonlySet<string>): string[];
export function isRectangular(areas: readonly string[]): boolean;
// terminal-command.ts
export type Command = { kind: 'open'; code: FunctionCode } | { kind: 'help' } | { kind: 'unknown'; input: string } | { kind: 'empty' };
export function parseCommand(input: string): Command;
export function normalizeToken(s: string): string; // lowercase, no accents, alphanumerics only
```

- [ ] **Step 1 : tests en échec.** `tests/dom/terminal-command.test.mts` :
```ts
import { describe, expect, it } from 'vitest';
import { parseCommand } from '@/app/terminal-command';

describe('parseCommand', () => {
  it('opens codes whatever the case, with or without <GO>, spaces ignored', () => {
    expect(parseCommand('WEI')).toEqual({ kind: 'open', code: 'WEI' });
    expect(parseCommand(' govt <go> ')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('c m d t y')).toEqual({ kind: 'open', code: 'CMDTY' });
    expect(parseCommand('n<GO>')).toEqual({ kind: 'open', code: 'N' });
  });
  it('accepts the French and English labels as aliases, accents and punctuation dropped', () => {
    expect(parseCommand('taux')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('Rates')).toEqual({ kind: 'open', code: 'GOVT' });
    expect(parseCommand('actualité')).toEqual({ kind: 'open', code: 'N' });
    expect(parseCommand('news')).toEqual({ kind: 'open', code: 'N' });
    expect(parseCommand("vue d'ensemble")).toEqual({ kind: 'open', code: 'TOP' });
    expect(parseCommand('matières premières')).toEqual({ kind: 'open', code: 'CMDTY' });
  });
  it('help words and unknown input', () => {
    for (const h of ['HELP', 'aide', '?', 'help <GO>']) expect(parseCommand(h)).toEqual({ kind: 'help' });
    expect(parseCommand('xyz')).toEqual({ kind: 'unknown', input: 'XYZ' });
    expect(parseCommand('   ')).toEqual({ kind: 'empty' });
    expect(parseCommand('<GO>')).toEqual({ kind: 'empty' });
  });
});
```
`tests/dom/terminal-functions.test.mts` :
```ts
import { describe, expect, it } from 'vitest';
import { FINANCE_PANELS } from '@/config/panels';
import {
  TERMINAL_FUNCTIONS, DEFAULT_FUNCTION, functionPanelKeys, panelHome, buildFunctionTabs, prepareTerminalDesk,
  collapseAreas, isRectangular, isFunctionCode,
} from '@/config/terminal-functions';

const ids = () => { let i = 0; return () => `tab-${++i}-x`; };

describe('terminal functions', () => {
  it('eight functions in key order, TOP first and default', () => {
    expect(TERMINAL_FUNCTIONS.map((f) => f.code)).toEqual(['TOP', 'WEI', 'GOVT', 'FX', 'CMDTY', 'ECO', 'N', 'LABS']);
    expect(DEFAULT_FUNCTION).toBe('TOP');
    expect(isFunctionCode('GOVT')).toBe(true);
    expect(isFunctionCode('govt')).toBe(false);
  });
  it('every grid is rectangular and only names finance panels or the map', () => {
    for (const fn of TERMINAL_FUNCTIONS) {
      expect(isRectangular(fn.areas), fn.code).toBe(true);
      for (const key of functionPanelKeys(fn)) expect(key === 'map' || key in FINANCE_PANELS, `${fn.code}:${key}`).toBe(true);
    }
  });
  it('the mobile order covers exactly the grid panels', () => {
    for (const fn of TERMINAL_FUNCTIONS) expect([...fn.mobile].sort(), fn.code).toEqual(functionPanelKeys(fn).sort());
  });
  it('panel homes point to the first non-TOP function holding the panel', () => {
    expect(panelHome('markets')).toBe('WEI');
    expect(panelHome('live-news')).toBe('N');
    expect(panelHome('finance-labs')).toBe('LABS');
    expect(panelHome('map')).toBe('CMDTY');
    expect(panelHome('insights')).toBeNull();
  });
  it('one tab per function, deskKey = code, only that function panels enabled', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 }, forex: { name: 'F', enabled: true, priority: 1 } };
    const tabs = buildFunctionTabs(base, 'fr', ids());
    expect(tabs.map((t) => t.deskKey)).toEqual(TERMINAL_FUNCTIONS.map((f) => f.code));
    expect(tabs[0]!.name).toBe('TOP');
    const fx = tabs.find((t) => t.deskKey === 'FX')!;
    expect(fx.panelSettings.forex!.enabled).toBe(true);
    expect(fx.panelSettings.markets!.enabled).toBe(false);
    expect(fx.panelOrder).toEqual(['forex']);
  });
  it('rebuilds an old desk, keeps a current one, opens the requested function', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 } };
    const fresh = prepareTerminalDesk(null, base, 'en', ids(), 'GOVT')!;
    expect(fresh.tabs).toHaveLength(8);
    expect(fresh.activeTabId).toBe(fresh.tabs.find((t) => t.deskKey === 'GOVT')!.id);
    expect(prepareTerminalDesk(fresh, base, 'en', ids())).toBeNull();
    const old = { activeTabId: 'a', tabs: [{ id: 'a', name: 'Overview', deskKey: 'overview', panelSettings: {}, panelOrder: [], bottomSet: [] }] };
    expect(prepareTerminalDesk(old, base, 'en', ids())!.tabs).toHaveLength(8);
  });
  it('a current desk switches to the requested function', () => {
    const base = { markets: { name: 'M', enabled: true, priority: 1 } };
    const desk = prepareTerminalDesk(null, base, 'en', ids())!;
    const next = prepareTerminalDesk(desk, base, 'en', ids(), 'N')!;
    expect(next.tabs).toBe(desk.tabs);
    expect(next.activeTabId).toBe(desk.tabs.find((t) => t.deskKey === 'N')!.id);
  });
});

describe('collapseAreas', () => {
  it('keeps the grid when every panel is present', () => {
    expect(collapseAreas(['a b', 'a c'], new Set(['a', 'b', 'c']))).toEqual(['a b', 'a c']);
  });
  it('gives a missing cell to its left neighbour', () => {
    expect(collapseAreas(['a b c'], new Set(['a', 'b']))).toEqual(['a b b']);
    expect(collapseAreas(['a b x', 'a c x'], new Set(['a', 'b', 'c']))).toEqual(['a b b', 'a c c']);
  });
  it('falls back to the right, upper then lower neighbour, then to an empty cell', () => {
    expect(collapseAreas(['a m i', 'a x y'], new Set(['a', 'm', 'i']))).toEqual(['a m i', 'a m i']);
    expect(collapseAreas(['x b'], new Set(['b']))).toEqual(['b b']);
    expect(collapseAreas(['a x', 'a y'], new Set(['a', 'y']))).toEqual(['a y', 'a y']);
    expect(collapseAreas(['x'], new Set())).toEqual(['.']);
  });
  it('always returns a rectangular grid', () => {
    expect(isRectangular(collapseAreas(['a x', 'a y'], new Set(['a', 'y'])))).toBe(true);
    expect(isRectangular(['a b', 'b a'])).toBe(false);
  });
});
```
- [ ] **Step 2 : vérifier l'échec.** `./selfhost/check.sh npx vitest run --config vitest.dom.config.mts tests/dom/terminal-command.test.mts tests/dom/terminal-functions.test.mts`. Attendu : FAIL (modules absents).
- [ ] **Step 3 : implémentation de `src/config/terminal-functions.ts`.** Données :
```ts
export const TERMINAL_FUNCTIONS: readonly TerminalFunction[] = [
  { code: 'TOP', label: { en: 'Overview', fr: "Vue d'ensemble" }, areas: ['markets map insights', 'markets live-news finance-labs'], columns: '1.1fr 1.4fr 1fr', mobile: ['markets', 'insights', 'live-news', 'map', 'finance-labs'] },
  { code: 'WEI', label: { en: 'Equities', fr: 'Actions' }, areas: ['markets heatmap earnings-calendar', 'markets market-breadth earnings-calendar'], columns: '1fr 1.3fr 1fr', mobile: ['markets', 'heatmap', 'market-breadth', 'earnings-calendar'] },
  { code: 'GOVT', label: { en: 'Rates', fr: 'Taux' }, areas: ['yield-curve yield-curve centralbanks', 'bonds bonds centralbanks'], rows: '1.2fr 1fr', mobile: ['yield-curve', 'bonds', 'centralbanks'] },
  { code: 'FX', label: { en: 'FX', fr: 'Devises' }, areas: ['forex crypto'], columns: '1.4fr 1fr', mobile: ['forex', 'crypto'] },
  { code: 'CMDTY', label: { en: 'Commodities', fr: 'Matières premières' }, areas: ['commodities energy-complex map', 'gold-intelligence energy-complex map'], columns: '1fr 1fr 1.3fr', mobile: ['commodities', 'energy-complex', 'gold-intelligence', 'map'] },
  { code: 'ECO', label: { en: 'Macro & risk', fr: 'Macro & risque' }, areas: ['economic-calendar macro-tiles fsi', 'economic-calendar macro-signals fear-greed', 'consumer-prices polymarket fear-greed'], mobile: ['macro-tiles', 'economic-calendar', 'fsi', 'macro-signals', 'fear-greed', 'consumer-prices', 'polymarket'] },
  { code: 'N', label: { en: 'News', fr: 'Actualité' }, areas: ['live-news markets-news economic-news'], mobile: ['live-news', 'markets-news', 'economic-news'] },
  { code: 'LABS', label: { en: 'Studies', fr: 'Études' }, areas: ['finance-labs'], mobile: ['finance-labs'] },
];
```
Fonctions :
- `buildFunctionTabs` suit l'ancien `buildDeskTabs`. `name` = le code, `deskKey` = le code, `panelOrder` = `fn.mobile` filtré sur les clés présentes dans `base`, et `enabled` vrai seulement pour ces clés.
- `prepareTerminalDesk` :
  - garde `stored` si `stored.tabs.map(t => t.deskKey)` égale la liste des codes ;
  - dans ce cas, renvoie `null` quand `initial` est absent ou déjà actif, sinon `{ ...stored, activeTabId: <id de l'onglet initial> }` (mêmes `tabs`) ;
  - sinon, reconstruit le desk avec l'onglet `initial ?? DEFAULT_FUNCTION` actif.
- `collapseAreas` : matrice de cellules. Pour chaque cellule dont le nom n'est ni `.` ni dans `present`, on essaie dans l'ordre les voisines de gauche, de droite, du dessus puis du dessous. Une voisine n'est candidate que si son nom est présent. On garde le premier candidat qui laisse la grille rectangulaire (`isRectangular`) ; à défaut, la cellule vaut `.`. Les cellules sont traitées de gauche à droite, puis de haut en bas, en répétant jusqu'à stabilité.
- `isRectangular` : pour chaque nom autre que `.`, l'ensemble de ses cellules remplit exactement sa boîte englobante, et chaque rangée a le même nombre de colonnes.
- `panelHome` : première fonction autre que TOP dont `functionPanelKeys` contient la clé.

`src/app/terminal-command.ts` :
```ts
import { TERMINAL_FUNCTIONS, isFunctionCode, type FunctionCode } from '@/config/terminal-functions';

export type Command = { kind: 'open'; code: FunctionCode } | { kind: 'help' } | { kind: 'unknown'; input: string } | { kind: 'empty' };

export function normalizeToken(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/<go>/g, '').replace(/[^a-z0-9?]/g, '');
}

const ALIASES = new Map<string, FunctionCode>();
for (const fn of TERMINAL_FUNCTIONS) {
  for (const word of [fn.code, fn.label.en, fn.label.fr]) ALIASES.set(normalizeToken(word), fn.code);
}
const HELP = new Set(['help', 'aide', '?']);

export function parseCommand(input: string): Command {
  const token = normalizeToken(input);
  if (!token) return { kind: 'empty' };
  if (HELP.has(token)) return { kind: 'help' };
  const upper = token.toUpperCase();
  if (isFunctionCode(upper)) return { kind: 'open', code: upper };
  const alias = ALIASES.get(token);
  return alias ? { kind: 'open', code: alias } : { kind: 'unknown', input: upper };
}
```
Dans `synthesis-format.ts`, remplacer `DeskKey` par `FunctionCode`. Correspondance des items :
- US 10Y, 2s10s, EUR 10Y AAA → `'GOVT'` ;
- EUR/USD → `'FX'` ;
- S&P 500, CAC 40, VIX → `'WEI'` ;
- Brent, Gold → `'CMDTY'`.

Pour chaque ancienne valeur, lire le fichier et appliquer : `rates-fx` → GOVT, sauf EUR/USD → FX ; `equities` → WEI ; `commodities` → CMDTY ; `macro` → ECO ; `overview` → TOP.
Dans `tests/dom/synthesis-bar.test.mts`, appliquer la même correspondance aux clés attendues.
- [ ] **Step 4 : vérifier le succès.** `./selfhost/check.sh npx vitest run --config vitest.dom.config.mts tests/dom/terminal-command.test.mts tests/dom/terminal-functions.test.mts tests/dom/synthesis-bar.test.mts`. Attendu : PASS. Le typecheck reste à faire après la tâche 3 : `panel-layout.ts` importe encore `sabathier-desk` jusque-là.
- [ ] **Step 5 : commit.** `git add -A src/config src/app/terminal-command.ts src/components/synthesis-format.ts src/components/SynthesisBar.ts tests/dom && git commit -m "feat(terminal): eight Bloomberg functions and command parsing"`

### Task 2 : le shell (ligne de commande, touches, adresse, horloges)

**Files :**
- Create : `src/app/terminal-shell.ts`
- Test : `tests/dom/terminal-shell.test.mts`

**Interfaces :**
- Consumes : `parseCommand`, `TERMINAL_FUNCTIONS`, `functionLabel`, `isFunctionCode`, `DEFAULT_FUNCTION`.
- Produces :
```ts
export function functionFromHash(hash: string): FunctionCode; // '#govt' → 'GOVT', unknown/empty → DEFAULT_FUNCTION
export class TerminalShell {
  constructor(opts: { lang: string; onOpen: (code: FunctionCode) => void; now?: () => Date });
  getElement(): HTMLElement;              // section.bb-shell: .bb-cmd row + .bb-help + .bb-keys
  open(code: FunctionCode, push?: boolean): void; // marks the key, pushes #CODE (default true), calls onOpen
  setActive(code: FunctionCode): void;    // marks the key only
  start(): void;                          // global keydown, popstate/hashchange, clock timer
  destroy(): void;
}
```
- [ ] **Step 1 : test en échec.** `tests/dom/terminal-shell.test.mts` :
```ts
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
});
```
- [ ] **Step 2 :** `./selfhost/check.sh npx vitest run --config vitest.dom.config.mts tests/dom/terminal-shell.test.mts`. Attendu : FAIL (module absent).
- [ ] **Step 3 : implémentation.** `TerminalShell` construit son DOM sans `innerHTML` (createElement / textContent).
  - `form.bb-cmd` contient `span.bb-prompt` (`>`), un `input` (`aria-label` = invite, `autocomplete=off`, `spellcheck=false`, placeholder = invite) et `span.bb-clock`.
  - `div.bb-help[hidden]` contient `p.bb-help-msg` puis 8 boutons `data-fn` (code + libellé).
  - `nav.bb-keys` (`aria-label` « Fonctions » / « Functions ») contient 8 `button.bb-key[data-fn]` avec `<b>CODE</b><small>libellé</small>` et `aria-pressed`.

  Comportement :
  - **Soumission :** `parseCommand`. `open` → `open(code)` puis vide le champ et ferme l'aide. `help` → message vide et aide ouverte. `unknown` → message « Code inconnu : X » / « Unknown code: X » et aide ouverte. `empty` → rien.
  - **`keydown` global** sur `document` : ignoré si `e.defaultPrevented`, si `ctrlKey`, `metaKey` ou `altKey`, si `e.key.length !== 1`, ou si la cible est un `input`, `textarea`, `select` ou `[contenteditable]`. Sinon : `preventDefault`, focus du champ et ajout du caractère.
  - **Échap** sur le champ : vide et ferme l'aide.
  - **`popstate` et `hashchange`** → `open(functionFromHash(location.hash), false)`.
  - **`open(code, push = true)`** : si `push` et `location.hash !== '#'+code`, alors `history.pushState(null, '', '#'+code)` ; puis `setActive(code)` et `onOpen(code)`.
  - **Horloges :** `PAR hh:mm:ss · NY hh:mm:ss` via `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' | 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })`, rafraîchies chaque seconde par `start()` (première mise à jour immédiate dans le constructeur).
- [ ] **Step 4 :** relancer la commande de l'étape 2. Attendu : PASS (6 tests).
- [ ] **Step 5 :** `git add src/app/terminal-shell.ts tests/dom/terminal-shell.test.mts && git commit -m "feat(terminal): command line, function keys and #CODE addresses"`

### Task 3 : branchement dans la mise en page et grille par fonction

**Files :**
- Modify : `src/app/panel-layout.ts` (premier lancement du desk vers 1331-1343, `initPanelTabs` vers 1367-1414, pied de page vers 1304-1309, imports)
- Create : `src/app/terminal-grid.ts` (application de la grille au DOM)
- Modify : `src/components/SynthesisBar.ts` (mode bandeau défilant + horodatage externe)
- Modify : `src/styles/bloomberg-theme.css` (shell, grille, bandeau, barre d'état)
- Test : `tests/dom/terminal-grid.test.mts`, `tests/dom/synthesis-bar.test.mts`, `tests/bloomberg-theme-scope.test.mjs`

**Interfaces :**
- Consumes : `TerminalShell`, `prepareTerminalDesk`, `getFunction`, `collapseAreas`, `functionPanelKeys`, `panelHome`, `functionFromHash`.
- Produces :
```ts
// terminal-grid.ts
export class TerminalGrid {
  constructor(main: HTMLElement, opts: { lang: string; onOpen: (code: FunctionCode) => void });
  apply(code: FunctionCode): void; // sets data-fn + grid template on main, grid-area/numbers/home links on items
  refresh(): void;                 // re-collapses for panels present now (called by its MutationObserver)
  destroy(): void;
}
// SynthesisBar options gain: ticker?: boolean; stampTarget?: HTMLElement
```
- [ ] **Step 1 : tests en échec.** `tests/dom/terminal-grid.test.mts` :
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { TerminalGrid } from '@/app/terminal-grid';

function dom() {
  const main = document.createElement('main');
  main.className = 'main-content';
  main.innerHTML = `<div id="mapSection" class="map-section"><div class="panel-header"><span class="panel-title">Map</span></div></div>
    <div id="panelsGrid" class="panels-grid">
      <div class="panel" data-panel="markets"><div class="panel-header"><span class="panel-title">Markets</span></div></div>
      <div class="panel" data-panel="insights"><div class="panel-header"><span class="panel-title">AI</span></div></div>
      <div class="panel hidden" data-panel="forex"><div class="panel-header"><span class="panel-title">FX</span></div></div>
    </div>`;
  document.body.append(main);
  return main;
}
afterEach(() => document.body.replaceChildren());

describe('TerminalGrid', () => {
  it('lays out the function grid, numbers panels in reading order and links their home function', () => {
    const main = dom(); const opened: string[] = [];
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: (c) => opened.push(c) });
    grid.apply('TOP');
    expect(main.dataset.fn).toBe('TOP');
    // live-news and finance-labs are absent: their cells go to the panel above (map, insights).
    expect(main.style.gridTemplateAreas).toBe('"markets map insights" "markets map insights"');
    expect(main.style.gridTemplateColumns).toBe('1.1fr 1.4fr 1fr');
    const markets = main.querySelector<HTMLElement>('[data-panel="markets"]')!;
    expect(markets.style.gridArea).toBe('markets');
    expect(main.querySelector<HTMLElement>('#mapSection')!.style.gridArea).toBe('map');
    expect(markets.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('1');
    expect(main.querySelector('#mapSection .panel-title')!.getAttribute('data-bb-n')).toBe('2');
    const link = markets.querySelector<HTMLButtonElement>('.bb-fn-link')!;
    expect(link.textContent).toBe('WEI');
    link.click();
    expect(opened).toEqual(['WEI']);
    expect(main.querySelector('[data-panel="insights"] .bb-fn-link')).toBeNull();
  });
  it('a panel mounted later takes its cell back', async () => {
    const main = dom();
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    grid.apply('TOP');
    const news = document.createElement('div');
    news.className = 'panel'; news.dataset.panel = 'live-news';
    main.querySelector('#panelsGrid')!.append(news);
    grid.refresh();
    expect(main.style.gridTemplateAreas).toBe('"markets map insights" "markets live-news insights"');
    grid.destroy();
  });
  it('no home link to the function on screen', () => {
    const main = dom();
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {} });
    main.querySelector('[data-panel="forex"]')!.classList.remove('hidden');
    grid.apply('FX');
    expect(main.querySelector('[data-panel="forex"] .bb-fn-link')).toBeNull();
  });
});
```
Dans `tests/dom/synthesis-bar.test.mts`, ajouter un cas `ticker: true` : la piste `.es-syn-track` contient deux copies des chiffres, la seconde avec `aria-hidden="true"` et ses boutons en `tabindex="-1"` ; l'horodatage va dans `stampTarget` ; le résumé (`.es-syn-brief`) n'est pas rendu.
Dans `tests/bloomberg-theme-scope.test.mjs`, ajouter :
```js
test('function shell: grid on main, contents grid, hidden tabs and toolbar, ticker animation respects reduced motion', () => {
  assert.match(css, /:root\[data-variant="finance"\]\.bb-shell #panelsGrid\s*\{[^}]*display:\s*contents/);
  assert.match(css, /:root\[data-variant="finance"\]\.bb-shell :is\(\.header, #panelTabsMount\)\s*\{[^}]*display:\s*none/);
  assert.match(css, /@keyframes bb-tick/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*\.es-syn-track\s*\{[^}]*animation:\s*none/);
});
```
- [ ] **Step 2 :** `./selfhost/check.sh sh -c "npx vitest run --config vitest.dom.config.mts tests/dom/terminal-grid.test.mts tests/dom/synthesis-bar.test.mts; node --test tests/bloomberg-theme-scope.test.mjs"`. Attendu : FAIL.
- [ ] **Step 3 : `src/app/terminal-grid.ts`.**
  - **Éléments placés :** `items()` renvoie, parmi les enfants de `#panelsGrid`, les éléments `[data-panel]` sans classe `hidden`, plus `#mapSection` (clé `map`) s'il n'est pas `hidden`.
  - **`apply(code)` :**
    - mémorise la fonction et pose `main.dataset.fn = code` ;
    - calcule `present` = clés de `items()` ∩ `functionPanelKeys(fn)` ;
    - `areas = collapseAreas(fn.areas, present)` ;
    - `main.style.gridTemplateAreas = areas.map(r => '"' + r + '"').join(' ')`, puis `gridTemplateColumns = fn.columns ?? ''` et `gridTemplateRows = fn.rows ?? ''` ;
    - pour chaque item : `style.gridArea` = clé, `.panel-title[data-bb-n]` = rang de la clé dans l'ordre de lecture des aires d'origine (1-based) ;
    - lien de fonction d'origine : retirer tout `.bb-fn-link` existant de l'en-tête ; si `panelHome(key)` existe et diffère de `code`, ajouter à la fin de `.panel-header` un `button.bb-fn-link` (type `button`, texte = code, `title` = libellé). Son clic appelle `onOpen` avec `stopPropagation`.
    - enfin `requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))`, pour que la carte se redimensionne.
  - **Observation :** un `MutationObserver` sur `main` (`childList`, `subtree`, `attributes` avec `attributeFilter: ['class']`) appelle `refresh()`. `refresh()` relance `apply` sur la fonction mémorisée, au plus une fois par frame (`requestAnimationFrame`), et seulement si la chaîne des aires change. Les tests appellent `refresh()` directement ; elle reste synchrone quand on l'appelle soi-même. Le rAF ne sert qu'à l'observateur.
- [ ] **Step 4 : `SynthesisBar`.**
  - Options `ticker?: boolean` et `stampTarget?: HTMLElement`.
  - En mode bandeau : le résumé n'est pas rendu. Les boutons des chiffres sont placés dans `div.es-syn-track`, suivis d'une copie clonée avec `aria-hidden="true"` dont les boutons sont en `tabindex="-1"` (les clics restent branchés sur la copie, via la même fonction). Le tout est enveloppé dans `div.es-syn-figures`.
  - La durée de l'animation est posée en style inline : `--bb-tick-s = max(30, items × 6)s`.
  - L'horodatage va dans `stampTarget` (`textContent`) quand l'option est fournie.
- [ ] **Step 5 : `panel-layout.ts`.**
  - **Imports :** `prepareTerminalDesk`, `getFunction` (via `terminal-functions`), `TerminalShell` et `functionFromHash`, `TerminalGrid`. Retirer l'import de `sabathier-desk`.
  - **Premier lancement** (bloc finance existant) : `prepareTerminalDesk(loadTabsState(), this.ctx.panelSettings, getCurrentLanguage(), generateTabId, functionFromHash(location.hash))`. Si un desk revient, prendre l'onglet actif (`activeTabId`), et non `tabs[0]`, pour `panelSettings`, `panelOrder` et `bottomSet`, puis enregistrer comme aujourd'hui. Ajouter la classe `bb-shell` sur `document.documentElement` dans ce même bloc.
  - **`initPanelTabs`, branche finance :**
    - créer `TerminalGrid(document.getElementById('main')!, { lang, onOpen: (c) => shell.open(c) })` ;
    - créer `TerminalShell({ lang, onOpen: (code) => { const tab = this.tabsState?.tabs.find(t => t.deskKey === code); if (tab && tab.id !== this.tabsState?.activeTabId) this.applyWebMcpTabAction({ type: 'select', tabId: tab.id }); grid.apply(code); } })` ;
    - insérer `shell.getElement()` avant `mount` (`#panelTabsMount`) ;
    - créer `SynthesisBar({ …, ticker: true, stampTarget: document.querySelector('.bb-stamp') ?? undefined, onSelectDesk: (code) => shell.open(code) })`, insérée entre le shell et `mount` ;
    - `shell.start()` ;
    - `const code = this.tabsState?.tabs.find(t => t.id === this.tabsState?.activeTabId)?.deskKey` ;
    - `shell.setActive(isFunctionCode(code) ? code : 'TOP')` puis `grid.apply(...)` avec le même code. On n'appelle pas `pushState` au démarrage.
  - **Pied de page finance :** `<footer class="site-footer es-foot">`, puis dans `.es-foot-inner` : `<span class="bb-live"><span class="bb-live-dot"></span>LIVE</span><span class="bb-stamp"></span><span class="bb-owner">Emilien Sabathier · Rouen</span><a href="/labs/source.txt">…</a>`.
- [ ] **Step 6 : CSS.** Ajouter dans `bloomberg-theme.css`, tout scopé `:root[data-variant="finance"].bb-shell` :
  - **Shell :**
    - `.bb-shell` : fond noir.
    - `.bb-cmd` : `display: flex; gap: 6px; align-items: center; padding: 3px 12px; border-bottom: 1px solid var(--bb-rule)`.
    - `.bb-cmd input` : `flex: 1; background: var(--bb-input); color: #fff; border: 0; font: inherit; padding: 2px 6px`. Le placeholder est en `var(--bb-dim)`.
    - `.bb-clock` : blanc, `white-space: nowrap`.
    - `.bb-help` : panneau sous la commande, fond `#0a0a0a`, filet ambre, liste en grille de 4 colonnes. Ses boutons montrent le code en ambre et le libellé en gris. `.bb-help-msg` est en `var(--bb-down)`.
    - `.bb-keys` : `display: flex; gap: 3px; padding: 3px 12px; border-bottom: 1px solid var(--bb-rule); overflow-x: auto; scrollbar-width: none`.
    - `.bb-key` : `background: var(--bb-key); color: var(--bb-amber); border: 0; padding: 2px 10px; font: inherit; font-weight: 600; text-align: center; cursor: pointer`. `small` passe en `display: block`, poids 400, 9px, `#aaa`. `.bb-key[aria-pressed="true"]` a un fond ambre, son texte et son `small` en noir.
  - **Bandeau :**
    - `.es-syn` : fond `#0a0a0a`, une ligne, `overflow: hidden`, `padding: 2px 0`.
    - `.es-syn-figures` : `display: block; overflow: hidden`.
    - `.es-syn-track` : `display: inline-flex; gap: 16px; padding-right: 16px; white-space: nowrap; animation: bb-tick var(--bb-tick-s, 60s) linear infinite`.
    - `.es-syn:hover .es-syn-track` : `animation-play-state: paused`.
    - `@keyframes bb-tick { from { transform: translateX(0) } to { transform: translateX(-50%) } }`.
    - `@media (prefers-reduced-motion: reduce) { … .es-syn-track { animation: none; } }`.
    - Le contenu de la piste est doublé ; l'élément est donc `inline-flex` avec deux groupes `.es-syn-group` de même largeur, d'où le `-50%` exact.
  - **Masquages :** `:is(.header, #panelTabsMount) { display: none; }`, `.add-panel-block`, les poignées `.map-resize-handle, .map-width-resize-handle, .panel-resize-handle, .panel-col-resize-handle`, et les boutons `#mapSideBtn, #mapPinBtn, #mapFullscreenBtn`. Côté en-têtes de panneau, masquer les boutons upstream de fermeture, de déplacement et d'aide « ? » : relever leurs classes avec `grep -n "className = '" src/components/Panel.ts` et `grep -n "panel-close\|panel-info\|drag" src/components/Panel.ts`, puis masquer `.panel-info-wrapper` et le bouton de fermeture (classe relevée).
  - **Grille (au-delà de 768 px) :**
    - `#app` : `display: flex; flex-direction: column; height: 100dvh; overflow: hidden`.
    - `.main-content[data-fn]` : `display: grid; flex: 1 1 auto; min-height: 0; gap: 2px; padding: 2px; overflow: hidden; grid-auto-rows: 1fr; grid-template-rows: repeat(var(--bb-rows, 2), minmax(0, 1fr))` (les fonctions sans `rows` prennent des rangées égales via le style inline vide).
    - `#panelsGrid` : `display: contents`.
    - `#mapSection` : `min-height: 0; height: auto; display: flex; flex-direction: column`. `#mapContainer` : `flex: 1; min-height: 0; height: auto`.
    - `.main-content[data-fn] .panel` : `min-height: 0; height: auto; max-height: none; display: flex; flex-direction: column; overflow: hidden`. `.panel-content` : `flex: 1; min-height: 0; overflow: auto`.
    - `.panel-title[data-bb-n]::before { content: attr(data-bb-n) ") "; color: var(--bb-amber); }`.
    - `.bb-fn-link` : `margin-left: auto; background: transparent; color: var(--bb-amber); border: 0; font: inherit; font-weight: 600; cursor: pointer`.
  - **Pied de page = barre d'état :** `.site-footer.es-foot` sur une ligne de 22 px, `font-size: 11px`. `.es-foot-inner` : `display: flex; gap: 16px; align-items: center; padding: 2px 12px`. `.bb-live` est en `var(--bb-up)`, avec `.bb-live-dot` comme pastille ronde de 6 px. `.bb-owner` prend `margin-left: auto`.
- [ ] **Step 7 :** `./selfhost/check.sh sh -c "npx tsc --noEmit && npx vitest run --config vitest.dom.config.mts tests/dom && node --test tests/bloomberg-theme-scope.test.mjs"`. Attendu : PASS. Les tests DOM upstream qui échouaient déjà au commit de départ restent hors périmètre, à noter dans le registre.
- [ ] **Step 8 :** `git add -A src tests && git commit -m "feat(terminal): function screens replace the tabs and the free grid on desktop"`

### Task 4 : audit, prévisualisation, retouches, mise en ligne

**Files :**
- Modify : `selfhost/visual/audit.mjs`

- [ ] **Step 1 : audit.**
  - Remplacer le contrôle « 6 onglets » par « 8 touches `.bb-key` ».
  - Supprimer le contrôle « résumé de synthèse », remplacé par « `.es-syn-item` ≥ 5 dans le bandeau ».
  - Sur ordinateur (1440×900), pour chaque code : `page.goto(url + '#' + code)`, attendre 6 s, capturer `fn-<code>.png`, puis vérifier :
    - `document.documentElement.scrollHeight <= innerHeight + 1` (pas de défilement de page) ;
    - chaque nom d'aire de `main.style.gridTemplateAreas` correspond à un élément visible de hauteur > 40 px.
  - Commande : sur TOP, taper `GOVT` dans `.bb-cmd input` puis Entrée ; vérifier `location.hash === '#GOVT'` et `main.dataset.fn === 'GOVT'`.
  - Aucune fonction ne doit échouer.
- [ ] **Step 2 :** `./selfhost/preview.sh`, puis `node selfhost/visual/audit.mjs http://127.0.0.1:3201/ <scratch>/p2`. Regarder les 8 captures. Retoucher les proportions dans `terminal-functions.ts` (colonnes et rangées seulement, la liste des panneaux est arrêtée) et le CSS jusqu'à un rendu net : pas de panneau écrasé, pas de bloc vide, textes lisibles. Commit `fix(terminal): …` par lot.
- [ ] **Step 3 :** `./selfhost/preview.sh stop && sudo docker rmi worldmonitor:preview`. `git add selfhost/visual/audit.mjs && git commit -m "chore(selfhost): audit checks every function screen and the command line"`
- [ ] **Step 4 :** suite complète `./selfhost/check.sh sh -c "npx tsc --noEmit && npx vitest run --config vitest.dom.config.mts"` (en arrière-plan si elle dépasse 10 min), puis `git push` et `./selfhost/deploy.sh`.
- [ ] **Step 5 :** `node selfhost/visual/audit.mjs https://emiliensabathier.fr/terminal/ <scratch>/prod2`. Attendu : `ok` partout. Regarder les captures.

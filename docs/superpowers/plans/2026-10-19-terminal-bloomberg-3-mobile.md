# Terminal Bloomberg — sous-projet 3 : mobile — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** sous 768 px, un Terminal empilé, dense et lisible. On garde la commande, les touches défilantes et le bandeau, puis les panneaux de la fonction à pleine largeur dans l'ordre mobile, et la barre d'état. On retire la barre d'onglets upstream, les puces de catégories et la carte repliable.

**Architecture :** `TerminalGrid` connaît déjà les panneaux de la fonction. Sous 768 px (`matchMedia`), il numérote selon `fn.mobile` et pose `style.order` sur chaque élément placé. `<main>` passe en colonne flex et `#panelsGrid` en `display: contents`, si bien que la carte s'intercale entre les panneaux. Dans `panel-layout.ts`, la variante shell n'installe plus le repli de carte mobile ni `MobilePanelNav`. Le reste est du CSS.

**Tech Stack :** TypeScript, CSS, vitest (happy-dom), Playwright (audit).

**Spec :** `docs/superpowers/specs/2026-10-19-terminal-bloomberg-design.md`, section 4.

## Global Constraints
- Seulement la variante shell (`:root[data-variant="finance"].bb-shell`) et seulement `@media (max-width: 768px)`. Le bureau ne change pas.
- Texte en 11 px minimum, touches d'au moins 40 px de haut, aucun défilement horizontal de la page (seuls la rangée de touches, le bandeau et la nav du site défilent à l'intérieur).
- Panneau : hauteur maximale 60vh, défilement interne. Carte : 40vh.
- Barre d'état visible avec le lien AGPL.
- Commits en conventional commits, sans trailer d'attribution.

## Review Focus
- Rotation ou redimensionnement qui fait passer la largeur au-dessus ou en dessous de 768 px : numéros et ordre suivent la disposition du moment.
- Fonction sans carte (GOVT) sur mobile : aucun espace réservé à la carte.
- Visiteur mobile qui avait replié la carte (`mobile-map-collapsed=true` en stockage) : la carte de TOP et CMDTY reste visible.
- Tap sur une touche hors champ (ECO, N, LABS) : la touche active revient dans la vue.
- iPhone avec zone de sécurité en bas : la barre d'état n'est pas masquée par la barre du navigateur.

---

### Task 1 : ordre et numérotation mobiles dans `TerminalGrid`, touche active visible

**Files :**
- Modify : `src/app/terminal-grid.ts`, `src/app/terminal-shell.ts`
- Test : `tests/dom/terminal-grid.test.mts`, `tests/dom/terminal-shell.test.mts`

**Interfaces :**
- Produces : le constructeur `TerminalGrid(main, { lang, onOpen, mobileQuery? })`, où `mobileQuery` vaut par défaut `matchMedia('(max-width: 768px)')` et sert de point d'injection pour les tests. Sous mobile, chaque élément placé reçoit `style.order` = son index dans `fn.mobile`, et `data-bb-n` = cet index + 1. Le shell fait `scrollIntoView({ inline: 'nearest', block: 'nearest' })` sur la touche active dans `setActive`.

- [ ] **Step 1 : tests en échec.** Dans `terminal-grid.test.mts`, ajouter :
```ts
  it('on phones, numbers and orders panels by the mobile order, and follows width changes', () => {
    const main = dom();
    let listener: ((e: { matches: boolean }) => void) | null = null;
    const mq = { matches: true, addEventListener: (_: string, l: (e: { matches: boolean }) => void) => { listener = l; }, removeEventListener: () => {} };
    const grid = new TerminalGrid(main, { lang: 'en', onOpen: () => {}, mobileQuery: mq as unknown as MediaQueryList });
    grid.apply('TOP'); // mobile order: markets, insights, live-news, map, finance-labs
    const insights = main.querySelector<HTMLElement>('[data-panel="insights"]')!;
    const map = main.querySelector<HTMLElement>('#mapSection')!;
    expect(insights.style.order).toBe('1');
    expect(map.style.order).toBe('3');
    expect(insights.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('2');
    expect(map.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('4');
    mq.matches = false; listener!({ matches: false });
    expect(insights.style.order).toBe('');
    expect(insights.querySelector('.panel-title')!.getAttribute('data-bb-n')).toBe('3');
    grid.destroy();
  });
```
Dans `terminal-shell.test.mts`, ajouter :
```ts
  it('brings the active key into view', () => {
    const key = shell.getElement().querySelector<HTMLElement>('.bb-key[data-fn="LABS"]')!;
    const spy = vi.fn();
    key.scrollIntoView = spy;
    shell.setActive('LABS');
    expect(spy).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });
```
- [ ] **Step 2 :** `./selfhost/check.sh npx vitest run --config vitest.dom.config.mts tests/dom/terminal-grid.test.mts tests/dom/terminal-shell.test.mts`. Attendu : FAIL sur les deux nouveaux tests.
- [ ] **Step 3 : implémentation.**
  - **`TerminalGrid` :**
    - `this.mobile = opts.mobileQuery ?? (typeof matchMedia === 'function' ? matchMedia('(max-width: 768px)') : null)` ;
    - un écouteur `change` appelle `refresh()` ;
    - dans `layout`, l'ordre de numérotation vaut `mobile?.matches ? fn.mobile : keys` ;
    - sous mobile, `el.style.order = String(fn.mobile.indexOf(key))` pour les éléments placés ; sinon `el.style.removeProperty('order')` ;
    - `destroy` retire l'écouteur.
  - **`TerminalShell.setActive` :** après la mise à jour de `aria-pressed`, `this.keys.get(code)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })`.
- [ ] **Step 4 :** relancer la commande de l'étape 2. Attendu : PASS.
- [ ] **Step 5 :** `git commit -m "feat(terminal): mobile order and numbering follow the screen width; active key kept in view"`

### Task 2 : retirer la mécanique mobile upstream et habiller le mobile

**Files :**
- Modify : `src/app/panel-layout.ts` (vers 1355-1358 : `setupMobileMapToggle`, `setupMobilePanelNav`)
- Modify : `src/styles/bloomberg-theme.css` (bloc mobile du shell)
- Test : `tests/bloomberg-theme-scope.test.mjs`

- [ ] **Step 1 : test en échec.** Ajouter :
```js
test('mobile shell: no upstream tab bar, stacked flex column, capped panel heights, 11px floor, 40px keys', () => {
  const mobile = css.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/g).join('\n');
  assert.match(mobile, /\.bb-shell :is\(#mobileTabBar, \.mobile-panel-nav, \.map-collapse-btn\)\s*\{[^}]*display:\s*none/);
  assert.match(mobile, /\.bb-shell #main\.main-content\[data-fn\]\s*\{[^}]*flex-direction:\s*column/);
  assert.match(mobile, /\.bb-shell \.main-content\[data-fn\] \.panel:not\(\.hidden\)\s*\{[^}]*max-height:\s*60vh/);
  assert.match(mobile, /\.bb-shell #mapSection:not\(\.hidden\)\s*\{[^}]*height:\s*40vh/);
  assert.match(mobile, /\.bb-shell \.bb-key\s*\{[^}]*min-height:\s*40px/);
  assert.match(mobile, /\[data-variant="finance"\] body\s*\{[^}]*font-size:\s*11px/);
});
```
- [ ] **Step 2 :** `./selfhost/check.sh node --test tests/bloomberg-theme-scope.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 : `panel-layout.ts`.** Remplacer :
```ts
    if (this.ctx.isMobile) {
      this.setupMobileMapToggle();
      this.setupMobilePanelNav();
    }
```
par :
```ts
    // The Terminal shell stacks each function's panels itself: no collapsible map, no category chips.
    if (this.ctx.isMobile && !document.documentElement.classList.contains('bb-shell')) {
      this.setupMobileMapToggle();
      this.setupMobilePanelNav();
    }
    if (document.documentElement.classList.contains('bb-shell')) {
      document.documentElement.classList.remove('wm-map-collapsed');
      document.getElementById('mapSection')?.classList.remove('collapsed');
    }
```
- [ ] **Step 4 : CSS.** Ajouter en fin de `bloomberg-theme.css` un bloc `@media (max-width: 768px)` :
  - **Texte :** `[data-variant="finance"] body { font-size: 11px; }`.
  - **Nav du site :** `.es-nav .es-nav-inner` passe sur une ligne (`flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-block: 6px; gap: 14px; white-space: nowrap`). `.es-nav-links` : `flex-wrap: nowrap; gap: 14px; font-size: 12px`. `.es-nav-mark` : `font-size: 14px; flex: none`.
  - **Masquages :** `:is(#mobileTabBar, .mobile-panel-nav, .map-collapse-btn) { display: none; }`. Le padding inférieur réservé à la barre d'onglets est remis à 0 sur `body` et `#app` (relever la propriété exacte avec `grep -n "58px" src/styles/main.css | head` et annuler celle qui s'applique).
  - **Commande :** `.bb-cmd` : `padding: 4px 10px`. `.bb-clock` : masquer la partie NY. Le shell rend un `span.bb-clock-ny` séparé à partir de cette tâche : modifier `tick()` pour écrire `PAR …` dans `.bb-clock-par` et `· NY …` dans `.bb-clock-ny` ; le test existant lit `.bb-clock` et doit toujours voir les deux. `.bb-clock-ny { display: none; }` sur mobile.
  - **Touches :** `.bb-keys` : `padding: 4px 10px`. `.bb-key` : `min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center`. `.bb-key small { display: none; }`.
  - **Pile :** `#app` : `display: block; height: auto; overflow: visible`. `#main.main-content[data-fn]` : `display: flex; flex-direction: column; gap: 2px; padding: 2px; overflow: visible; height: auto`. `#panelsGrid` : `display: contents`. `.main-content[data-fn] .panel:not(.hidden)` : `max-height: 60vh; min-height: 0 !important; height: auto; display: flex; flex-direction: column; overflow: hidden`, avec `.panel-content` en `overflow: auto; flex: 1 1 auto; min-height: 0`. `#mapSection:not(.hidden)` : `height: 40vh; display: flex; flex-direction: column; border: 1px solid var(--bb-rule)`, avec `#mapContainer` en `flex: 1 1 auto; min-height: 0; height: auto`. `#main[data-fn] #panelsGrid > :not(.bb-placed)` : `display: none`.
  - **Barre d'état :** `.site-footer.es-foot` : `display: block; padding: 0 0 env(safe-area-inset-bottom)`. `.site-footer.es-foot > *` passe en `display: revert` : c'est l'annulation de la règle du sous-projet 1 qui masque tout sauf `.status-panel-container`, en restant scopé `.bb-shell`. `.es-foot-inner` : `flex-wrap: wrap; gap: 4px 12px`.
- [ ] **Step 5 :** `./selfhost/check.sh sh -c "npx tsc --noEmit && node --test tests/bloomberg-theme-scope.test.mjs && npx vitest run --config vitest.dom.config.mts tests/dom/terminal-shell.test.mts tests/dom/terminal-grid.test.mts"`. Attendu : PASS.
- [ ] **Step 6 :** `git commit -m "feat(terminal): mobile function screens — stacked panels, no upstream tab bar or chips, compact nav and keys"`

### Task 3 : audit mobile, prévisualisation, mise en ligne

**Files :** `selfhost/visual/audit.mjs`

- [ ] **Step 1 : audit.** Ajouter une boucle mobile (390×844) sur TOP, GOVT et ECO : capture `m-<code>.png`, puis vérifier :
  - pas de défilement horizontal ;
  - `#mobileTabBar` non visible ;
  - toutes les aires de la fonction présentes et visibles (même calcul que sur bureau, sans la contrainte de défilement de page) ;
  - la hauteur de chaque `.bb-key` ≥ 40 ;
  - la taille de police calculée de `.panel-content` ≥ 11 px ;
  - la barre d'état et le lien AGPL visibles.

  Le contrôle `mobileHeader` existant reste.
- [ ] **Step 2 :** `./selfhost/preview.sh`, puis l'audit sur `http://127.0.0.1:3201/`. Regarder les captures mobiles et retoucher. Commit `fix(terminal): …` par lot.
- [ ] **Step 3 :** `./selfhost/preview.sh stop && sudo docker rmi worldmonitor:preview`. Suite `./selfhost/check.sh sh -c "npx tsc --noEmit && npx vitest run --config vitest.dom.config.mts"`. Puis `git push`, `./selfhost/deploy.sh`, et l'audit de production. Attendu : `ok` partout.

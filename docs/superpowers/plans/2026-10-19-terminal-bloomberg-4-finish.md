# Terminal Bloomberg — sous-projet 4 : finitions — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** terminer la spec et solder les points reportés des revues 1 à 3 :
- graphiques ambre et blanc ;
- carte sans cases de calques ni « Time range » ;
- états indisponibles en ligne `N/A` ;
- accessibilité du shell ;
- adresse normalisée ;
- repli de grille par zone entière ;
- contrastes et couleur de navigateur.

**Architecture :** surtout du CSS (`bloomberg-theme.css`), plus de petites retouches de `terminal-shell.ts` et `terminal-functions.ts` (`collapseAreas`) et une injection de build (`vite.config.ts`, `theme-color`).

**Tech Stack :** CSS, TypeScript, vitest, node:test, Playwright.

**Spec :** `docs/superpowers/specs/2026-10-19-terminal-bloomberg-design.md`, sections 2 (panneaux, graphiques, carte, N/A) et 5.

## Global Constraints
- Scopé finance (`[data-variant="finance"]`, et `.bb-shell` pour le shell). Couleurs `--bb-*` uniquement.
- Les couleurs de gravité ne changent pas ; la heatmap garde son échelle vert/rouge.
- Commits en conventional commits, sans trailer d'attribution.

## Review Focus
- Retour arrière vers une entrée `#govt` en minuscules : un seul changement d'écran, pas d'entrée d'historique en double.
- Lecteur d'écran : « Code inconnu : XYZ » doit être annoncé.
- `prefers-reduced-motion` : le bandeau ne montre pas deux fois les mêmes cotes.
- Panneau en erreur dans un emplacement étroit : la ligne `N/A` tient sans casser la grille.
- GOVT sans la courbe des taux : pas de trou noir, le panneau Fixed Income prend la place.

---

### Task 1 : shell — accessibilité, adresse canonique, un seul changement par navigation

**Files :** modifier `src/app/terminal-shell.ts`. Tests dans `tests/dom/terminal-shell.test.mts`.

- [ ] **Step 1 : tests en échec.**
```ts
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
```
- [ ] **Step 2 :** `./selfhost/check.sh npx vitest run --config vitest.dom.config.mts tests/dom/terminal-shell.test.mts`. Attendu : FAIL.
- [ ] **Step 3 : implémentation.**
  - **Aide liée au champ :** `this.help.id = 'bb-help'` ; `input` porte `aria-controls="bb-help"` et `aria-expanded`, que `run` et `hideHelp` tiennent à jour.
  - **Annonce :** `helpMsg` a `role="status"`.
  - **Navigation** (`onLocation`) :
    - `const code = functionFromHash(location.hash)` ;
    - si `location.hash !== '#' + code`, faire `history.replaceState(history.state, '', '#' + code)` ;
    - si `code === this.active`, ne rien faire ;
    - sinon `this.open(code, false)`.
  - **Code actif :** `setActive` mémorise `this.active`.
  - **`open(code, push)` :** n'appelle `onOpen` que si `code !== this.active` ou si `push` (clic explicite) ; dans les deux cas il met à jour l'adresse et la touche. Le test existant « a key click opens the function » reste valide.
- [ ] **Step 4 :** relancer la commande de l'étape 2. Attendu : PASS, tous les tests du fichier.
- [ ] **Step 5 :** `git commit -m "fix(terminal): announce unknown codes, canonical #CODE address, one screen change per navigation"`

### Task 2 : `collapseAreas` cède une zone entière à un voisin qui partage une arête complète

**Files :** modifier `src/config/terminal-functions.ts`. Test dans `tests/dom/terminal-functions.test.mts`.

- [ ] **Step 1 : test en échec.**
```ts
  it('hands a whole missing area to a neighbour sharing its full edge before going cell by cell', () => {
    expect(collapseAreas(['y y c', 'b b c'], new Set(['b', 'c']))).toEqual(['b b c', 'b b c']);
    expect(collapseAreas(['a x', 'a x'], new Set(['a']))).toEqual(['a a', 'a a']);
  });
```
- [ ] **Step 2 :** même commande sur `tests/dom/terminal-functions.test.mts`. Attendu : FAIL sur le premier cas.
- [ ] **Step 3 : implémentation.** Avant la boucle cellule par cellule, pour chaque nom absent :
  - calculer sa boîte englobante ;
  - pour chaque côté (gauche, droite, dessus, dessous), lire les cellules adjacentes tout le long de l'arête ;
  - si elles portent toutes le même nom présent `p`, et que remplacer les cellules de l'absent par `p` laisse la grille rectangulaire, faire ce remplacement et passer au nom suivant.

  Les absents qui restent passent ensuite par le traitement cellule par cellule existant.
- [ ] **Step 4 :** relancer. Attendu : PASS, avec les anciens cas inchangés.
- [ ] **Step 5 :** `git commit -m "fix(terminal): a missing panel hands its whole area to a neighbour sharing its edge"`

### Task 3 : CSS — graphiques, carte, N/A, bandeau, contrastes, points

**Files :** modifier `src/styles/bloomberg-theme.css` et `vite.config.ts` (`theme-color` du build finance). Tests : `tests/bloomberg-theme-scope.test.mjs` et `tests/sabathier-critical-css.test.mjs`.

- [ ] **Step 1 : tests en échec** (dans `bloomberg-theme-scope.test.mjs`) :
```js
test('finish: amber/white yield curve, no map layer boxes or time range in the shell, N/A error line, ticker pauses on focus', () => {
  assert.match(css, /\[data-variant="finance"\] \.yield-curve-panel? [^{]*\[stroke="#3498db"\][^{]*\{[^}]*stroke:\s*var\(--bb-amber\)/);
  assert.match(css, /\[stroke="#2ecc71"\][^{]*\{[^}]*stroke:\s*var\(--bb-value\)/);
  assert.match(css, /\.bb-shell :is\(\.layer-toggles, \.time-slider\)\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.panel-error-state\s*\{[^}]*flex-direction:\s*row/);
  assert.match(css, /\.panel-error-radar\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.es-syn:is\(:hover, :focus-within\) \.es-syn-track\s*\{[^}]*animation-play-state:\s*paused/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*\.es-syn-group\[aria-hidden="true"\]\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /\[class\*="-dot"\]/);
  assert.match(css, /--text-ghost:\s*#7a7a7a;/);
});
```
Et dans `tests/sabathier-critical-css.test.mjs` :
```js
test('the finance build paints the browser chrome black before JS runs', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(vite, /activeVariant === 'finance'[\s\S]{0,400}theme-color" content="#000000"/);
});
```
- [ ] **Step 2 :** `./selfhost/check.sh node --test tests/bloomberg-theme-scope.test.mjs tests/sabathier-critical-css.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 : CSS.**
  - **Racine du panneau de courbe :** relever la classe de la racine de `YieldCurvePanel` avec `grep -n "className\|super({" src/components/YieldCurvePanel.ts | head`. Utiliser `[data-variant="finance"] [data-panel="yield-curve"]` si aucune classe dédiée n'existe, et adapter alors le premier motif du test à ce sélecteur (en le consignant dans le registre).
  - **Courbe :**
    - `… [stroke="#3498db"] { stroke: var(--bb-amber); }` et `… [fill="#3498db"] { fill: var(--bb-amber); }` ;
    - `… [stroke="#2ecc71"] { stroke: var(--bb-value); }` et `… [fill="#2ecc71"] { fill: var(--bb-value); }`.
    - Les pastilles de légende sont des `<line stroke=…>` dans le même panneau : couvertes par les mêmes règles.
  - **Carte du shell :** `:root[data-variant="finance"].bb-shell :is(.layer-toggles, .time-slider) { display: none; }`. La `.map-legend` reste ; la rendre compacte avec `font-size: 10px; padding: 2px 6px; background: rgba(0, 0, 0, .8); border: 1px solid var(--bb-rule)`.
  - **N/A :**
    - `[data-variant="finance"] .panel-error-state { flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; padding: 6px 8px; min-height: 0; }` ;
    - `[data-variant="finance"] .panel-error-radar { display: none; }` ;
    - `[data-variant="finance"] .panel-error-msg::before { content: "N/A — "; color: var(--bb-dim); }` ;
    - `[data-variant="finance"] .panel-error-msg { color: var(--bb-dim); font-size: 11px; }`.
  - **Bandeau :** remplacer la règle de pause au survol par `.es-syn:is(:hover, :focus-within) .es-syn-track { animation-play-state: paused; }`. Dans le bloc `prefers-reduced-motion`, ajouter `.es-syn-group[aria-hidden="true"] { display: none; }`.
  - **Points ronds :** remplacer `[class*="-dot"]` par la liste explicite `.status-dot, .panel-severity-dot, .live-dot, .legend-dot, .bb-live-dot, .insight-sentiment-dot, .sector-dot, .wc-dot, .cp-chip-dot, .risk-source-dot`.
  - **Contrastes :** `--text-faint: #8a8a8a;` et `--text-ghost: #7a7a7a;`.
- [ ] **Step 4 : `vite.config.ts`.** Dans le bloc `if (activeVariant === 'finance') {`, ajouter en tête :
```ts
        // Always-dark Terminal: paint the browser chrome black from the first byte.
        result = result.replace(/<meta name="theme-color" content=".*?" \/>/, '<meta name="theme-color" content="#000000" />');
```
- [ ] **Step 5 :** relancer la commande de l'étape 2, plus `npx tsc --noEmit`. Attendu : PASS.
- [ ] **Step 6 :** `git commit -m "feat(theme): amber and white charts, lighter map, N/A error lines, ticker pauses on focus, contrast and chrome colour"`

### Task 4 : prévisualisation, mise en ligne, audit

- [ ] **Step 1 :** `./selfhost/preview.sh`, audit sur `http://127.0.0.1:3201/`, puis vérification des captures GOVT (courbe ambre et blanche), TOP et CMDTY (carte sans cases de calques) et d'un panneau en erreur. Retouches éventuelles avec un commit `fix(theme): …`.
- [ ] **Step 2 :** arrêter la prévisualisation, supprimer l'image, puis `sudo docker builder prune --all -f` (disque).
- [ ] **Step 3 :** suite complète `./selfhost/check.sh sh -c "npx tsc --noEmit && npx vitest run --config vitest.dom.config.mts"`, puis `git push`, `./selfhost/deploy.sh`, `sudo docker builder prune --all -f` et l'audit de production. Attendu : 16 lignes `ok`.

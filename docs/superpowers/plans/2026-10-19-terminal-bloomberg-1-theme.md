# Terminal Bloomberg — sous-projet 1 : thème noir/ambre — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre le Terminal actuel noir/ambre façon Bloomberg classique, en IBM Plex Mono et toujours sombre, sans
encore toucher à la mise en page (onglets, grille).

**Architecture :** un nouveau fichier `src/styles/bloomberg-theme.css` remplace `sabathier-theme.css` pour la variante
finance. Il garde l'import des jetons du site, utiles pour la nav commune. Le thème est forcé en sombre à trois
niveaux : script de pré-peinture, `theme-manager.ts` et CSS critique inline. La carte reçoit une palette noire
aux frontières ambre.

**Tech Stack :** CSS non « layered », Vite, TypeScript, vitest (dom), node:test, Playwright (audit).

**Spec :** `docs/superpowers/specs/2026-10-19-terminal-bloomberg-design.md`, section 2.

## Global Constraints
- Toutes les règles du thème sont scopées `[data-variant="finance"]` ou `:root[data-variant="finance"]` ; les autres variantes ne changent pas.
- Couleurs exactes : fond `#000000`, filets `#333333`, ambre `#fb8b1e`, valeurs `#ffffff`, secondaire `#8a8a8a`, hausse `#4af626`, baisse `#ff3b3b`, bandeau titre `#1c3d7a`, touche inactive `#2a2a2a`, champ `#1a1a1a`.
- Les couleurs de gravité (`--semantic-critical|high|elevated|normal|low|info`, `--threat-*`, `--defcon-*`) ne sont pas redéfinies.
- Police IBM Plex Mono (OFL), 400/500/600, auto-hébergée sous `public/site-fonts/` ; aucune requête vers un CDN de polices à l'exécution.
- La nav commune (`.es-nav`) garde Public Sans.
- Le lien « Licence et source (AGPL-3.0) » reste dans le pied de page.
- Tests via `./selfhost/check.sh …`, puis `sudo docker rmi worldmonitor-check:latest` à la fin de la session (disque à ~90 %).
- Commits en conventional commits, sans trailer d'attribution (règle du projet).

## Review Focus
- Visiteur qui avait choisi « Thème : clair » sur le site (cookie `es-theme=light`) : le Terminal doit quand même s'afficher en noir dès la première peinture, sans flash clair.
- Bouton « Thème » de la nav sur le Terminal : il doit continuer à changer le cookie partagé, pour le reste du site, sans jamais rendre le Terminal clair.
- Panneaux qui colorent en JS à partir des variables CSS (`theme-colors.ts`) : ils doivent prendre les nouvelles couleurs après le forçage sombre, sans valeur claire en cache.
- Texte RTL/CJK : les polices de repli restent après la famille mono.
- Mobile 390 px : aucun défilement horizontal introduit par la police à chasse fixe (titres longs).

---

### Task 1 : forcer le thème sombre sur la variante finance

**Files :**
- Modify : `shared/variant-prepaint.mjs`
- Modify : `src/utils/theme-manager.ts` (`resolveThemeColor`, `applyTheme`, `applyStoredTheme`)
- Test : `tests/variant-prepaint-bake.test.mjs`, `tests/dom/theme-sabathier.test.mts`

**Interfaces :**
- Produces : `bakeVariantIntoPrepaint(html, 'finance')` produit un script qui pose `data-theme="dark"` quel que soit le stockage. Côté `theme-manager`, `data-theme` vaut toujours `dark` quand `data-variant="finance"`, alors que `getThemePreference()` et le cookie gardent le choix du visiteur.

- [ ] **Step 1 : tests en échec.** Dans `tests/variant-prepaint-bake.test.mjs`, remplacer l'assertion `dataset.theme, 'light'` du premier test par :
```js
  assert.equal(dataset.theme, 'dark'); // the Terminal is always dark, whatever the stored choice
```
et ajouter :
```js
test('other non-full variants still honour the stored theme', () => {
  const { dataset } = run(prepaint(bakeVariantIntoPrepaint(indexHtml, 'tech')), { 'worldmonitor-theme': 'light' });
  assert.equal(dataset.theme, 'light');
});
```
Dans `tests/dom/theme-sabathier.test.mts`, remplacer le test « paints the site paper colour… » par :
```ts
  it('stays dark whatever the preference, and keeps the choice for the rest of the site', () => {
    setThemePreference('light');
    expect(getCurrentTheme()).toBe('dark');
    expect(getThemePreference()).toBe('light');
    expect(document.cookie).toContain('es-theme=light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#000000');
    document.cookie = 'es-theme=light; Path=/';
    applyStoredTheme();
    expect(getCurrentTheme()).toBe('dark');
  });

  it('other variants still switch to light', () => {
    document.documentElement.dataset.variant = 'full';
    setThemePreference('light');
    expect(getCurrentTheme()).toBe('light');
  });
```
- [ ] **Step 2 : vérifier l'échec.** Run : `./selfhost/check.sh sh -c "node --test tests/variant-prepaint-bake.test.mjs; npx vitest run --config vitest.dom.config.mts tests/dom/theme-sabathier.test.mts"`. Attendu : FAIL sur `'dark'`.
- [ ] **Step 3 : implémentation.** Dans `shared/variant-prepaint.mjs`, après le remplacement existant, pour la finance seulement :
```js
export function bakeVariantIntoPrepaint(html, variant) {
  if (variant === 'full') return html;
  let out = html.replace(
    /if\(v\)document\.documentElement\.dataset\.variant=v;else document\.documentElement\.removeAttribute\('data-variant'\);/,
    `v='${variant}';document.documentElement.dataset.variant=v;`,
  );
  // Sabathier Terminal (finance): Bloomberg-style, always dark whatever the visitor chose for the site.
  if (variant === 'finance') out = out.replace("var t=localStorage.getItem('worldmonitor-theme');", "var t='dark';");
  return out;
}
```
Dans `src/utils/theme-manager.ts` :
```ts
// Sabathier Terminal (finance): always dark (Bloomberg look); the stored preference still drives the site.
function effectiveTheme(theme: Theme, variant = document.documentElement.dataset.variant): Theme {
  return variant === 'finance' ? 'dark' : theme;
}
```
`resolveThemeColor` : la branche finance renvoie `'#000000'`. `applyTheme(theme)` commence par
`theme = effectiveTheme(theme);`. Dans `applyStoredTheme`, `document.documentElement.dataset.theme = effectiveTheme(effective, variant);`
et `updateThemeMetaColor(effectiveTheme(effective, variant), variant);`.
- [ ] **Step 4 : vérifier le succès** avec la même commande. Attendu : PASS, tous les tests des deux fichiers.
- [ ] **Step 5 : commit.** `git add shared/variant-prepaint.mjs src/utils/theme-manager.ts tests/variant-prepaint-bake.test.mjs tests/dom/theme-sabathier.test.mts && git commit -m "feat(theme): the Terminal is always dark, the site keeps the visitor's choice"`

### Task 2 : police IBM Plex Mono auto-hébergée

**Files :**
- Create : `public/site-fonts/ibm-plex-mono-latin-{400,500,600}-normal.woff2`
- Modify : `public/site-fonts/OFL.txt` (ajouter le copyright IBM Plex)

- [ ] **Step 1 : téléchargement.** `for w in 400 500 600; do curl -fsSL -o public/site-fonts/ibm-plex-mono-latin-$w-normal.woff2 https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-$w-normal.woff2; done`
- [ ] **Step 2 : vérification.** `file public/site-fonts/ibm-plex-mono-*` doit annoncer « Web Open Font Format (Version 2) », chaque fichier faisant de 10 à 40 Ko.
- [ ] **Step 3 : licence.** Ajouter en tête de `OFL.txt` la ligne `IBM Plex Mono: Copyright © 2017 IBM Corp. with Reserved Font Name "Plex".` (le texte OFL 1.1 qui suit couvre les trois familles).
- [ ] **Step 4 : commit.** `git add public/site-fonts && git commit -m "feat(theme): self-host IBM Plex Mono (OFL)"`

### Task 3 : `bloomberg-theme.css` remplace `sabathier-theme.css`

**Files :**
- Create : `src/styles/bloomberg-theme.css`
- Delete : `src/styles/sabathier-theme.css`
- Modify : `src/main.ts:29-32`, `vite.config.ts:281-285`
- Rename + modify : `tests/sabathier-theme-scope.test.mjs` → `tests/bloomberg-theme-scope.test.mjs` ; `tests/sabathier-critical-css.test.mjs`

**Interfaces :**
- Produces : les variables `--bb-bg`, `--bb-rule`, `--bb-amber`, `--bb-value`, `--bb-dim`, `--bb-up`, `--bb-down`, `--bb-band`, `--bb-key`, `--bb-input` et `--bb-mono` sur `:root[data-variant="finance"]`. Les sous-projets 2 à 4 les réutilisent.

- [ ] **Step 1 : tests en échec.** `git mv tests/sabathier-theme-scope.test.mjs tests/bloomberg-theme-scope.test.mjs`. Dans ce fichier :
  - lire `../src/styles/bloomberg-theme.css` ;
  - garder les tests « imports the generated tokens first », « every rule is scoped… », « maps the main Terminal variables… », « severity colours… », « the active-state restyle… » et « the coverage row… » ;
  - remplacer le test `main.ts` par la regex `/SITE_VARIANT === 'finance'[\s\S]{0,200}loadVariantThemeStylesheet\('finance', \(\) => import\('\.\/styles\/bloomberg-theme\.css'\)\)/` ;
  - ajouter :
```js
test('Bloomberg palette and mono font', () => {
  for (const [v, val] of [['--bb-bg', '#000000'], ['--bb-amber', '#fb8b1e'], ['--bb-value', '#ffffff'], ['--bb-up', '#4af626'], ['--bb-down', '#ff3b3b'], ['--bb-band', '#1c3d7a'], ['--bb-rule', '#333333']]) {
    assert.match(css, new RegExp(`${v}:\\s*${val};`), v);
  }
  assert.match(css, /@font-face\s*\{[^}]*IBM Plex Mono[^}]*ibm-plex-mono-latin-400-normal\.woff2/);
  assert.match(css, /--font-mono:\s*var\(--bb-mono\)/);
});
```
Le test « every rule is scoped » doit ignorer les blocs `@font-face` : avant l'extraction des sélecteurs, ajouter `.replace(/@font-face\s*\{[^}]*\}/g, '')`.
Dans `tests/sabathier-critical-css.test.mjs` :
  - lire `bloomberg-theme.css` ;
  - remplacer l'assertion `--bg: var(--paper)` par `/:root\[data-variant="finance"\]\s*\{[^}]*--bb-bg:\s*#000000/` ;
  - supprimer l'assertion `[data-theme="dark"]` sur la finance, puisqu'il n'y a plus de bloc sombre séparé ;
  - garder les autres assertions.
- [ ] **Step 2 : vérifier l'échec.** `./selfhost/check.sh node --test tests/bloomberg-theme-scope.test.mjs tests/sabathier-critical-css.test.mjs`. Attendu : FAIL (fichier absent).
- [ ] **Step 3 : écrire `src/styles/bloomberg-theme.css`.** Le fichier commence par :
```css
@import './sabathier-tokens.css';

/* Bloomberg-style theme of Sabathier Terminal (finance variant, emiliensabathier.fr): classic black and
   amber, IBM Plex Mono, always dark. Maps World Monitor's variables onto the --bb- palette and restyles
   the chrome. Unlayered, like happy-theme.css, so it wins over the layered base. Severity colours are
   deliberately untouched. The site nav keeps the shared tokens (dark set, forced by theme-manager). */

@font-face { font-family: "IBM Plex Mono"; font-weight: 400; font-display: swap;
  src: url("/site-fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; font-display: swap;
  src: url("/site-fonts/ibm-plex-mono-latin-500-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 600; font-display: swap;
  src: url("/site-fonts/ibm-plex-mono-latin-600-normal.woff2") format("woff2"); }

:root[data-variant="finance"] {
  --bb-bg: #000000;
  --bb-rule: #333333;
  --bb-amber: #fb8b1e;
  --bb-value: #ffffff;
  --bb-dim: #8a8a8a;
  --bb-up: #4af626;
  --bb-down: #ff3b3b;
  --bb-band: #1c3d7a;
  --bb-key: #2a2a2a;
  --bb-input: #1a1a1a;
  --bb-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Noto Sans", "Noto Sans Arabic", "Noto Sans CJK SC", monospace;
  --bg: var(--bb-bg);
  --bg-secondary: #0a0a0a;
  --surface: var(--bb-bg);
  --surface-hover: #111111;
  --surface-active: #1a1a1a;
  --border: var(--bb-rule);
  --border-strong: #4a4a4a;
  --border-subtle: #1f1f1f;
  --text: var(--bb-amber);
  --text-secondary: var(--bb-value);
  --text-dim: var(--bb-dim);
  --text-muted: var(--bb-dim);
  --text-faint: #6a6a6a;
  --text-ghost: #555555;
  --accent: var(--bb-amber);
  --input-bg: var(--bb-input);
  --panel-bg: var(--bb-bg);
  --panel-border: var(--bb-rule);
  --scrollbar-thumb: #3a3a3a;
  --scrollbar-thumb-hover: #5a5a5a;
  --green: var(--bb-up);
  --red: var(--bb-down);
  --semantic-positive: var(--bb-up);
  --status-live: var(--bb-up);
  --font-body-base: var(--bb-mono);
  --font-mono: var(--bb-mono);
  --map-bg: #000000;
  --map-grid: #000000;
  --map-country: #141414;
  --map-stroke: #5a3a10;
}
```
Puis les blocs suivants, tous scopés `[data-variant="finance"]`. On reprend chaque bloc de l'ancien
`sabathier-theme.css`, en remplaçant `--paper` par `--bb-bg`, `--ink` par `--bb-amber` ou `--bb-value`
selon le rôle, `--pen` par `--bb-amber`, `--muted` par `--bb-dim` et `--rule` par `--bb-rule` :
  - **Base :**
    `[data-variant="finance"] body { background: var(--bb-bg); color: var(--bb-amber); font-family: var(--bb-mono); font-size: 12px; line-height: 1.33; font-variant-numeric: tabular-nums; }`
  - **Nav :** on garde `position: relative; z-index: 20`.
    `[data-variant="finance"] .es-nav { background: var(--bb-bg); border-bottom-color: var(--bb-rule); }`
    `[data-variant="finance"] .es-nav .es-nav-inner { padding-block: 4px; }`. La police reste celle des jetons.
  - **Barre d'outils `.header` :** fond noir, filet `#333`. On garde la règle qui masque logo, version, crédit,
    GitHub, embed et TV.
  - **Panneaux :**
    - `.panel` : fond noir, `border: 0`, `border-radius: 0`, `box-shadow: none`.
    - `.panels-grid` et `#mapBottomGrid` : `gap: 2px; background: var(--bb-rule);`.
    - `.panel-header` : `background: var(--bb-band); border: 0; min-height: 22px; padding: 1px 6px;`.
    - `.panel-title` : `font-family: var(--bb-mono); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .02em; color: #fff;`.
    - `.panel-content` : `color: var(--bb-amber);`.
    - Boutons de l'en-tête de panneau (tout `button` dans `.panel-header`) : texte blanc, fond transparent, sans bordure ni arrondi.
  - **Contrôles :** la règle d'état actif de l'ancien fichier, avec le même sélecteur. Elle passe en `color: #000; background-color: var(--bb-amber); border-color: var(--bb-amber);`. Pour tous les contrôles de `.header` et `.panel-header` : `font-family: var(--bb-mono); border-radius: 0; text-transform: uppercase;`.
  - **Onglets (provisoire jusqu'au sous-projet 2) :**
    - `#panelTabsMount .dashboard-tab` : `background: var(--bb-key); color: var(--bb-amber); border: 0; border-radius: 0; font-family: var(--bb-mono); font-weight: 600; text-transform: uppercase;`.
    - Onglet actif (`.active` ou `[aria-selected="true"]`) : `background: var(--bb-amber); color: #000;`.
  - **Bande de synthèse :** reprendre les règles `.es-syn*` avec fond noir, libellés ambre (`.es-syn-k`), valeurs blanches (`.es-syn-v` ou le texte de l'item), `.es-syn-c.up` `var(--bb-up)`, `.es-syn-c.down` `var(--bb-down)`, et `.es-syn-brief` en `#ddd`.
  - **Liens labs :** `.es-lab-link a { color: var(--bb-amber); text-decoration: underline; }`.
  - **Pied de page :** `.site-footer.es-foot { background: var(--bb-bg); border-top: 1px solid var(--bb-rule); color: var(--bb-dim); }`. Les liens du pied de page sont en ambre. On garde à l'identique les règles mobile et `.digest-coverage-row`.
  - **Flash « nouveau » :** `box-shadow: 0 0 0 1px var(--bb-amber);`.
  - **Petits libellés en capitales :** couleur `var(--bb-dim)`.
  - **Surfaces Pro :** recopier la règle de masquage à l'identique.
  - **Arrondis :** `[data-variant="finance"] :is(.panel, .panel *, .header *, .dashboard-tab, input, select, button):not(.es-nav *) { border-radius: 0; }`. Les points ronds (`.status-dot`, `.panel-severity-dot`, marqueurs de carte) gardent leur `border-radius: 50%` : ajouter une règle de rétablissement pour ces sélecteurs.
  - **Hausse et baisse :** `[data-variant="finance"] :is(.positive, .up, .change-positive) { color: var(--bb-up); }` et l'équivalent baisse avec `var(--bb-down)`. Les classes réelles sont à vérifier par `grep -o "class=\"[a-z-]*\(positive\|negative\|up\|down\)[a-z-]*\"" -r src/components | sort -u` ; ne garder que celles qui existent.
  - **Valeurs :** `[data-variant="finance"] :is(.price, .value, .market-price, .quote-price) { color: var(--bb-value); }`, après la même vérification des classes existantes.
- [ ] **Step 4 : brancher le fichier.**
  - `src/main.ts` : `void loadVariantThemeStylesheet('finance', () => import('./styles/bloomberg-theme.css'));` avec le commentaire « Bloomberg-style theme for the emiliensabathier.fr deployment ».
  - `vite.config.ts` : lire `src/styles/bloomberg-theme.css` à la place de `sabathier-theme.css`.
  - `git rm src/styles/sabathier-theme.css`.
  - Dans `shared/sabathier-critical.mjs`, remplacer la dernière ligne de `picked` par
    `'[data-variant="finance"] body{background:#000;color:#fb8b1e}'`.
  - Vérifier par `grep -rn "sabathier-theme" src shared vite.config.ts tests selfhost` qu'il ne reste aucune référence.
- [ ] **Step 5 : vérifier le succès.** `./selfhost/check.sh sh -c "node --test tests/bloomberg-theme-scope.test.mjs tests/sabathier-critical-css.test.mjs && npx tsc --noEmit"`. Attendu : PASS, et tsc sans erreur.
- [ ] **Step 6 : commit.** `git add -A src/styles src/main.ts vite.config.ts shared/sabathier-critical.mjs tests && git commit -m "feat(theme): Bloomberg black and amber theme replaces the editorial Terminal theme"`

### Task 4 : carte noire aux frontières ambre

**Files :**
- Modify : `scripts/build-sabathier-map-styles.mjs` (`PALETTES.dark`)
- Regenerate : `public/map-styles/sabathier-dark.json`
- Test : `tests/sabathier-map-styles.test.mjs`

- [ ] **Step 1 : test en échec.** Ajouter :
```js
test('dark: Bloomberg map, black water, near-black land, dim amber borders', () => {
  assert.deepEqual(PALETTES.dark, { land: '#141414', water: '#000000', border: '#5a3a10', road: '#1f1f1f', label: '#8a6a3a', halo: '#000000' });
});
```
- [ ] **Step 2 :** `./selfhost/check.sh node --test tests/sabathier-map-styles.test.mjs`. Attendu : FAIL.
- [ ] **Step 3 :** remplacer `PALETTES.dark` par la valeur du test. Mettre à jour le test « city dots… halo matches the land » : en sombre, le halo vaut `#000000`, donc l'assertion devient « le halo vaut `PALETTES[theme].halo` ». Lancer `node scripts/build-sabathier-map-styles.mjs`.
- [ ] **Step 4 :** relancer la commande de l'étape 2. Attendu : PASS.
- [ ] **Step 5 :** `git add scripts/build-sabathier-map-styles.mjs public/map-styles/sabathier-dark.json tests/sabathier-map-styles.test.mjs && git commit -m "feat(theme): black and amber basemap for the Terminal"`

### Task 5 : audit visuel adapté, prévisualisation et retouches

**Files :**
- Modify : `selfhost/visual/audit.mjs`
- Modify : `src/styles/bloomberg-theme.css` (retouches)

- [ ] **Step 1 : adapter l'audit.** Dans `audit.mjs` :
  - les schémas de couleur `light` et `dark` restent tous deux testés ;
  - nouveau contrôle : `getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'` dans les deux cas (`bodyBlack`) ;
  - le contrôle « pas de monospace » est supprimé ;
  - le contrôle Source Serif sur `.panel-title` devient `/IBM Plex Mono/` ;
  - le contrôle « pas de vert vif dans le chrome » est supprimé, puisque `#4af626` est désormais la couleur de hausse ;
  - les autres contrôles restent : nav, défilement horizontal, synthèse ≥ 5, 6 onglets, liens labs, header mobile masqué ;
  - ajouter : le lien `a[href$="/labs/source.txt"]` est présent (`agpl`).
- [ ] **Step 2 : prévisualiser.** `./selfhost/preview.sh`, puis `node selfhost/visual/audit.mjs http://127.0.0.1:3201/ <scratch>/p1`. Si les ressources ne se chargent pas à la racine (base `/terminal/`), lancer l'audit sur `http://127.0.0.1:3201/terminal/`. Attendu : `ok` pour les 4 combinaisons.
- [ ] **Step 3 : revue à l'œil des 4 captures.** Corriger dans `bloomberg-theme.css` tout ce qui reste clair, arrondi, vert upstream, illisible (ambre sur bleu…) ou débordant. Relancer le build de prévisualisation et l'audit jusqu'à un rendu net. Commit à chaque lot de retouches : `fix(theme): …`.
- [ ] **Step 4 : arrêter la prévisualisation.** `./selfhost/preview.sh stop`, puis `sudo docker rmi worldmonitor:preview`.
- [ ] **Step 5 : commit de l'audit.** `git add selfhost/visual/audit.mjs && git commit -m "chore(selfhost): audit checks the Bloomberg theme"`

### Task 6 : vérification complète et mise en ligne

- [ ] **Step 1 :** `./selfhost/check.sh sh -c "npx tsc --noEmit && node --test tests/*.test.mjs && npx vitest run --config vitest.dom.config.mts"`. Attendu : tout passe. En cas d'échec d'un test upstream sans rapport, comparer avec `git stash` et le commit de départ `e364d9db2` pour confirmer qu'il échouait déjà ; sinon, corriger.
- [ ] **Step 2 :** `git push`, puis `./selfhost/deploy.sh`.
- [ ] **Step 3 :** `node selfhost/visual/audit.mjs https://emiliensabathier.fr/terminal/ <scratch>/prod1`. Attendu : `ok` ×4 ; vérifier les captures à l'œil.
- [ ] **Step 4 :** `sudo docker rmi worldmonitor-check:latest`, puis vérifier le disque avec `df -h /`.

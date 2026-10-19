# Sabathier Terminal façon Bloomberg — design

Date : 2026-10-19. Statut : validé en brainstorming, à relire.

## 1. Intention

Refondre entièrement l'ergonomie et l'esthétique du Terminal (emiliensabathier.fr/terminal/, variante finance du fork)
sur le modèle du terminal Bloomberg, look compris.

- **Public prioritaire : recruteurs en finance.** En quelques secondes, ils doivent reconnaître l'univers Bloomberg
  (noir, ambre, densité, codes de fonction) et pouvoir naviguer sans mode d'emploi.
- **Rupture assumée** avec l'identité claire du site (papier/encre, serif) pour le Terminal seul. La nav commune
  du site reste, en version sombre. Les jetons du site (`sabathier-tokens.css`) ne changent pas.
- **Mobile soigné à part entière.**

### Critères de succès
1. Un recruteur reconnaît immédiatement l'univers Bloomberg.
2. Chaque écran tient sans défilement de page ni panneau vide sur 1440×900, et reste lisible à 390 px.
3. On change d'écran en un clic ou en tapant un code, sans rien deviner.
4. Le nouvel audit visuel passe.

### Hors périmètre
- Nouvelles sources de données : on garde les données et les panneaux existants.
- Mode clair : le Terminal est noir quel que soit le réglage « Thème » du site.
- Personnalisation par le visiteur : les écrans sont figés.

## 2. Système visuel (sous-projet 1)

### Couleurs
Variables propres au Terminal, préfixe `--bb-`, définies dans un nouveau fichier `src/styles/bloomberg-theme.css`
qui remplace `sabathier-theme.css` pour la variante finance.

| Rôle | Valeur |
|---|---|
| Fond | `#000000` |
| Filets, séparations | `#333333` |
| Texte de base, libellés | ambre `#fb8b1e` |
| Valeurs | `#ffffff` |
| Texte secondaire | `#8a8a8a` |
| Hausse | `#4af626` |
| Baisse | `#ff3b3b` |
| Bandeau de titre de panneau | fond `#1c3d7a`, texte `#ffffff` |
| Touche active | fond `#fb8b1e`, texte `#000000` |
| Touche inactive | fond `#2a2a2a`, texte `#fb8b1e` |
| Champ de commande | fond `#1a1a1a`, texte `#ffffff` |

- Les couleurs de gravité (alertes, événements de la carte) ne changent pas.
- Les variables upstream (`--bg`, `--surface`, `--text`, `--green`, `--red`, `--accent`, `--map-*`…) sont mappées
  sur ces valeurs, comme le fait aujourd'hui `sabathier-theme.css`.
- Sur la page du Terminal, le document est forcé en `data-theme="dark"` quel que soit le choix du visiteur.
  Le sélecteur « Thème » de la nav reste présent, car il agit sur le reste du site.

### Typographie
- **IBM Plex Mono** (SIL OFL 1.1), graisses 400/500/600, sous-ensemble latin, auto-hébergée dans
  `public/site-fonts/` avec mise à jour de `OFL.txt`.
- Utilisée partout dans le Terminal : chiffres, libellés, titres. Base 12 px sur ordinateur, 11 px sur mobile.
  Interligne 1.3 à 1.35. Chiffres tabulaires.
- La nav commune garde Public Sans, en couleurs sombres.
- Les écritures non latines (RTL, CJK) gardent leurs polices de repli actuelles.

### Panneaux
- Ni arrondi, ni ombre, ni dégradé. Les panneaux sont séparés par un espacement de 2 px sur fond `#333`.
- En-tête : bandeau bleu plein, titre en capitales. Le numéro d'ordre « 1) » devant le titre et le code de la
  fonction liée en ambre à droite (cliquable, par exemple `WEI` sur « Indices clés » dans TOP) arrivent avec le
  shell (sous-projet 2), car ils dépendent des fonctions. Les boutons upstream
  de l'en-tête de panneau sont masqués : déplacer, agrandir, fermer, réglages, aide « ? ».
- Corps : tableaux denses, lignes de 18 à 20 px, libellés ambre et valeurs blanches.
- Graphiques (courbe des taux, sparklines, heatmap) : tracés ambre ou blanc, axes et grilles gris. La heatmap
  garde une échelle vert/rouge, désaturée vers le noir.
- Carte : océans `#000`, terres `#141414`, frontières ambre éteint `#5a3a10`, points en couleurs de gravité.
  Les cases à cocher des calques en capitales sont remplacées par une légende compacte. La frise
  d'icônes à gauche et le panneau « Time range » sont masqués.
- Données indisponibles : une ligne grise `N/A` à la place du bloc vide ou du squelette de chargement prolongé.

## 3. Shell des fonctions sur ordinateur (sous-projet 2)

### Structure de la page (au-delà de 768 px)
1. **Nav du site**, sombre et fine (environ 32 px).
2. **Ligne de commande** : `>`, un champ de saisie, l'invite « Tapez un code ou cliquez une touche » /
   « Type a code or click a key », et les horloges `PAR hh:mm:ss · NY hh:mm:ss` à droite.
3. **Rangée de touches** : 8 touches, code en gras et libellé dessous.
4. **Bandeau de cotes** défilant en continu, en pause au survol et quand `prefers-reduced-motion` est actif.
5. **Écran de la fonction** : grille fixe qui remplit la hauteur restante. La page ne défile pas ; un panneau
   trop long défile à l'intérieur.
6. **Barre d'état** : `● LIVE` (l'indicateur existant), heure de la dernière mise à jour des cotes, lien
   « Licence et source (AGPL-3.0) » vers `/labs/source.txt`. Ce lien est obligatoire.

### Fonctions
Libellés FR / EN. La composition et les proportions ci-dessous servent de point de départ et seront
ajustées après l'audit visuel. La liste des panneaux par fonction, elle, est arrêtée.

| Code | Libellé FR / EN | Grille ordinateur (`grid-template-areas`) | Ordre mobile |
|---|---|---|---|
| TOP | Vue d'ensemble / Overview | `"markets map insights" "markets live-news finance-labs"`, colonnes 1.1fr 1.4fr 1fr | markets, insights, live-news, map, finance-labs |
| WEI | Actions / Equities | `"markets heatmap earnings-calendar" "markets market-breadth earnings-calendar"`, colonnes 1fr 1.3fr 1fr | markets, heatmap, market-breadth, earnings-calendar |
| GOVT | Taux / Rates | `"yield-curve yield-curve centralbanks" "bonds bonds centralbanks"`, rangées 1.2fr 1fr | yield-curve, bonds, centralbanks |
| FX | Devises / FX | `"forex crypto"`, colonnes 1.4fr 1fr | forex, crypto |
| CMDTY | Matières premières / Commodities | `"commodities energy-complex map" "gold-intelligence energy-complex map"`, colonnes 1fr 1fr 1.3fr | commodities, energy-complex, gold-intelligence, map |
| ECO | Macro & risque / Macro & risk | `"economic-calendar macro-tiles fsi" "economic-calendar macro-signals fear-greed" "consumer-prices polymarket fear-greed"` | macro-tiles, economic-calendar, fsi, macro-signals, fear-greed, consumer-prices, polymarket |
| N | Actualité / News | `"live-news markets-news economic-news"` | live-news, markets-news, economic-news |
| LABS | Études / Studies | `"finance-labs"` | finance-labs |

- TOP est la fonction par défaut.
- Un même panneau peut figurer dans plusieurs fonctions (markets, map, live-news, finance-labs). Son élément
  DOM est déplacé dans l'emplacement de l'écran actif.
- Les panneaux de news sont créés dynamiquement à partir des flux. Si l'un d'eux (par exemple
  `economic-news`) n'existe pas au moment du montage, son emplacement est retiré de la grille plutôt que
  laissé vide. La configuration doit le permettre.

### Commandes
- Taper un code puis Entrée, ou cliquer une touche, ouvre la fonction. Les codes sont insensibles à la casse,
  avec ou sans ` <GO>` final, et les espaces sont ignorés.
- Alias acceptés : les libellés FR et EN en minuscules sans accents (par exemple `taux`, `rates`, `news`,
  `actualite`).
- `HELP`, `AIDE`, `?` ou un code inconnu ouvrent une liste déroulante sous la ligne de commande avec les
  8 fonctions (code + libellé, cliquables). En cas de code inconnu, elle commence par
  « Code inconnu : XYZ » / « Unknown code: XYZ ».
- Une lettre tapée n'importe où, hors champ de saisie et sans Ctrl, Meta ni Alt, place le curseur dans la ligne de
  commande avec ce caractère. Échap vide le champ et ferme l'aide.
- Adresse : `/terminal/#WEI`. Changer de fonction met à jour l'adresse (`pushState`), et Précédent/Suivant ainsi
  que `hashchange` changent d'écran. Une adresse au code inconnu ouvre TOP.
- Clic sur le code ambre d'un en-tête de panneau : ouvre la fonction correspondante.

### Ce qui disparaît
Onglets (`PanelTabBar`), glisser-déposer, redimensionnement, croix, « + », sélecteur de région, Mission,
recherche ⌘K, bouton Lien, plein écran, réglages, bande de synthèse en bloc séparé, bandeau Pro.
Les états enregistrés dans `localStorage` (onglets, ordre, tailles des panneaux) sont ignorés pour la variante
finance. Ils ne sont pas supprimés, puisque les autres variantes upstream partagent le code.

### Réalisation
- **`src/config/terminal-functions.ts`** (remplace `sabathier-desk.ts`) : pour chaque fonction, le code, les
  libellés FR/EN, les alias, la grille ordinateur (zones + colonnes/rangées) et l'ordre mobile. Il exporte aussi
  l'ensemble des panneaux à activer, c'est-à-dire l'union de toutes les fonctions.
- **`src/app/terminal-command.ts`** : analyse pure d'une saisie, qui renvoie `{ kind: 'open', code }`,
  `{ kind: 'help' }` ou `{ kind: 'unknown', input }`. Sans DOM, facile à tester.
- **`src/app/terminal-shell.ts`** : construit la ligne de commande, les touches, le bandeau et la barre d'état,
  et gère l'adresse. Pour chaque fonction, il pose les emplacements (`div[data-slot=<panelKey>]`) et y déplace
  `panel.getElement()`, puis appelle `notifyConnected()`. Les panneaux des autres fonctions restent montés
  mais masqués.
- **`src/app/panel-layout.ts`** : pour la variante finance seulement, `renderLayout` produit le squelette du
  shell à la place de l'en-tête, des onglets et de la grille, et le placement des panneaux (`mountPanelElement`,
  `insertByOrder`, `getPanelMountGrid`) est délégué au shell. Glisser-déposer et redimensionnement ne
  sont pas attachés. Les autres variantes ne changent pas.
- La carte n'est pas un `Panel` : le shell déplace `#mapSection` dans l'emplacement `map`, sans
  poignées de redimensionnement ni découpage carte/panneaux, et prévient la carte du changement de taille.
- Les panneaux eux-mêmes ne sont pas réécrits. Seuls quelques réglages CSS sont ajoutés pour la densité.

## 4. Mobile (sous-projet 3, jusqu'à 768 px)

- Nav du site réduite au nom et au bouton ☰ (comportement actuel de la nav commune).
- Ligne de commande avec l'heure de Paris seule.
- Rangée de touches défilant horizontalement, avec la touche active ramenée en vue
  (`scrollIntoView({ inline: 'nearest' })`). Libellés masqués. Hauteur de touche d'au moins 40 px.
- Bandeau de cotes défilant.
- Panneaux empilés à pleine largeur dans l'ordre mobile de la fonction. La page défile. Chaque panneau a une
  hauteur maximale (environ 60vh) et défile à l'intérieur ; la carte est limitée à environ 40vh.
- Barre d'état en pied de page.
- Supprimés en finance : barre d'onglets mobile upstream (`#mobileTabBar`), barre de catégories
  (`MobilePanelNav`), carte repliable.
- Aucun défilement horizontal de la page. Texte en 11 px minimum.

## 5. Finitions, tests, mise en ligne (sous-projet 4 et transversal)

### Finitions
- Le bandeau de cotes réutilise `synthesis-data.ts` / `synthesis-format.ts` avec le même rafraîchissement
  toutes les 5 minutes, en pause quand l'onglet est masqué. `SynthesisBar` disparaît de la variante finance.
- La synthèse IA est le panneau AI Insights existant dans TOP.
- Les liens « Étude liée → » (`lab-links.ts`) restent sous les panneaux concernés, en ambre souligné.
- FR/EN : libellés des touches, invite, aide, barre d'état et titres de panneaux suivent la langue du site.
  Les titres de panneaux sont traduits seulement s'ils le sont déjà dans les locales.

### Audit visuel (`selfhost/visual/audit.mjs`, réécrit)
- Tailles : 1440×900 et 390×844. Le schéma de couleurs du navigateur passe en clair puis en sombre, et la
  page doit être noire dans les deux cas.
- Contrôles bloquants :
  - fond `rgb(0, 0, 0)` sur le shell ;
  - famille IBM Plex Mono sur les titres de panneaux ;
  - 8 touches présentes ;
  - nav du site visible ;
  - lien AGPL présent et pointant vers `/labs/source.txt` ;
  - pas de défilement horizontal ;
  - sur ordinateur, pour chaque `#CODE`, pas de défilement vertical de la page et tous les emplacements de
    la fonction contiennent un panneau visible ;
  - `GOVT` + Entrée dans la ligne de commande affiche l'écran GOVT et met `#GOVT` dans l'adresse.
- Une capture par fonction et par taille, pour la revue à l'œil.

### Tests
- vitest dom :
  - `terminal-command` : codes, casse, `<GO>`, alias, aide, inconnu ;
  - `terminal-functions` : 8 fonctions, codes uniques, chaque zone de grille référence un panneau de
    `FINANCE_PANELS` ou `map`, et l'ordre mobile couvre exactement les panneaux de la grille ;
  - `terminal-shell` : synchronisation avec l'adresse, clic sur une touche, frappe globale.
- Les tests des onglets Sabathier, de la bande de synthèse et de la portée du thème sont mis à jour ou supprimés
  quand ils testent ce qui disparaît : `sabathier-desk*.test.mts`, `synthesis-bar.test.mts`,
  `sabathier-theme-scope.test.mjs`. Les tests upstream des autres variantes doivent continuer à passer.
- Typecheck et tests via `./selfhost/check.sh`, puis suppression de l'image `worldmonitor-check`.

### Déroulé
Les sous-projets s'enchaînent dans l'ordre 1 → 2 → 3 → 4, chacun commité, poussé, puis mis en ligne avec
`./selfhost/deploy.sh` sur demande d'Emilien et audité.
- Après le 1, le Terminal actuel (onglets compris) est noir et ambre.
- Après le 2, le shell remplace les onglets sur ordinateur.
- Après le 3, le mobile est fait.
- Après le 4, les finitions et l'audit complet sont en place.

Chaque sous-projet a son propre plan d'implémentation.

## 6. Risques
- **Couplages de `panel-layout.ts`** (environ 4 000 lignes) : montage différé, chargement paresseux et
  `applyPanelSettings` supposent la grille. On limite le risque en branchant le shell uniquement pour la
  variante finance, au niveau des fonctions de placement.
- **Panneaux qui supposent une largeur de grille** (redimensionnement par colonne, `panel-grid.ts`) : les
  emplacements fixes neutralisent les classes `span-N` / `col-span-N`.
- **Spécificité CSS face aux ~29 000 lignes de `main.css`** : le thème est non « layered » et ciblé
  `[data-variant="finance"]`, comme aujourd'hui.
- **Carte** : le changement de taille du conteneur doit déclencher un redimensionnement de deck.gl/maplibre.
- **RAM et disque du VPS** : un seul build à la fois ; supprimer l'image de vérification après usage.

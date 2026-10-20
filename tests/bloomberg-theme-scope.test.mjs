import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/bloomberg-theme.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('imports the generated tokens first', () => {
  assert.match(css.trimStart(), /^@import '\.\/sabathier-tokens\.css';/);
});

// Split a selector list on top-level commas only (not inside :is(...) / :not(...)).
function splitList(sel) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  return [...parts, cur];
}

test('every rule is scoped to the finance variant', () => {
  const selectors = [...css.replace(/@import[^;]+;/g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]+\{/g, '').matchAll(/([^{}@]+)\{/g)].map((m) => m[1].trim()).filter(Boolean);
  assert.ok(selectors.length > 10);
  for (const sel of selectors) {
    for (const part of splitList(sel)) {
      assert.match(part.trim(), /^(:root)?\[data-variant="finance"\]/, `unscoped selector: ${part.trim()}`);
    }
  }
});

test('maps the main Terminal variables onto the site tokens', () => {
  for (const v of ['--bg', '--surface', '--panel-bg', '--border', '--text', '--text-dim', '--accent', '--green', '--font-body-base', '--font-mono']) {
    assert.match(css, new RegExp(`${v}:\\s*[^;]+;`), v);
  }
});

test('severity colours are left alone (only --semantic-positive follows --up, as the spec maps it)', () => {
  assert.doesNotMatch(css, /--semantic-(critical|high|elevated|normal|low|info)\s*:/);
  assert.doesNotMatch(css, /--(threat|defcon)-[a-z0-9-]+\s*:/);
});

test('main.ts loads the theme for the finance variant only', () => {
  assert.match(main, /SITE_VARIANT === 'finance'[\s\S]{0,200}loadVariantThemeStylesheet\('finance', \(\) => import\('\.\/styles\/bloomberg-theme\.css'\)\)/);
});

test('the active-state restyle only targets controls, never overlays or markers that use .active for "shown"', () => {
  const rule = css.match(/([^{}]*\.mission-preset-button--active[^{}]*)\{/)[1];
  assert.match(rule, /:is\(button, \[role="tab"\], \[role="option"\], \.layer-toggle, \.mobile-tab\)/);
  assert.doesNotMatch(css, /\[data-variant="finance"\] :is\(\.active/);
});

test('the coverage row stays in the accessibility tree (visually hidden, not display:none)', () => {
  const rule = css.match(/\.digest-coverage-row\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(rule, /display:\s*none/);
  assert.match(rule, /clip:\s*rect\(0 0 0 0\)/);
});

test('on mobile the footer collapses like upstream (only the status container stays)', () => {
  assert.match(css, /@media \(max-width: 768px\)\s*\{[^@]*\[data-variant="finance"\] \.site-footer\.es-foot > :not\(\.status-panel-container\)\s*\{\s*display:\s*none;/);
});

test('the 2D map (drawn from --map-* variables) is black with near-black land, grid hidden in the water colour', () => {
  const block = css.match(/:root\[data-variant="finance"\]\s*\{([^}]*)\}/)[1];
  assert.match(block, /--map-bg:\s*#000000;/);
  assert.match(block, /--map-grid:\s*#000000;/);
  assert.match(block, /--map-country:\s*#141414;/);
  assert.match(block, /--map-stroke:\s*#5a3a10;/);
  assert.doesNotMatch(css, /\[data-theme="dark"\]/, 'one palette only: the Terminal is always dark');
});

test('no space is reserved for the upstream Pro banner (the fork never shows it)', () => {
  assert.match(css, /:root\[data-variant="finance"\]\.wm-pro-banner-reserved \.pro-banner-slot\s*\{\s*min-height:\s*0;/);
  assert.match(css, /:root\[data-variant="finance"\]\.wm-pro-banner-reserved #app::before\s*\{\s*content:\s*none;\s*display:\s*none;/);
});

test('suggested Mission button and live data badge drop their hard-coded greens', () => {
  assert.match(css, /\[data-variant="finance"\] \.mission-preset-button--suggested\s*\{\s*border-color:\s*var\(--bb-amber\);/);
  assert.match(css, /\[data-variant="finance"\] \.panel-data-badge\.live\s*\{[^}]*border-color:\s*var\(--bb-rule\);[^}]*background:\s*transparent;/);
});

test('on mobile the near-empty toolbar is hidden (only the live dot was left)', () => {
  assert.match(css, /@media \(max-width: 768px\)\s*\{[^@]*\[data-variant="finance"\] \.header\s*\{\s*display:\s*none;/);
});

test('control radius only on toolbar and panel-header controls (round buttons and sliders stay round)', () => {
  assert.doesNotMatch(css, /\[data-variant="finance"\] :is\(button, select, input, \.copy-link-btn, \.search-btn\)/);
  assert.match(css, /\[data-variant="finance"\] :is\(\.header, \.panel-header\) :is\(button, select, \.copy-link-btn, \.search-btn\)/);
});

test('panel titles keep the per-panel font scale', () => {
  assert.match(css, /\.panel-title\s*\{[^}]*font-size:\s*calc\(\.75rem \* var\(--wm-panel-effective-scale, 1\)\)/);
});

test('RTL and CJK font stacks survive (only the base font is replaced)', () => {
  assert.doesNotMatch(css, /--font-body:\s*var\(--sans\)/);
  assert.match(css, /\[data-variant="finance"\] body\s*\{[^}]*font-family:\s*var\(--font-body\)/);
});

test('panel flash halo and small capital labels use the Bloomberg palette', () => {
  assert.match(css, /\.panel\.flash-new::after\s*\{[^}]*box-shadow:[^;]*var\(--bb-amber\)/);
  assert.match(css, /:is\(\.time-slider-label, \.insights-section-title, \.live-media-shell-status\)\s*\{[^}]*letter-spacing:\s*\.04em/);
});

test('synthesis figures: compact touch target and visible keyboard focus', () => {
  assert.match(css, /\.es-syn-item\s*\{[^}]*min-height:\s*32px/);
  assert.match(css, /\.es-syn-item:focus-visible\s*\{[^}]*outline/);
});

test('the synthesis time stamp never wraps (it set the row height on phones)', () => {
  assert.match(css, /\.es-syn-stamp\s*\{[^}]*white-space:\s*nowrap/);
});

test('Bloomberg palette and mono font', () => {
  for (const [v, val] of [['--bb-bg', '#000000'], ['--bb-amber', '#fb8b1e'], ['--bb-value', '#ffffff'], ['--bb-up', '#4af626'], ['--bb-down', '#ff3b3b'], ['--bb-band', '#1c3d7a'], ['--bb-rule', '#333333']]) {
    assert.match(css, new RegExp(`${v}:\\s*${val};`), v);
  }
  assert.match(css, /@font-face\s*\{[^}]*IBM Plex Mono[^}]*ibm-plex-mono-latin-400-normal\.woff2/);
  assert.match(css, /--font-mono:\s*var\(--bb-mono\)/);
});

test('function shell: grid on main, contents grid, hidden tabs and toolbar, ticker animation respects reduced motion', () => {
  assert.match(css, /:root\[data-variant="finance"\]\.bb-shell #panelsGrid\s*\{[^}]*display:\s*contents/);
  assert.match(css, /:root\[data-variant="finance"\]\.bb-shell :is\(\.header, #panelTabsMount[^)]*\)\s*\{[^}]*display:\s*none/);
  assert.match(css, /@keyframes bb-tick/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*\.es-syn-track\s*\{[^}]*animation:\s*none/);
});

test('function shell: a map height saved by the upstream splitter never overrides the grid cell', () => {
  assert.match(css, /\.bb-shell #mapContainer\s*\{[^}]*flex:\s*1 1 auto !important;[^}]*height:\s*auto !important/);
});

test('mobile shell: no upstream tab bar, stacked flex column, capped panel heights, 11px floor, 40px keys', () => {
  const mobile = css.match(/@media \(max-width: 768px\)[^{]*\{([\s\S]*?)\n\}/g).join('\n');
  assert.match(mobile, /\.bb-shell :is\(#mobileTabBar, \.mobile-panel-nav, \.map-collapse-btn\)\s*\{[^}]*display:\s*none/);
  assert.match(mobile, /\.bb-shell #main\.main-content\[data-fn\]\s*\{[^}]*flex-direction:\s*column/);
  assert.match(mobile, /\.bb-shell \.main-content\[data-fn\] \.panel:not\(\.hidden\)\s*\{[^}]*max-height:\s*60vh/);
  assert.match(mobile, /\.bb-shell #mapSection:not\(\.hidden\)\s*\{[^}]*height:\s*40vh/);
  assert.match(mobile, /\.bb-shell \.bb-key\s*\{[^}]*min-height:\s*40px/);
  assert.match(mobile, /\[data-variant="finance"\] body\s*\{[^}]*font-size:\s*11px/);
});

test('finish: amber/white yield curve, no map layer boxes or time range in the shell, N/A error line, ticker pauses on focus', () => {
  assert.match(css, /\[data-panel="yield-curve"\] [^{]*\[stroke="#3498db"\][^{]*\{[^}]*stroke:\s*var\(--bb-amber\)/);
  assert.match(css, /\[stroke="#2ecc71"\][^{]*\{[^}]*stroke:\s*var\(--bb-value\)/);
  assert.match(css, /\.bb-shell #mapSection:not\(\.bb-layers-open\) :is\(\.layer-toggles, \.time-slider\)\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.panel-error-state\s*\{[^}]*flex-direction:\s*row/);
  assert.match(css, /\.panel-error-radar\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.es-syn:is\(:hover, :focus-within\) \.es-syn-track\s*\{[^}]*animation-play-state:\s*paused/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*\.es-syn-group\[aria-hidden="true"\]\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /\[class\*="-dot"\]/);
  assert.match(css, /--text-ghost:\s*#7a7a7a;/);
});

test('remaining fixes: N/A line left-aligned, no tab-bar reserve on phones, round loader dots, map title on phones, landscape phones stack, no dead !important', () => {
  assert.match(css, /\.panel-error-msg\s*\{[^}]*text-align:\s*left;[^}]*max-width:\s*none/);
  assert.match(css, /--wm-bottom-base:\s*env\(safe-area-inset-bottom, 0px\)/);
  assert.match(css, /\.panel-radar-dot, \.live-media-shell-dot/);
  assert.match(css, /\.bb-shell \.map-section \.panel-title\s*\{[^}]*display:\s*inline/);
  assert.match(css, /@media \(max-width: 768px\), \(max-height: 520px\) and \(orientation: landscape\)/);
  assert.doesNotMatch(css, /#panelsGrid \{ display: contents !important; \}/);
});

test('checkboxes keep their checked look: excluded from the dark field rule, amber native box in the layer list', () => {
  assert.match(css, /\[data-variant="finance"\] :is\(input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select, textarea\):not\(\.es-nav \*\)/);
  assert.match(css, /\.layer-toggles input\[type="checkbox"\]\s*\{[^}]*appearance:\s*auto;[^}]*accent-color:\s*var\(--bb-amber\)/);
  assert.match(css, /\.layer-toggle:has\(input:checked\) \.toggle-label\s*\{[^}]*color:\s*var\(--bb-value\)/);
});

test('no upstream product credit in the layer list (the AGPL notice lives on /labs/source.txt)', () => {
  assert.match(css, /\[data-variant="finance"\] \.map-author-badge\s*\{\s*display:\s*none;/);
});

test('phones scroll the page: html/body leave upstream overflow hidden, #app leaves its fixed absolute box', () => {
  const mobile = css.match(/@media \(max-width: 768px\)[^{]*\{([\s\S]*?)\n\}/g).join('\n');
  assert.match(mobile, /:root\[data-variant="finance"\]\.bb-shell,\s*:root\[data-variant="finance"\]\.bb-shell body\s*\{[^}]*height:\s*auto;[^}]*overflow-y:\s*auto/);
  assert.match(mobile, /\.bb-shell #app\s*\{[^}]*position:\s*relative;[^}]*inset:\s*auto/);
});

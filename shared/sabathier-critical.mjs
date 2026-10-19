// Critical CSS for the Sabathier (finance) build: the colour tokens and the variable mapping, inlined
// in index.html so the first paint already uses the site palette while bloomberg-theme.css loads
// asynchronously. Fonts, chrome and component rules stay in the stylesheet.
function blocks(css, startsWith) {
  const out = [];
  let i = 0;
  while ((i = css.indexOf(startsWith, i)) !== -1) {
    const open = css.indexOf('{', i);
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) break;
    }
    out.push(css.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export function criticalSabathierCss(tokensCss, themeCss) {
  const tokens = strip(tokensCss);
  const theme = strip(themeCss);
  const picked = [
    ...blocks(tokens, ':root {'),
    ...blocks(tokens, '@media (prefers-color-scheme: dark)'),
    ...blocks(tokens, ':root[data-theme="dark"] {'),
    ...blocks(theme, ':root[data-variant="finance"] {'),
    ...blocks(theme, ':root[data-variant="finance"][data-theme="dark"] {'),
    '[data-variant="finance"] body{background:#000;color:#fb8b1e}',
  ];
  return picked.join('\n').replace(/\n\s+/g, '\n').replace(/\s*\n\s*/g, '\n');
}

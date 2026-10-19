// Bakes a build-time variant into index.html's inline prepaint script (non-full builds).
// The source reads `if(v)…dataset.variant=v;else …removeAttribute('data-variant');`: the whole
// if/else is replaced, since replacing only the `if` branch left a dangling `else` (a syntax error
// that silently skipped the first-paint variant and theme on every non-full build).
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

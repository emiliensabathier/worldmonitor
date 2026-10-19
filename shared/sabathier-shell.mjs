// Page shell for the Sabathier (finance) self-hosted build: replaces upstream's product identity
// (JSON-LD, SEO heading and summary, no-JS block, share image and alternates on worldmonitor.app)
// with the deployment's own. The AGPL licence and source notice stay reachable from the Terminal
// footer (/labs/source.txt), which carries the upstream copyright.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sabathierShell(html, { siteUrl, paragraphs }) {
  const origin = new URL(siteUrl).origin;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Sabathier Terminal',
    url: siteUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description: 'Self-hosted markets desk: rates, FX, equities, commodities and macro, linked to quantitative finance studies.',
    publisher: { '@type': 'Person', name: 'Emilien Sabathier', url: `${origin}/` },
    isPartOf: { '@type': 'WebSite', name: 'Emilien Sabathier', url: `${origin}/` },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  };
  let first = true;
  let out = html.replace(/<script type="application\/ld\+json"([^>]*)>[\s\S]*?<\/script>\s*/g, (_m, attrs) => {
    if (!first) return '';
    first = false;
    return `<script type="application/ld+json"${attrs}>${JSON.stringify(ld)}</script>\n    `;
  });
  out = out
    .replace(/<link rel="alternate" hreflang="[^"]*" href="https:\/\/www\.worldmonitor\.app[^"]*" \/>\s*/g, '')
    .replace(/https:\/\/www\.worldmonitor\.app\/favico\//g, `${origin}/favico/`)
    .replace(/https:\/\/www\.worldmonitor\.app\/dashboard/g, siteUrl)
    .replace(/(<meta (?:property|name)="(?:og|twitter):image:alt" content=")[^"]*(")/g, '$1Sabathier Terminal, markets desk by Emilien Sabathier$2')
    // Self-hosted: no upstream API or tile host is contacted, so drop their preconnects and notes.
    .replace(/\s*<link rel="preconnect" href="https:\/\/[a-z]+\.worldmonitor\.app"[^>]*>/g, '')
    .replace(/\s*<!--(?:(?!-->)[\s\S])*worldmonitor\.app(?:(?!-->)[\s\S])*-->/g, '')
    .replace(/\s*<meta name="(?:author|twitter:site|twitter:creator)" content="[^"]*" \/>/g, '')
    .replace(/<h1 class="app-heading">[\s\S]*?<\/h1>/, '<h1 class="app-heading">Sabathier Terminal: markets desk by Emilien Sabathier</h1>')
    .replace(/<section class="app-seo-summary">[\s\S]*?<\/section>/, () =>
      `<section class="app-seo-summary">\n${paragraphs.map((p) => `      <p>${esc(p)}</p>`).join('\n')}\n    </section>`)
    .replace(/<noscript>\s*<main id="dashboard-noscript"[\s\S]*?<\/noscript>/, () => `<noscript>
      <main id="dashboard-noscript" class="dashboard-noscript">
        <h2>Sabathier Terminal needs JavaScript</h2>
        <p>The live markets desk runs in the browser. The studies are readable without it at <a href="/labs/">/labs/</a>; licence and source: <a href="/labs/source.txt">/labs/source.txt</a>.</p>
      </main>
    </noscript>`);
  // Any upstream product name left in head metadata (titles, descriptions, alt texts).
  return out.replace(/World ?Monitor/g, 'Sabathier Terminal');
}

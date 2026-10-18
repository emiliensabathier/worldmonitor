// Visual audit of the Sabathier theme: screenshots in light/dark at desktop and phone sizes, plus
// automatic checks. Usage: node selfhost/visual/audit.mjs <url> <outdir>  (exit 1 on any failure)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, outdir] = process.argv.slice(2);
if (!url || !outdir) { console.error('usage: audit.mjs <url> <outdir>'); process.exit(2); }
mkdirSync(outdir, { recursive: true });

const SIZES = { desktop: [1440, 900], mobile: [390, 844] };
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = {};
let failed = false;

for (const theme of ['light', 'dark']) {
  for (const [size, [width, height]] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(15000);
    await page.screenshot({ path: join(outdir, `${theme}-${size}.png`) });
    const r = await page.evaluate(() => {
      const hsl = (c) => {
        const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c);
        if (!m || (m[4] !== undefined && Number(m[4]) < 0.2)) return null;
        const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0, l };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
        return { h, s, l };
      };
      // The theme's own "up" colour (gains) is allowed: resolve it once to its rgb() form.
      const probe = document.createElement('i');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--up').trim();
      document.body.append(probe);
      const upColor = getComputedStyle(probe).color;
      probe.remove();
      const isUp = (c) => c === upColor;
      const bright = (c) => { const v = hsl(c); return v && v.h >= 80 && v.h <= 170 && v.s >= 0.5 && v.l >= 0.35 && v.l <= 0.8 && !isUp(c); };
      const path = (el) => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map((c) => '.' + c).join('')); return parts.join(' > '); };
      const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && b.bottom > 0 && b.top < innerHeight; };
      const greens = [], mono = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || el.closest('canvas, svg, .maplibregl-canvas-container')) continue;
        const s = getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
          if (prop === 'borderTopColor' && s.borderTopWidth === '0px') continue;
          if (prop === 'color' && !el.childNodes.length) continue;
          if (bright(s[prop])) greens.push(`${path(el)} ${prop}=${s[prop]}`);
        }
        if (/mono|courier|consolas|menlo/i.test(s.fontFamily) && !el.closest('code, kbd, pre') && el.textContent.trim()) mono.push(path(el));
      }
      const nav = document.querySelector('.es-nav');
      return {
        greens: [...new Set(greens)].slice(0, 60),
        mono: [...new Set(mono)].slice(0, 30),
        navVisible: !!nav && nav.getBoundingClientRect().height > 0,
        hScroll: document.documentElement.scrollWidth > innerWidth + 1,
        panelTitleFont: getComputedStyle(document.querySelector('.panel-title') ?? document.body).fontFamily,
        synthesisItems: document.querySelectorAll('.es-syn .es-syn-item').length,
        deskTabs: document.querySelectorAll('#panelTabsMount .dashboard-tab').length,
        labLinks: document.querySelectorAll('.es-lab-link a').length,
        headerVisibleOnMobile: innerWidth <= 768 && !!document.querySelector('.header') && getComputedStyle(document.querySelector('.header')).display !== 'none',
      };
    });
    // Each context is fresh (no localStorage): this is a first visit, so the six desk tabs must exist.
    const ok = r.greens.length === 0 && r.mono.length === 0 && r.navVisible && !r.hScroll && /Source Serif/.test(r.panelTitleFont)
      && r.synthesisItems >= 5 && r.deskTabs === 6 && r.labLinks >= 1 && !r.headerVisibleOnMobile;
    if (!ok) failed = true;
    report[`${theme}-${size}`] = { ok, ...r };
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme}-${size}: greens=${r.greens.length} mono=${r.mono.length} nav=${r.navVisible} hScroll=${r.hScroll} synthesis=${r.synthesisItems} tabs=${r.deskTabs} labLinks=${r.labLinks} mobileHeader=${r.headerVisibleOnMobile}`);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(outdir, 'report.json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);

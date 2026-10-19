// Visual audit of the Bloomberg-style Sabathier Terminal (always black, whatever the colour scheme): screenshots in light/dark at desktop and phone sizes, plus
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
      const rootStyle = getComputedStyle(document.documentElement);
      probe.style.color = (rootStyle.getPropertyValue('--bb-up') || rootStyle.getPropertyValue('--up')).trim();
      document.body.append(probe);
      const upColor = getComputedStyle(probe).color;
      probe.remove();
      const isUp = (c) => c === upColor;
      const bright = (c) => { const v = hsl(c); return v && v.h >= 80 && v.h <= 170 && v.s >= 0.5 && v.l >= 0.35 && v.l <= 0.8 && !isUp(c); };
      const path = (el) => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map((c) => '.' + c).join('')); return parts.join(' > '); };
      const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && b.bottom > 0 && b.top < innerHeight; };
      const greens = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || el.closest('canvas, svg, .maplibregl-canvas-container')) continue;
        const s = getComputedStyle(el);
        // Exception: colours set inline by panel JS carry data (Fear & Greed gauge, severities), not chrome.
        const inlineColour = /(^|;)\s*(color|background)/i.test(el.getAttribute('style') ?? '') || [...el.querySelectorAll(':scope > *')].length === 0 && /(^|;)\s*color/i.test(el.parentElement?.getAttribute('style') ?? '');
        if (inlineColour) continue;
        for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
          if (prop === 'borderTopColor' && s.borderTopWidth === '0px') continue;
          if (prop === 'color' && !el.childNodes.length) continue;
          if (bright(s[prop])) greens.push(`${path(el)} ${prop}=${s[prop]}`);
        }
      }
      const nav = document.querySelector('.es-nav');
      return {
        greens: [...new Set(greens)].slice(0, 60),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        agpl: !!document.querySelector('a[href$="/labs/source.txt"]'),
        navVisible: !!nav && nav.getBoundingClientRect().height > 0,
        hScroll: document.documentElement.scrollWidth > innerWidth + 1,
        panelTitleFont: getComputedStyle(document.querySelector('.panel-title') ?? document.body).fontFamily,
        synthesisItems: document.querySelectorAll('.es-syn .es-syn-item').length,
        keys: document.querySelectorAll('.bb-key').length,
        labLinks: document.querySelectorAll('.es-lab-link a').length,
        headerVisibleOnMobile: innerWidth <= 768 && !!document.querySelector('.header') && getComputedStyle(document.querySelector('.header')).display !== 'none',
      };
    });
    const ok = r.greens.length === 0 && r.bodyBg === 'rgb(0, 0, 0)' && r.agpl && r.navVisible && !r.hScroll && /IBM Plex Mono/.test(r.panelTitleFont)
      && r.synthesisItems >= 5 && r.keys === 8 && r.labLinks >= 1 && !r.headerVisibleOnMobile;
    if (!ok) failed = true;
    report[`${theme}-${size}`] = { ok, ...r };
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme}-${size}: greens=${r.greens.length} bodyBg=${r.bodyBg} agpl=${r.agpl} nav=${r.navVisible} hScroll=${r.hScroll} synthesis=${r.synthesisItems} keys=${r.keys} labLinks=${r.labLinks} mobileHeader=${r.headerVisibleOnMobile}`);
    await ctx.close();
  }
}
// Every function screen on desktop: no page scroll, every grid area holds a visible panel; then the
// command line (GOVT + Enter) switches screen and address.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const code of ['TOP', 'WEI', 'GOVT', 'FX', 'CMDTY', 'ECO', 'N', 'LABS']) {
    await page.goto(`${url}#${code}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(code === 'TOP' ? 15000 : 8000);
    await page.screenshot({ path: join(outdir, `fn-${code}.png`) });
    const r = await page.evaluate(() => {
      const main = document.getElementById('main');
      const names = [...new Set((main?.style.gridTemplateAreas ?? '').replace(/"/g, ' ').split(/\s+/).filter((n) => n && n !== '.'))];
      const empty = names.filter((n) => {
        const el = n === 'map' ? document.getElementById('mapSection') : document.querySelector(`#panelsGrid > [data-panel="${n}"]`);
        return !el || el.classList.contains('hidden') || el.getBoundingClientRect().height < 40;
      });
      const shown = [...document.querySelectorAll('#panelsGrid > [data-panel]')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.dataset.panel);
      const map = document.getElementById('mapSection');
      if (map && getComputedStyle(map).display !== 'none') shown.push('map');
      const extra = shown.filter((k) => !names.includes(k));
      return { fn: main?.dataset.fn, names, empty, extra, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 };
    });
    const ok = r.fn === code && r.names.length > 0 && r.empty.length === 0 && r.extra.length === 0 && !r.pageScroll;
    if (!ok) failed = true;
    report[`fn-${code}`] = { ok, ...r };
    console.log(`${ok ? 'ok  ' : 'FAIL'} fn-${code}: fn=${r.fn} areas=${r.names.join(',')} empty=${r.empty.join(',')} extra=${r.extra.join(',')} pageScroll=${r.pageScroll}`);
  }
  await page.goto(`${url}#TOP`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.fill('.bb-cmd input', 'GOVT');
  await page.press('.bb-cmd input', 'Enter');
  await page.waitForTimeout(1500);
  const cmd = await page.evaluate(() => ({ hash: location.hash, fn: document.getElementById('main')?.dataset.fn }));
  const cmdOk = cmd.hash === '#GOVT' && cmd.fn === 'GOVT';
  if (!cmdOk) failed = true;
  report.command = { ok: cmdOk, ...cmd };
  console.log(`${cmdOk ? 'ok  ' : 'FAIL'} command GOVT: hash=${cmd.hash} fn=${cmd.fn}`);
  await ctx.close();
}
// Phones: stacked function screens, no upstream tab bar, 40px keys, 11px floor, status bar with the licence.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const code of ['TOP', 'GOVT', 'ECO']) {
    await page.goto(`${url}#${code}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(code === 'TOP' ? 15000 : 8000);
    await page.screenshot({ path: join(outdir, `m-${code}.png`) });
    const r = await page.evaluate(() => {
      const main = document.getElementById('main');
      const names = [...new Set((main?.style.gridTemplateAreas ?? '').replace(/"/g, ' ').split(/\s+/).filter((n) => n && n !== '.'))];
      const missing = names.filter((n) => {
        const el = n === 'map' ? document.getElementById('mapSection') : document.querySelector(`#panelsGrid > [data-panel="${n}"]`);
        return !el || getComputedStyle(el).display === 'none' || el.getBoundingClientRect().height < 40;
      });
      const bar = document.getElementById('mobileTabBar');
      const keyHeights = [...document.querySelectorAll('.bb-key')].map((k) => k.getBoundingClientRect().height);
      const content = document.querySelector('#panelsGrid > .bb-placed .panel-content');
      const agpl = document.querySelector('.site-footer a[href$="/labs/source.txt"]');
      return {
        fn: main?.dataset.fn, missing, hScroll: document.documentElement.scrollWidth > innerWidth + 1,
        tabBar: !!bar && getComputedStyle(bar).display !== 'none',
        minKey: Math.min(...keyHeights), font: content ? parseFloat(getComputedStyle(content).fontSize) : 0,
        agpl: !!agpl && agpl.getBoundingClientRect().height > 0,
      };
    });
    const ok = r.fn === code && r.missing.length === 0 && !r.hScroll && !r.tabBar && r.minKey >= 40 && r.font >= 11 && r.agpl;
    if (!ok) failed = true;
    report[`m-${code}`] = { ok, ...r };
    console.log(`${ok ? 'ok  ' : 'FAIL'} m-${code}: fn=${r.fn} missing=${r.missing.join(',')} hScroll=${r.hScroll} tabBar=${r.tabBar} minKey=${r.minKey} font=${r.font} agpl=${r.agpl}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(outdir, 'report.json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);

// Derives public/map-styles/sabathier-{light,dark}.json from happy-{light,dark}.json: same Carto
// sources, glyphs and sprite, repainted with the site's palette (paper land, wash water, hairline
// borders, no buildings or minor admin lines). Run: node scripts/build-sabathier-map-styles.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PALETTES = {
  light: { land: '#fbfaf6', water: '#e3e9f3', border: '#c9cdd3', road: '#eceef0', label: '#5e6570', halo: '#fbfaf6' },
  dark: { land: '#141414', water: '#000000', border: '#5a3a10', road: '#1f1f1f', label: '#8a6a3a', halo: '#000000' },
};

const HIDE = /^(building|housenumber|poi_|aeroway|boundary_(county|state)|park_|landuse)/;
const ROADS = /^(road_|tunnel_|bridge_|rail)/;

export function repaint(style, p, name) {
  const s = structuredClone(style);
  s.name = name;
  for (const l of s.layers) {
    l.paint = l.paint ?? {};
    l.layout = l.layout ?? {};
    if (HIDE.test(l.id)) { l.layout.visibility = 'none'; continue; }
    if (l.id === 'background') l.paint['background-color'] = p.land;
    else if (l.id === 'landcover') l.paint['fill-opacity'] = 0;
    else if (l.id === 'water' || l.id === 'water_shadow') l.paint['fill-color'] = p.water;
    else if (l.id === 'waterway') l.paint['line-color'] = p.water;
    else if (l.id === 'boundary_country_outline') l.paint['line-opacity'] = 0;
    else if (l.id === 'boundary_country_inner') {
      l.paint['line-color'] = p.border;
      l.paint['line-width'] = { stops: [[3, 0.6], [6, 1]] };
    } else if (ROADS.test(l.id) && l.type === 'line') {
      l.paint['line-color'] = p.road;
      l.minzoom = Math.max(l.minzoom ?? 0, 7);
    } else if (l.type === 'symbol') {
      l.paint['text-color'] = p.label;
      l.paint['text-halo-color'] = p.halo;
      if ('icon-color' in l.paint) l.paint['icon-color'] = p.label; // city dots: no green
    }
  }
  return s;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const theme of ['light', 'dark']) {
    const dir = new URL('../public/map-styles/', import.meta.url);
    const happy = JSON.parse(readFileSync(new URL(`happy-${theme}.json`, dir), 'utf8'));
    writeFileSync(new URL(`sabathier-${theme}.json`, dir), JSON.stringify(repaint(happy, PALETTES[theme], `Sabathier ${theme}`), null, 2) + '\n');
    console.log(`wrote sabathier-${theme}.json`);
  }
}

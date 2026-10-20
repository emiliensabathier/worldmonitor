import { afterEach, describe, expect, it } from 'vitest';
import { mountLayerButton } from '@/app/terminal-map-layers';

function map() {
  const section = document.createElement('div');
  section.id = 'mapSection';
  section.innerHTML = `<div class="panel-header"><div class="panel-header-left"><span class="panel-title">Map</span></div>
    <div class="map-header-actions"></div></div>
    <div id="mapContainer"><div class="layer-toggles"><label class="layer-toggle"><input type="checkbox"></label></div><div class="time-slider"></div></div>`;
  document.body.append(section);
  return section;
}
afterEach(() => document.body.replaceChildren());

describe('map layer button (Terminal shell)', () => {
  it('adds one LAYERS button to the map header, idempotent, labelled in the site language', () => {
    const section = map();
    mountLayerButton(section, 'fr');
    mountLayerButton(section, 'fr');
    const buttons = section.querySelectorAll('.bb-layers-btn');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toContain('CALQUES');
    expect(buttons[0]!.getAttribute('aria-expanded')).toBe('false');
  });
  it('opens the layer and time-range controls, beating upstream !important hiding, and closes them again', () => {
    const section = map();
    mountLayerButton(section, 'en');
    const btn = section.querySelector<HTMLButtonElement>('.bb-layers-btn')!;
    const toggles = section.querySelector<HTMLElement>('.layer-toggles')!;
    btn.click();
    expect(section.classList.contains('bb-layers-open')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(toggles.style.getPropertyValue('display')).toBe('flex');
    expect(toggles.style.getPropertyPriority('display')).toBe('important');
    btn.click();
    expect(section.classList.contains('bb-layers-open')).toBe(false);
    expect(toggles.style.getPropertyValue('display')).toBe('');
  });
  it('a checkbox click inside keeps it open; Escape or a click elsewhere closes it', () => {
    const section = map();
    mountLayerButton(section, 'en');
    section.querySelector<HTMLButtonElement>('.bb-layers-btn')!.click();
    section.querySelector<HTMLInputElement>('.layer-toggles input')!.click();
    expect(section.classList.contains('bb-layers-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(section.classList.contains('bb-layers-open')).toBe(false);
    section.querySelector<HTMLButtonElement>('.bb-layers-btn')!.click();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(section.classList.contains('bb-layers-open')).toBe(false);
  });
});

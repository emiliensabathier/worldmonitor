// Sabathier Terminal: the map's layer and time-range controls live behind a LAYERS button in the map
// header, so the small map panels stay clean but every layer can still be chosen. Upstream hides the
// layer list on phones with an !important rule in @layer base, so the open state is applied inline.
const CONTROLS = '.layer-toggles, .time-slider';

export function mountLayerButton(section: HTMLElement, lang: string): void {
  const actions = section.querySelector<HTMLElement>('.map-header-actions');
  if (!actions || actions.querySelector('.bb-layers-btn')) return;

  const fr = lang.toLowerCase().startsWith('fr');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bb-layers-btn';
  btn.textContent = fr ? 'CALQUES ▾' : 'LAYERS ▾';
  btn.title = fr ? 'Choisir les calques affichés' : 'Choose the layers shown';
  btn.setAttribute('aria-expanded', 'false');
  actions.prepend(btn);

  const setOpen = (open: boolean) => {
    section.classList.toggle('bb-layers-open', open);
    btn.setAttribute('aria-expanded', String(open));
    for (const el of section.querySelectorAll<HTMLElement>(CONTROLS)) {
      if (open) el.style.setProperty('display', 'flex', 'important');
      else el.style.removeProperty('display');
    }
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!section.classList.contains('bb-layers-open'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && section.classList.contains('bb-layers-open')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!section.classList.contains('bb-layers-open')) return;
    const target = e.target as Element | null;
    if (target && target.closest(`${CONTROLS}, .layer-help-popup`)) return;
    setOpen(false);
  });
}

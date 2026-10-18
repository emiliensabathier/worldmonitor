// "Related study" links from Terminal panels to the labs published on emiliensabathier.fr/labs/.
interface Lab { tag: string; question: string; report: string }
export interface LabsData { labs: Lab[]; fr: Record<string, { question?: string }> }

export const LAB_LINKS: Record<string, string[]> = {
  'yield-curve': ['rates-lab'],
  bonds: ['rates-lab'],
  markets: ['options-lab'],
  'fear-greed': ['options-lab'],
  fsi: ['credit-lab'],
  'macro-signals': ['portfolio-lab'],
  heatmap: ['valuation-lab', 'equity-lab · live'],
  'earnings-calendar': ['valuation-lab', 'equity-lab · live'],
};

export function resolveLabLinks(panelKey: string, labs: Lab[], fr: LabsData['fr'], lang: string): { text: string; href: string }[] {
  const isFr = lang.toLowerCase().startsWith('fr');
  return (LAB_LINKS[panelKey] ?? []).flatMap((tag) => {
    const lab = labs.find((l) => l.tag === tag);
    if (!lab || typeof lab.report !== 'string' || typeof lab.question !== 'string') return [];
    const live = tag.includes('· live');
    const question = (isFr && fr[tag]?.question) || lab.question;
    const lead = isFr ? (live ? 'Outil lié : ' : 'Étude liée : ') : (live ? 'Related tool: ' : 'Related study: ');
    return [{ text: `${lead}${question} →`, href: lab.report }];
  });
}

let cache: Promise<LabsData> | null = null;
export function loadLabsData(): Promise<LabsData> {
  cache ??= Promise.all([
    fetch('/labs/labs.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    fetch('/labs/labs.fr.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]).then(([main, fr]) => ({ labs: Array.isArray(main?.labs) ? main.labs : [], fr: fr ?? {} }));
  cache.catch(() => { cache = null; });
  return cache;
}

export async function attachLabLinks(panelKey: string, panelEl: HTMLElement, lang: string, loader: () => Promise<LabsData> = loadLabsData): Promise<void> {
  if (!LAB_LINKS[panelKey] || panelEl.querySelector('.es-lab-link')) return;
  let data: LabsData;
  try { data = await loader(); } catch { return; }
  const links = resolveLabLinks(panelKey, data.labs, data.fr, lang);
  if (!links.length || panelEl.querySelector('.es-lab-link')) return;
  const row = document.createElement('p');
  row.className = 'es-lab-link';
  for (const l of links) {
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.text;
    row.append(a);
  }
  panelEl.append(row);
}

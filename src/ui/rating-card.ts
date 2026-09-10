import {
  DEFAULT_ENABLED_RATING_SOURCES,
  filterRatingsBySources,
  normalizeEnabledRatingSources,
  ratingSourceName,
  sourceCatalogWithRatings
} from '../core/rating-sources';
import type { RatingValue, RecognitionResult } from '../core/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface BrandVisual {
  color: string;
  kind: 'letter' | 'imdb' | 'rt' | 'metacritic' | 'letterboxd' | 'wikidata';
  label?: string;
}

const BRAND_VISUALS: Record<string, BrandVisual> = {
  Kinopoisk: { color: '#ff6600', kind: 'letter', label: 'K' },
  IMDb: { color: '#f5c518', kind: 'imdb' },
  'Rotten Tomatoes': { color: '#fa320a', kind: 'rt' },
  Metacritic: { color: '#ffcc34', kind: 'metacritic' },
  AllMovie: { color: '#1677ff', kind: 'letter', label: 'A' },
  Letterboxd: { color: '#00e054', kind: 'letterboxd' },
  Douban: { color: '#2e963d', kind: 'letter', label: '豆' },
  FilmAffinity: { color: '#5f8e97', kind: 'letter', label: 'FA' },
  'Trakt.tv': { color: '#ed1c24', kind: 'letter', label: 'T' },
  'Watcha!': { color: '#ff0558', kind: 'letter', label: 'W' },
  Wikidata: { color: '#7fc4ff', kind: 'wikidata' },
  TMDB: { color: '#90cea1', kind: 'letter', label: 'TM' }
};

const PLATFORM_HOSTS: Record<string, ReadonlySet<string>> = {
  IMDb: new Set(['imdb.com', 'www.imdb.com']),
  'Rotten Tomatoes': new Set(['rottentomatoes.com', 'www.rottentomatoes.com']),
  Metacritic: new Set(['metacritic.com', 'www.metacritic.com']),
  Kinopoisk: new Set(['kinopoisk.ru', 'www.kinopoisk.ru']),
  AllMovie: new Set(['allmovie.com', 'www.allmovie.com']),
  Letterboxd: new Set(['letterboxd.com', 'www.letterboxd.com']),
  Douban: new Set(['movie.douban.com']),
  FilmAffinity: new Set(['filmaffinity.com', 'www.filmaffinity.com']),
  'Trakt.tv': new Set(['trakt.tv', 'www.trakt.tv']),
  'Watcha!': new Set(['watcha.com', 'www.watcha.com']),
  Wikidata: new Set(['wikidata.org', 'www.wikidata.org'])
};

const STYLES = `
.tubescore-card {
  --tubescore-surface: #f2f2f2;
  --tubescore-chip: #ffffff;
  --tubescore-chip-hover: #e5e5e5;
  --tubescore-text: #0f0f0f;
  --tubescore-secondary: #606060;
  --tubescore-border: rgba(0, 0, 0, .10);
  --tubescore-hover-border: rgba(0, 0, 0, .17);
  --tubescore-drawer: #ffffff;
  --tubescore-accent: #065fd4;
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: minmax(154px, 188px) minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--tubescore-border);
  border-radius: 12px;
  background: var(--tubescore-surface);
  color: var(--tubescore-text);
  font-family: Roboto, Arial, sans-serif;
  line-height: 1.2;
}
html[dark] .tubescore-card, body[dark] .tubescore-card {
  --tubescore-surface: #181818;
  --tubescore-chip: #222222;
  --tubescore-chip-hover: #303030;
  --tubescore-text: #f1f1f1;
  --tubescore-secondary: #aaaaaa;
  --tubescore-border: rgba(255, 255, 255, .13);
  --tubescore-hover-border: rgba(255, 255, 255, .22);
  --tubescore-drawer: #181a1d;
  --tubescore-accent: #3ea6ff;
}
.tubescore-card *, .tubescore-card *::before, .tubescore-card *::after { box-sizing: border-box; }
.tubescore-card button, .tubescore-card input { font: inherit; }
.tubescore-card__summary {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 6px 4px 5px;
}
.tubescore-card__brand {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 4px;
  color: var(--tubescore-text);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -.1px;
}
.tubescore-card__brand-mark { display: inline-flex; align-items: flex-end; gap: 2px; width: 21px; height: 18px; color: #ff0033; }
.tubescore-card__brand-mark i { display: block; width: 3px; border-radius: 2px 2px 0 0; background: currentColor; }
.tubescore-card__brand-mark i:nth-child(1) { height: 8px; }
.tubescore-card__brand-mark i:nth-child(2) { height: 15px; }
.tubescore-card__brand-mark i:nth-child(3) { height: 11px; }
.tubescore-card__brand-mark i:nth-child(4) { height: 18px; }
.tubescore-card__title {
  display: -webkit-box;
  margin-top: 9px;
  overflow: hidden;
  color: var(--tubescore-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.25;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.tubescore-card__meta { margin-top: 5px; color: var(--tubescore-secondary); font-size: 12px; }
.tubescore-card__settings-button {
  display: grid;
  width: 34px;
  height: 34px;
  margin-top: auto;
  transform: translateY(-3px);
  place-items: center;
  border: 1px solid var(--tubescore-border);
  border-radius: 9px;
  background: var(--tubescore-chip);
  color: var(--tubescore-secondary);
  cursor: pointer;
}
.tubescore-card__settings-button:hover { background: var(--tubescore-chip-hover); color: var(--tubescore-text); }
.tubescore-card__settings-button:focus-visible,
.tubescore-card__settings-close:focus-visible,
.tubescore-card__settings-done:focus-visible,
.tubescore-card__settings-reset:focus-visible {
  outline: 2px solid var(--tubescore-accent);
  outline-offset: 2px;
}
.tubescore-card__settings-button svg { width: 18px; height: 18px; fill: currentColor; }
.tubescore-card__ratings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  min-width: 0;
  align-content: start;
}
.tubescore-card__rating {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(70px, 1fr) 18px;
  grid-template-rows: auto auto;
  grid-template-areas: 'icon source arrow' 'icon value arrow';
  min-width: 0;
  min-height: 62px;
  padding: 9px 10px;
  border: 1px solid var(--tubescore-border);
  border-radius: 11px;
  background: var(--tubescore-chip);
  color: var(--tubescore-text);
  text-decoration: none;
  cursor: default;
  user-select: none;
  transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}
a.tubescore-card__rating { cursor: pointer; }
a.tubescore-card__rating:hover {
  background: var(--tubescore-chip-hover);
  border-color: var(--tubescore-hover-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .14);
  transform: translateY(-1px);
}
a.tubescore-card__rating:focus-visible {
  outline: 2px solid #065fd4;
  outline-offset: 2px;
  border-color: transparent;
}
html[dark] a.tubescore-card__rating:focus-visible, body[dark] a.tubescore-card__rating:focus-visible { outline-color: #3ea6ff; }
.tubescore-card__rating-icon { grid-area: icon; align-self: center; display: grid; place-items: center; width: 28px; height: 28px; color: var(--tubescore-brand, #606060); }
.tubescore-card__rating-icon svg { display: block; width: 27px; height: 27px; overflow: visible; }
.tubescore-card__rating-source { grid-area: source; align-self: end; overflow: hidden; color: var(--tubescore-text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.tubescore-card__rating-value { grid-area: value; align-self: start; margin-top: 2px; color: var(--tubescore-text); font-size: 19px; font-weight: 650; letter-spacing: -.2px; white-space: nowrap; }
.tubescore-card__rating-arrow { grid-area: arrow; align-self: center; justify-self: end; width: 15px; height: 15px; color: var(--tubescore-secondary); opacity: .9; }
.tubescore-card__rating-arrow svg { display: block; width: 15px; height: 15px; fill: currentColor; }
.tubescore-card__empty { display: grid; min-height: 62px; place-items: center; border: 1px solid var(--tubescore-border); border-radius: 11px; background: var(--tubescore-chip); color: var(--tubescore-secondary); font-size: 22px; }
.tubescore-card__settings-panel {
  position: absolute;
  z-index: 1000;
  top: 9px;
  right: 9px;
  display: flex;
  flex-direction: column;
  width: min(310px, calc(100% - 18px));
  max-height: min(430px, calc(100vh - 52px));
  overflow: hidden;
  border: 1px solid var(--tubescore-border);
  border-radius: 12px;
  background: var(--tubescore-drawer);
  color: var(--tubescore-text);
  box-shadow: 0 14px 36px rgba(0, 0, 0, .34);
}
.tubescore-card__settings-panel[hidden] { display: none !important; }
.tubescore-card__settings-header { display: grid; grid-template-columns: 1fr 30px; gap: 8px; padding: 14px 14px 11px; border-bottom: 1px solid var(--tubescore-border); }
.tubescore-card__settings-title { font-size: 16px; font-weight: 700; }
.tubescore-card__settings-help { grid-column: 1 / -1; color: var(--tubescore-secondary); font-size: 12px; line-height: 1.35; }
.tubescore-card__settings-close { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 7px; background: transparent; color: var(--tubescore-secondary); cursor: pointer; }
.tubescore-card__settings-close:hover { background: var(--tubescore-chip-hover); color: var(--tubescore-text); }
.tubescore-card__settings-close svg { width: 16px; height: 16px; fill: currentColor; }
.tubescore-card__source-list { overflow: auto; padding: 6px 7px; }
.tubescore-card__source-row { display: grid; grid-template-columns: 27px minmax(0, 1fr) 22px; gap: 9px; min-height: 38px; padding: 5px 6px; align-items: center; border-radius: 7px; cursor: pointer; }
.tubescore-card__source-row:hover { background: var(--tubescore-chip-hover); }
.tubescore-card__source-row .tubescore-card__rating-icon { width: 24px; height: 24px; }
.tubescore-card__source-row .tubescore-card__rating-icon svg { width: 23px; height: 23px; }
.tubescore-card__source-name { overflow: hidden; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.tubescore-card__source-checkbox { width: 17px; height: 17px; margin: 0; accent-color: #1677e8; cursor: pointer; }
.tubescore-card__settings-footer { display: flex; gap: 10px; justify-content: space-between; align-items: center; padding: 10px 12px; border-top: 1px solid var(--tubescore-border); }
.tubescore-card__settings-reset { padding: 4px 2px; border: 0; background: transparent; color: var(--tubescore-secondary); font-size: 12px; text-decoration: underline; cursor: pointer; }
.tubescore-card__settings-reset:hover { color: var(--tubescore-text); }
.tubescore-card__settings-done { min-width: 76px; padding: 8px 16px; border: 0; border-radius: 9px; background: #1677e8; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.tubescore-card__settings-done:hover { background: #1268cc; }
.tubescore-card[data-tubescore-state='error'] { grid-template-columns: 1fr; }
@media (max-width: 820px) {
  .tubescore-card { grid-template-columns: 1fr; }
  .tubescore-card__summary { min-height: 116px; }
  .tubescore-card__settings-button { margin-top: 9px; transform: none; }
  .tubescore-card__ratings { grid-template-columns: repeat(auto-fit, minmax(142px, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .tubescore-card__rating { transition: none; }
  a.tubescore-card__rating:hover { transform: none; }
}
`;

export interface RatingCardRenderOptions {
  enabledSources?: readonly string[];
  onEnabledSourcesChange?(sources: string[]): void | Promise<void>;
}

function mediaTypeLabel(mediaType: 'movie' | 'tv'): string {
  return mediaType === 'movie' ? 'Movie' : 'TV';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

function formatRatingValue(value: number, scale: number): string {
  return `${formatNumber(value)}/${formatNumber(scale)}`;
}

function safePlatformUrl(name: string, value: string | undefined): string | null {
  if (!value) return null;
  const hosts = PLATFORM_HOSTS[name];
  if (!hosts) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.has(url.hostname.toLowerCase()) ? url.href : null;
  } catch {
    return null;
  }
}

function ensureStyles(doc: Document): void {
  if (doc.querySelector('style[data-tubescore-styles]')) return;
  const style = doc.createElement('style');
  style.dataset.tubescoreStyles = 'true';
  style.textContent = STYLES;
  (doc.head ?? doc.documentElement).append(style);
}

function svgElement<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K): SVGElementTagNameMap[K] {
  return doc.createElementNS(SVG_NS, tag);
}

function appendSvgText(doc: Document, svg: SVGSVGElement, text: string, attributes: Record<string, string> = {}): void {
  const label = svgElement(doc, 'text');
  label.textContent = text;
  for (const [name, value] of Object.entries(attributes)) label.setAttribute(name, value);
  svg.append(label);
}

function brandIcon(doc: Document, rawName: string): HTMLElement {
  const name = ratingSourceName(rawName);
  const visual = BRAND_VISUALS[name] ?? { color: '#8a8a8a', kind: 'letter' as const, label: name.slice(0, 1).toUpperCase() || '?' };
  const wrapper = doc.createElement('span');
  wrapper.className = 'tubescore-card__rating-icon';
  wrapper.style.setProperty('--tubescore-brand', visual.color);

  const svg = svgElement(doc, 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  if (visual.kind === 'imdb') {
    const rect = svgElement(doc, 'rect');
    rect.setAttribute('x', '1'); rect.setAttribute('y', '4'); rect.setAttribute('width', '26'); rect.setAttribute('height', '20'); rect.setAttribute('rx', '3'); rect.setAttribute('fill', visual.color);
    svg.append(rect);
    appendSvgText(doc, svg, 'IMDb', { x: '14', y: '17.5', 'text-anchor': 'middle', 'font-size': '8', 'font-weight': '800', fill: '#111' });
  } else if (visual.kind === 'rt') {
    const circle = svgElement(doc, 'circle');
    circle.setAttribute('cx', '14'); circle.setAttribute('cy', '14'); circle.setAttribute('r', '12'); circle.setAttribute('fill', visual.color);
    svg.append(circle);
    appendSvgText(doc, svg, 'RT', { x: '14', y: '18', 'text-anchor': 'middle', 'font-size': '10', 'font-weight': '800', fill: '#151515' });
  } else if (visual.kind === 'metacritic') {
    const circle = svgElement(doc, 'circle');
    circle.setAttribute('cx', '14'); circle.setAttribute('cy', '14'); circle.setAttribute('r', '11'); circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', visual.color); circle.setAttribute('stroke-width', '3');
    svg.append(circle);
    appendSvgText(doc, svg, 'M', { x: '14', y: '19', 'text-anchor': 'middle', 'font-size': '13', 'font-weight': '800', fill: 'currentColor' });
  } else if (visual.kind === 'letterboxd') {
    for (const [cx, fill] of [['8', '#ff8000'], ['14', '#00e054'], ['20', '#40bcf4']] as const) {
      const circle = svgElement(doc, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', '14'); circle.setAttribute('r', '5.5'); circle.setAttribute('fill', fill);
      svg.append(circle);
    }
  } else if (visual.kind === 'wikidata') {
    const colors = ['#990000', '#339966', '#006699', '#990000', '#339966', '#006699'];
    colors.forEach((fill, index) => {
      const rect = svgElement(doc, 'rect');
      rect.setAttribute('x', String(2 + index * 4)); rect.setAttribute('y', index % 2 === 0 ? '4' : '7'); rect.setAttribute('width', '2.5'); rect.setAttribute('height', index % 2 === 0 ? '20' : '17'); rect.setAttribute('fill', fill);
      svg.append(rect);
    });
  } else {
    const circle = svgElement(doc, 'circle');
    circle.setAttribute('cx', '14'); circle.setAttribute('cy', '14'); circle.setAttribute('r', '12'); circle.setAttribute('fill', visual.color);
    svg.append(circle);
    appendSvgText(doc, svg, visual.label ?? name.slice(0, 1).toUpperCase(), {
      x: '14', y: '18.5', 'text-anchor': 'middle', 'font-size': (visual.label?.length ?? 1) > 1 ? '8' : '13', 'font-weight': '800', fill: '#fff'
    });
  }

  wrapper.append(svg);
  return wrapper;
}

function externalLinkIcon(doc: Document): HTMLElement {
  const wrapper = doc.createElement('span');
  wrapper.className = 'tubescore-card__rating-arrow';
  const svg = svgElement(doc, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = svgElement(doc, 'path');
  path.setAttribute('d', 'M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3ZM5 5h6v2H5v12h12v-6h2v8H3V5h2Z');
  svg.append(path);
  wrapper.append(svg);
  return wrapper;
}

function gearIcon(doc: Document): SVGSVGElement {
  const svg = svgElement(doc, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = svgElement(doc, 'path');
  path.setAttribute('d', 'M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.08-.98l2.11-1.65-2-3.46-2.49 1a7.2 7.2 0 0 0-1.69-.98L15 3.25h-4l-.36 2.67c-.61.25-1.17.58-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.33-.07.66-.07.99s.03.66.07.98l-2.11 1.65 2 3.46 2.49-1c.52.4 1.08.73 1.69.98L11 20.75h4l.36-2.67c.61-.25 1.17-.58 1.69-.98l2.49 1 2-3.46-2.11-1.66ZM13 18.75h-2l-.29-2.16-.64-.24a5.3 5.3 0 0 1-1.42-.82l-.53-.42-2 .8-1-1.73 1.7-1.33-.1-.68a5.5 5.5 0 0 1 0-1.66l.1-.68-1.7-1.33 1-1.73 2 .8.53-.42a5.3 5.3 0 0 1 1.42-.82l.64-.24L11 5.25h2l.29 2.16.64.24c.51.2.99.47 1.42.82l.53.42 2-.8 1 1.73-1.7 1.33.1.68c.08.55.08 1.11 0 1.66l-.1.68 1.7 1.33-1 1.73-2-.8-.53.42c-.43.35-.91.62-1.42.82l-.64.24L13 18.75ZM12 8.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-7Zm0 5A1.5 1.5 0 1 1 12 10a1.5 1.5 0 0 1 0 3.5Z');
  svg.append(path);
  return svg;
}

function closeIcon(doc: Document): SVGSVGElement {
  const svg = svgElement(doc, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = svgElement(doc, 'path');
  path.setAttribute('d', 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z');
  svg.append(path);
  return svg;
}

function ratingBadge(doc: Document, rating: RatingValue): HTMLElement {
  const name = ratingSourceName(rating.source);
  const destination = safePlatformUrl(name, rating.url);
  const item = destination ? doc.createElement('a') : doc.createElement('span');
  item.className = 'tubescore-card__rating';
  item.style.setProperty('--tubescore-brand', BRAND_VISUALS[name]?.color ?? '#777');

  if (destination && item.tagName === 'A') {
    const link = item as HTMLAnchorElement;
    link.href = destination;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${name} ${formatNumber(rating.value)} out of ${formatNumber(rating.scale)} — open on ${name}`);
  } else {
    item.setAttribute('aria-label', `${name} ${formatNumber(rating.value)} out of ${formatNumber(rating.scale)}`);
  }

  const label = doc.createElement('span');
  label.className = 'tubescore-card__rating-source';
  label.textContent = name;

  const value = doc.createElement('span');
  value.className = 'tubescore-card__rating-value';
  value.textContent = formatRatingValue(rating.value, rating.scale);

  item.append(brandIcon(doc, name), label, value);
  if (destination) item.append(externalLinkIcon(doc));
  return item;
}

function stopYouTubeInteractionLeak(card: HTMLElement): void {
  for (const type of ['pointerdown', 'mousedown', 'click', 'keydown', 'keyup'] as const) {
    card.addEventListener(type, (event) => event.stopPropagation());
  }
}

function brandHeader(doc: Document, suffix?: 'Likely' | 'Unavailable'): HTMLElement {
  const header = doc.createElement('div');
  header.className = 'tubescore-card__brand';

  const mark = doc.createElement('span');
  mark.className = 'tubescore-card__brand-mark';
  mark.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i += 1) mark.append(doc.createElement('i'));

  const text = doc.createElement('span');
  text.textContent = suffix ? `TubeScore · ${suffix}` : 'TubeScore';
  header.append(mark, text);
  return header;
}

function settingsButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'tubescore-card__settings-button';
  button.setAttribute('aria-label', 'Select rating services');
  button.setAttribute('aria-expanded', 'false');
  button.append(gearIcon(doc));
  return button;
}

function createSettingsPanel(
  doc: Document,
  result: RecognitionResult,
  selected: Set<string>,
  rerenderRatings: () => void,
  onDone: (sources: string[]) => void
): HTMLElement {
  const panel = doc.createElement('aside');
  panel.className = 'tubescore-card__settings-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Rating service settings');

  const header = doc.createElement('div');
  header.className = 'tubescore-card__settings-header';
  const title = doc.createElement('strong');
  title.className = 'tubescore-card__settings-title';
  title.textContent = 'Select rating services';
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'tubescore-card__settings-close';
  close.setAttribute('aria-label', 'Close rating service settings');
  close.append(closeIcon(doc));
  const help = doc.createElement('span');
  help.className = 'tubescore-card__settings-help';
  help.textContent = 'Choose which rating services TubeScore searches for and shows on this page.';
  header.append(title, close, help);

  const list = doc.createElement('div');
  list.className = 'tubescore-card__source-list';
  const catalog = sourceCatalogWithRatings(result.ratings);
  const checkboxes = new Map<string, HTMLInputElement>();

  for (const name of catalog) {
    const row = doc.createElement('label');
    row.className = 'tubescore-card__source-row';
    row.append(brandIcon(doc, name));

    const label = doc.createElement('span');
    label.className = 'tubescore-card__source-name';
    label.textContent = name;

    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tubescore-card__source-checkbox';
    checkbox.dataset.sourceName = name;
    checkbox.checked = selected.has(name);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(name);
      else selected.delete(name);
      rerenderRatings();
    });
    checkboxes.set(name, checkbox);
    row.append(label, checkbox);
    list.append(row);
  }

  const footer = doc.createElement('div');
  footer.className = 'tubescore-card__settings-footer';
  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.className = 'tubescore-card__settings-reset';
  reset.textContent = 'Reset to recommended';
  reset.addEventListener('click', () => {
    selected.clear();
    for (const name of DEFAULT_ENABLED_RATING_SOURCES) selected.add(name);
    for (const [name, checkbox] of checkboxes) checkbox.checked = selected.has(name);
    rerenderRatings();
  });

  const done = doc.createElement('button');
  done.type = 'button';
  done.className = 'tubescore-card__settings-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => {
    const ordered = catalog.filter((name) => selected.has(name));
    panel.hidden = true;
    onDone(ordered);
  });

  close.addEventListener('click', () => {
    panel.hidden = true;
  });
  footer.append(reset, done);
  panel.append(header, list, footer);
  return panel;
}

export function renderUnavailableCard(): HTMLElement {
  const doc = document;
  ensureStyles(doc);
  const card = doc.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = 'error';
  stopYouTubeInteractionLeak(card);

  const summary = doc.createElement('div');
  summary.className = 'tubescore-card__summary';
  summary.append(brandHeader(doc, 'Unavailable'));

  const message = doc.createElement('span');
  message.className = 'tubescore-card__meta';
  message.textContent = 'Ratings could not be loaded.';
  summary.append(message);

  card.append(summary);
  return card;
}

export function renderRatingCard(
  result: RecognitionResult,
  options: RatingCardRenderOptions = {}
): HTMLElement {
  const doc = document;
  ensureStyles(doc);
  const card = doc.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = result.decision.state;
  stopYouTubeInteractionLeak(card);

  if (result.decision.state === 'hidden') {
    card.hidden = true;
    return card;
  }

  const enabledSources = normalizeEnabledRatingSources(
    options.enabledSources ?? DEFAULT_ENABLED_RATING_SOURCES
  );
  const selected = new Set(enabledSources);
  const { candidate } = result.decision.score;
  const summary = doc.createElement('div');
  summary.className = 'tubescore-card__summary';
  summary.append(brandHeader(doc, result.decision.state === 'likely' ? 'Likely' : undefined));

  const title = doc.createElement('strong');
  title.className = 'tubescore-card__title';
  title.textContent = candidate.title;

  const meta = doc.createElement('span');
  meta.className = 'tubescore-card__meta';
  meta.textContent = candidate.releaseYear
    ? `${mediaTypeLabel(candidate.mediaType)} · ${candidate.releaseYear}`
    : mediaTypeLabel(candidate.mediaType);

  const gear = settingsButton(doc);
  summary.append(title, meta, gear);

  const ratings = doc.createElement('div');
  ratings.className = 'tubescore-card__ratings';

  const renderRatings = (): void => {
    ratings.replaceChildren();
    const visible = filterRatingsBySources(result.ratings, [...selected]);
    if (visible.length === 0) {
      const item = doc.createElement('span');
      item.className = 'tubescore-card__empty';
      item.textContent = '—';
      item.setAttribute('aria-label', 'No ratings available');
      ratings.append(item);
      return;
    }
    for (const rating of visible) ratings.append(ratingBadge(doc, rating));
  };
  renderRatings();

  const panel = createSettingsPanel(doc, result, selected, renderRatings, (sources) => {
    gear.setAttribute('aria-expanded', 'false');
    void options.onEnabledSourcesChange?.(sources);
  });
  gear.addEventListener('click', () => {
    panel.hidden = false;
    gear.setAttribute('aria-expanded', 'true');
  });
  panel.querySelector('.tubescore-card__settings-close')?.addEventListener('click', () => {
    gear.setAttribute('aria-expanded', 'false');
  });

  card.append(summary, ratings, panel);
  return card;
}

import type { RatingValue, RecognitionResult } from '../core/types';

const STYLE_ID = 'tubescore-card-styles';

const BRAND_ICONS: Record<string, { path: string; className: string }> = {
  IMDb: {
    className: 'imdb',
    path: 'M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z'
  },
  'Rotten Tomatoes': {
    className: 'rottentomatoes',
    path: 'M5.866 0L4.335 1.262l2.082 1.8c-2.629-.989-4.842 1.4-5.012 2.338 1.384-.323 2.24-.422 3.344-.335-7.042 4.634-4.978 13.148-1.434 16.094 5.784 4.612 13.77 3.202 17.91-1.316C27.26 13.363 22.993.65 10.86 2.766c.107-1.17.633-1.503 1.243-1.602-.89-1.493-3.67-.734-4.556 1.374C7.52 2.602 5.866 0 5.866 0zM4.422 7.217H6.9c2.673 0 2.898.012 3.55.202 1.06.307 1.868.973 2.313 1.904.05.106.092.206.13.305l7.623.008.027 2.912-2.745-.024v7.549l-2.982-.016v-7.522l-2.127.016a2.92 2.92 0 0 1-1.056 1.134c-.287.176-.3.19-.254.264.127.2 2.125 3.642 2.125 3.659l-3.39.019-2.013-3.376c-.034-.047-.122-.068-.344-.084l-.297-.02.037 3.48-3.075-.038zm3.016 2.288l.024.338c.014.186.024.729.024 1.206v.867l.582-.025c.32-.013.695-.049.833-.078.694-.146 1.048-.478 1.087-1.018.027-.378-.063-.636-.303-.87-.318-.309-.761-.416-1.733-.418Z'
  },
  Metacritic: {
    className: 'metacritic',
    path: 'M11.99 0A12 12 0 1 0 24 12v-.014A12 12 0 0 0 11.99 0Zm-.055 2.564a9.399 9.399 0 0 1 9.407 9.389v.01a9.399 9.399 0 1 1-9.408-9.399Zm-1.61 17.198 2.046-2.046-3.94-3.94c-.165-.166-.345-.373-.442-.608-.221-.47-.318-1.203.221-1.742.664-.664 1.548-.387 2.406.47l3.788 3.788 2.046-2.046-3.954-3.954a2.48 2.48 0 0 1-.456-.622c-.263-.539-.25-1.216.235-1.7.677-.678 1.562-.429 2.544.553l3.677 3.677 2.046-2.046-3.982-3.982c-2.018-2.018-3.912-1.949-5.212-.65-.498.499-.802 1.024-.954 1.618a4.026 4.026 0 0 0-.055 1.686l-.027.028c-.996-.414-2.13-.166-3 .705-1.162 1.161-1.12 2.392-.982 3.11l-.042.043-1.009-.816-1.77 1.77a64.1 64.1 0 0 1 2.213 2.1z'
  },
  Kinopoisk: {
    className: 'kinopoisk',
    path: 'M12.049 0C5.45 0 .104 5.373.104 12S5.45 24 12.049 24c3.928 0 7.414-1.904 9.592-4.844l-9.803-5.174 6.256 6.418h-3.559l-4.373-6.086V20.4h-2.89V3.6h2.89v6.095L14.535 3.6h3.559l-6.422 6.627 9.98-5.368C19.476 1.911 15.984 0 12.05 0zm10.924 7.133-9.994 4.027 10.917-.713a11.963 11.963 0 0 0-.923-3.314zm-10.065 5.68 10.065 4.054c.458-1.036.774-2.149.923-3.314l-10.988-.74z'
  }
};

const CARD_STYLES = `
.tubescore-card {
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 0;
  padding: 12px;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.12));
  border-radius: 12px;
  background: var(--yt-spec-raised-background, #272727);
  color: var(--yt-spec-text-primary, #f1f1f1);
  font-family: Roboto, Arial, sans-serif;
  display: grid;
  grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}
.tubescore-card *, .tubescore-card *::before, .tubescore-card *::after { box-sizing: border-box; }
.tubescore-card__summary { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 2px 4px; }
.tubescore-card__brand-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
.tubescore-card__brand { font-size: 16px; font-weight: 700; line-height: 20px; letter-spacing: -.1px; }
.tubescore-card__signal { display: inline-flex; align-items: flex-end; gap: 2px; height: 16px; color: #ff0033; }
.tubescore-card__signal i { display: block; width: 3px; border-radius: 2px; background: currentColor; }
.tubescore-card__signal i:nth-child(1) { height: 7px; }
.tubescore-card__signal i:nth-child(2) { height: 12px; }
.tubescore-card__signal i:nth-child(3) { height: 16px; }
.tubescore-card__confidence { padding: 2px 6px; border-radius: 6px; background: var(--yt-spec-badge-chip-background, rgba(255,255,255,.1)); color: var(--yt-spec-text-secondary, #aaa); font-size: 10px; font-weight: 600; line-height: 14px; text-transform: uppercase; letter-spacing: .3px; }
.tubescore-card__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--yt-spec-text-primary, #f1f1f1); font-size: 13px; font-weight: 500; line-height: 18px; }
.tubescore-card__meta { align-self: flex-start; color: var(--yt-spec-text-secondary, #aaa); font-size: 11px; line-height: 15px; }
.tubescore-card__ratings { min-width: 0; display: flex; gap: 8px; overflow-x: auto; padding: 2px; scrollbar-width: none; }
.tubescore-card__ratings::-webkit-scrollbar { display: none; }
.tubescore-rating {
  flex: 1 0 145px;
  min-width: 145px;
  max-width: 210px;
  min-height: 66px;
  padding: 10px 12px;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.12));
  border-radius: 12px;
  background: var(--yt-spec-badge-chip-background, rgba(255,255,255,.08));
  color: var(--yt-spec-text-primary, #f1f1f1);
  text-decoration: none !important;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
  -webkit-tap-highlight-color: transparent;
}
.tubescore-rating:hover { background: var(--yt-spec-button-chip-background-hover, rgba(255,255,255,.14)); border-color: rgba(255,255,255,.2); }
.tubescore-rating:active { transform: scale(.985); }
.tubescore-rating:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 2px; }
.tubescore-rating--static { cursor: default; }
.tubescore-rating--static:hover { background: var(--yt-spec-badge-chip-background, rgba(255,255,255,.08)); border-color: var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); }
.tubescore-rating__icon { grid-row: 1 / span 2; width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; overflow: hidden; }
.tubescore-rating__icon svg { width: 24px; height: 24px; fill: currentColor; }
.tubescore-rating__icon--imdb { background: #f5c518; color: #000; padding: 4px; }
.tubescore-rating__icon--rottentomatoes { color: #fa320a; }
.tubescore-rating__icon--metacritic { color: #ffd500; }
.tubescore-rating__icon--kinopoisk { color: #ff6600; }
.tubescore-rating__fallback { font-size: 13px; font-weight: 700; color: var(--yt-spec-text-secondary, #aaa); }
.tubescore-rating__source { align-self: end; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--yt-spec-text-secondary, #aaa); font-size: 12px; font-weight: 500; line-height: 16px; }
.tubescore-rating__value { align-self: start; color: var(--yt-spec-text-primary, #f1f1f1); font-size: 22px; font-weight: 700; line-height: 26px; letter-spacing: -.25px; font-variant-numeric: tabular-nums; }
.tubescore-card__empty { min-height: 66px; min-width: 96px; display: grid; place-items: center; color: var(--yt-spec-text-secondary, #aaa); font-size: 28px; }
.tubescore-card[data-tubescore-state="error"] { grid-template-columns: 1fr; }
.tubescore-card[data-tubescore-state="error"] .tubescore-card__meta { font-size: 13px; }
@media (max-width: 760px) {
  .tubescore-card { grid-template-columns: 1fr; }
  .tubescore-card__summary { padding-bottom: 0; }
  .tubescore-rating { flex-basis: 138px; }
}
@media (prefers-reduced-motion: reduce) {
  .tubescore-rating { transition: none; }
}
`;

function mediaTypeLabel(mediaType: 'movie' | 'tv'): string {
  return mediaType === 'movie' ? 'Movie' : 'TV';
}

function sourceName(source: string): string {
  return source.replace(/\s+via Wikidata$/i, '').trim();
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CARD_STYLES;
  (doc.head ?? doc.documentElement).append(style);
}

function createSignal(doc: Document): HTMLElement {
  const signal = doc.createElement('span');
  signal.className = 'tubescore-card__signal';
  signal.setAttribute('aria-hidden', 'true');
  signal.append(doc.createElement('i'), doc.createElement('i'), doc.createElement('i'));
  return signal;
}

function createBrandIcon(doc: Document, name: string): HTMLElement {
  const icon = doc.createElement('span');
  icon.className = 'tubescore-rating__icon';
  icon.setAttribute('aria-hidden', 'true');

  const brand = BRAND_ICONS[name];
  if (!brand) {
    const fallback = doc.createElement('span');
    fallback.className = 'tubescore-rating__fallback';
    fallback.textContent = name.slice(0, 2).toUpperCase();
    icon.append(fallback);
    return icon;
  }

  icon.classList.add(`tubescore-rating__icon--${brand.className}`);
  icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="${brand.path}"></path></svg>`;
  return icon;
}

function ratingLabel(rating: RatingValue): string {
  return `${rating.value}/${rating.scale}`;
}

function createRating(doc: Document, rating: RatingValue, title: string): HTMLElement {
  const name = sourceName(rating.source);
  const item = rating.url ? doc.createElement('a') : doc.createElement('div');
  item.className = 'tubescore-rating';

  if (item instanceof HTMLAnchorElement) {
    item.href = rating.url!;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.setAttribute('aria-label', `Open ${name} rating for ${title} in a new tab`);
    const stopPropagation = (event: Event) => event.stopPropagation();
    item.addEventListener('pointerdown', stopPropagation);
    item.addEventListener('click', stopPropagation);
    item.addEventListener('auxclick', stopPropagation);
  } else {
    item.classList.add('tubescore-rating--static');
  }

  const source = doc.createElement('span');
  source.className = 'tubescore-rating__source';
  source.textContent = name;

  const value = doc.createElement('strong');
  value.className = 'tubescore-rating__value';
  value.textContent = ratingLabel(rating);

  item.append(createBrandIcon(doc, name), source, value);
  return item;
}

export function renderUnavailableCard(): HTMLElement {
  const doc = document;
  ensureStyles(doc);

  const card = doc.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = 'error';

  const header = doc.createElement('div');
  header.className = 'tubescore-card__brand';
  header.textContent = 'TubeScore · Unavailable';

  const message = doc.createElement('span');
  message.className = 'tubescore-card__meta';
  message.textContent = 'Ratings could not be loaded.';

  card.append(header, message);
  return card;
}

export function renderRatingCard(result: RecognitionResult): HTMLElement {
  const doc = document;
  ensureStyles(doc);

  const card = doc.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = result.decision.state;

  if (result.decision.state === 'hidden') {
    card.hidden = true;
    return card;
  }

  const { candidate } = result.decision.score;
  const titleText = candidate.releaseYear
    ? `${candidate.title} (${candidate.releaseYear})`
    : candidate.title;

  const summary = doc.createElement('div');
  summary.className = 'tubescore-card__summary';

  const brandRow = doc.createElement('div');
  brandRow.className = 'tubescore-card__brand-row';
  brandRow.append(createSignal(doc));

  const header = doc.createElement('div');
  header.className = 'tubescore-card__brand';
  header.textContent = 'TubeScore';
  brandRow.append(header);

  if (result.decision.state === 'likely') {
    const confidence = doc.createElement('span');
    confidence.className = 'tubescore-card__confidence';
    confidence.textContent = 'Likely';
    brandRow.append(confidence);
  }

  const title = doc.createElement('strong');
  title.className = 'tubescore-card__title';
  title.textContent = titleText;

  const meta = doc.createElement('span');
  meta.className = 'tubescore-card__meta';
  meta.textContent = mediaTypeLabel(candidate.mediaType);

  summary.append(brandRow, title, meta);

  const ratings = doc.createElement('div');
  ratings.className = 'tubescore-card__ratings';

  if (result.ratings.length === 0) {
    const empty = doc.createElement('span');
    empty.className = 'tubescore-card__empty';
    empty.textContent = '—';
    empty.setAttribute('aria-label', 'No ratings available');
    ratings.append(empty);
  } else {
    for (const rating of result.ratings) {
      ratings.append(createRating(doc, rating, titleText));
    }
  }

  card.append(summary, ratings);
  return card;
}

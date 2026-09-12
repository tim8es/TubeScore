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
  kind: 'path' | 'badge' | 'letterboxd' | 'wikidata';
  path?: string;
  label?: string;
  labelColor?: string;
}

// Brand vectors are embedded locally so the extension does not make image requests at runtime.
// Paths for the supported public brand marks follow their canonical 24x24 vector forms.
const BRAND_VISUALS: Record<string, BrandVisual> = {
  Kinopoisk: {
    color: '#ff6600',
    kind: 'path',
    path: 'M12.049 0C5.45 0 .104 5.373.104 12S5.45 24 12.049 24c3.928 0 7.414-1.904 9.592-4.844l-9.803-5.174 6.256 6.418h-3.559l-4.373-6.086V20.4h-2.89V3.6h2.89v6.095L14.535 3.6h3.559l-6.422 6.627 9.98-5.368C19.476 1.911 15.984 0 12.05 0zm10.924 7.133-9.994 4.027 10.917-.713a11.963 11.963 0 0 0-.923-3.314zm-10.065 5.68 10.065 4.054c.458-1.036.774-2.149.923-3.314l-10.988-.74z'
  },
  IMDb: {
    color: '#f5c518',
    kind: 'path',
    path: 'M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z'
  },
  'Rotten Tomatoes': {
    color: '#fa320a',
    kind: 'path',
    path: 'M5.866 0L4.335 1.262l2.082 1.8c-2.629-.989-4.842 1.4-5.012 2.338 1.384-.323 2.24-.422 3.344-.335-7.042 4.634-4.978 13.148-1.434 16.094 5.784 4.612 13.77 3.202 17.91-1.316C27.26 13.363 22.993.65 10.86 2.766c.107-1.17.633-1.503 1.243-1.602-.89-1.493-3.67-.734-4.556 1.374C7.52 2.602 5.866 0 5.866 0zM4.422 7.217H6.9c2.673 0 2.898.012 3.55.202 1.06.307 1.868.973 2.313 1.904.05.106.092.206.13.305l7.623.008.027 2.912-2.745-.024v7.549l-2.982-.016v-7.522l-2.127.016a2.92 2.92 0 0 1-1.056 1.134c-.287.176-.3.19-.254.264.127.2 2.125 3.642 2.125 3.659l-3.39.019-2.013-3.376c-.034-.047-.122-.068-.344-.084l-.297-.02.037 3.48-3.075-.038zm3.016 2.288l.024.338c.014.186.024.729.024 1.206v.867l.582-.025c.32-.013.695-.049.833-.078.694-.146 1.048-.478 1.087-1.018.027-.378-.063-.636-.303-.87-.318-.309-.761-.416-1.733-.418Z'
  },
  Metacritic: {
    color: '#ffcc34',
    kind: 'path',
    path: 'M11.99 0A12 12 0 1 0 24 12v-.014A12 12 0 0 0 11.99 0Zm-.055 2.564a9.399 9.399 0 0 1 9.407 9.389v.01a9.399 9.399 0 1 1-9.408-9.399Zm-1.61 17.198 2.046-2.046-3.94-3.94c-.165-.166-.345-.373-.442-.608-.221-.47-.318-1.203.221-1.742.664-.664 1.548-.387 2.406.47l3.788 3.788 2.046-2.046-3.954-3.954a2.48 2.48 0 0 1-.456-.622c-.263-.539-.25-1.216.235-1.7.677-.678 1.562-.429 2.544.553l3.677 3.677 2.046-2.046-3.982-3.982c-2.018-2.018-3.912-1.949-5.212-.65-.498.499-.802 1.024-.954 1.618a4.026 4.026 0 0 0-.055 1.686l-.027.028c-.996-.414-2.13-.166-3 .705-1.162 1.161-1.12 2.392-.982 3.11l-.042.043-1.009-.816-1.77 1.77a64.1 64.1 0 0 1 2.213 2.1z'
  },
  AllMovie: { color: '#1677ff', kind: 'badge', label: 'A' },
  Letterboxd: { color: '#00e054', kind: 'letterboxd' },
  Douban: {
    color: '#2e963d',
    kind: 'path',
    path: 'M.51 3.06h22.98V.755H.51V3.06Zm20.976 2.537v9.608h-2.137l-1.669 5.76H24v2.28H0v-2.28h6.32l-1.67-5.76H2.515V5.597h18.972Zm-5.066 9.608H7.58l1.67 5.76h5.501l1.67-5.76ZM18.367 7.9H5.634v5.025h12.733V7.9Z'
  },
  FilmAffinity: { color: '#2d6eb3', kind: 'badge', label: 'fa', labelColor: '#f6c344' },
  'Trakt.tv': {
    color: '#ed1c24',
    kind: 'path',
    path: 'm15.082 15.107-.73-.73 9.578-9.583a4.499 4.499 0 0 0-.115-.575L13.662 14.382l1.08 1.08-.73.73-1.81-1.81L23.422 3.144c-.075-.15-.155-.3-.25-.44L11.508 14.377l2.154 2.155-.73.73-7.193-7.199.73-.73 4.309 4.31L22.546 1.86A5.618 5.618 0 0 0 18.362 0H5.635A5.637 5.637 0 0 0 0 5.634V18.37A5.632 5.632 0 0 0 5.635 24h12.732C21.477 24 24 21.48 24 18.37V6.19l-8.913 8.918zm-4.314-2.155L6.814 8.988l.73-.73 3.954 3.96zm1.075-1.084-3.954-3.96.73-.73 3.959 3.96zm9.853 5.688a4.141 4.141 0 0 1-4.14 4.14H6.438a4.144 4.144 0 0 1-4.139-4.14V6.438A4.141 4.141 0 0 1 6.44 2.3h10.387v1.04H6.438c-1.71 0-3.099 1.39-3.099 3.1V17.55c0 1.71 1.39 3.105 3.1 3.105h11.117c1.71 0 3.1-1.395 3.1-3.105v-1.754h1.04v1.754z'
  },
  'Watcha!': { color: '#ff0558', kind: 'badge', label: 'W' },
  Wikidata: { color: '#7fc4ff', kind: 'wikidata' },
  TMDB: {
    color: '#01b4e4',
    kind: 'path',
    path: 'M6.62 12a2.291 2.291 0 0 1 2.292-2.295h-.013A2.291 2.291 0 0 1 11.189 12a2.291 2.291 0 0 1-2.29 2.291h.013A2.291 2.291 0 0 1 6.62 12zm10.72-4.062h4.266a2.291 2.291 0 0 0 2.29-2.291 2.291 2.291 0 0 0-2.29-2.296H17.34a2.291 2.291 0 0 0-2.291 2.296 2.291 2.291 0 0 0 2.29 2.29zM2.688 20.645h8.285a2.291 2.291 0 0 0 2.291-2.292 2.291 2.291 0 0 0-2.29-2.295H2.687a2.291 2.291 0 0 0-2.291 2.295 2.291 2.291 0 0 0 2.29 2.292zm10.881-6.354h.81l1.894-4.586H15.19l-1.154 3.008h-.013l-1.135-3.008h-1.154zm4.208 0h1.011V9.705h-1.011zm2.878 0h3.235v-.93h-2.223v-.933h1.99v-.934h-1.99v-.855h2.107v-.934h-3.112zM1.31 7.941h1.01V4.247h1.31v-.895H0v.895h1.31zm3.747 0h1.011V5.959h1.958v1.984h1.011v-4.59h-1.01v1.711H6.061V3.351H5.057zm5.348 0h3.242v-.933H11.41v-.934h1.99v-.933h-1.99v-.856h2.107v-.934h-3.112zM.162 14.296h1.005v-3.52h.013l1.167 3.52h.765l1.206-3.52h.013v3.52h1.011v-4.59H3.82L2.755 12.7h-.013L1.686 9.705H.156zm14.534 6.353h1.641a3.188 3.188 0 0 0 .98-.149 2.531 2.531 0 0 0 .824-.437 2.123 2.123 0 0 0 .567-.713 2.193 2.193 0 0 0 .223-.983 2.399 2.399 0 0 0-.218-1.07 1.958 1.958 0 0 0-.586-.716 2.405 2.405 0 0 0-.873-.392 4.349 4.349 0 0 0-1.046-.13h-1.519zm1.013-3.656h.596a2.26 2.26 0 0 1 .606.08 1.514 1.514 0 0 1 .503.244 1.167 1.167 0 0 1 .34.412 1.28 1.28 0 0 1 .13.587 1.546 1.546 0 0 1-.13.658 1.127 1.127 0 0 1-.347.433 1.41 1.41 0 0 1-.518.238 2.797 2.797 0 0 1-.649.07h-.538zm4.686 3.656h1.88a2.997 2.997 0 0 0 .613-.064 1.735 1.735 0 0 0 .554-.214 1.221 1.221 0 0 0 .402-.39 1.105 1.105 0 0 0 .155-.606 1.188 1.188 0 0 0-.071-.415 1.01 1.01 0 0 0-.204-.34 1.087 1.087 0 0 0-.317-.24 1.297 1.297 0 0 0-.413-.13v-.012a1.203 1.203 0 0 0 .575-.366.962.962 0 0 0 .216-.648 1.081 1.081 0 0 0-.149-.603 1.022 1.022 0 0 0-.389-.354 1.673 1.673 0 0 0-.54-.169 4.463 4.463 0 0 0-.6-.041h-1.712zm1.011-3.734h.687a1.4 1.4 0 0 1 .24.022.748.748 0 0 1 .22.075.432.432 0 0 1 .16.147.418.418 0 0 1 .061.236.47.47 0 0 1-.055.233.433.433 0 0 1-.146.156.62.62 0 0 1-.204.084 1.058 1.058 0 0 1-.23.026h-.745zm0 1.835h.765a1.96 1.96 0 0 1 .266.02 1.015 1.015 0 0 1 .26.07.519.519 0 0 1 .204.152.406.406 0 0 1 .08.26.481.481 0 0 1-.06.253.519.519 0 0 1-.16.168.62.62 0 0 1-.217.09 1.155 1.155 0 0 1-.237.027H21.4z'
  }
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
  grid-template-columns: minmax(184px, 220px) minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  margin: 10px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--tubescore-border);
  border-radius: 13px;
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
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 66px;
  padding: 1px 12px 1px 2px;
  border-right: 1px solid var(--tubescore-border);
}
.tubescore-card__brand {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--tubescore-text);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -.1px;
}
.tubescore-card__brand-mark { display: inline-flex; align-items: flex-end; gap: 2px; width: 20px; height: 17px; color: #ff0033; }
.tubescore-card__brand-mark i { display: block; width: 3px; border-radius: 2px 2px 0 0; background: currentColor; }
.tubescore-card__brand-mark i:nth-child(1) { height: 7px; }
.tubescore-card__brand-mark i:nth-child(2) { height: 14px; }
.tubescore-card__brand-mark i:nth-child(3) { height: 10px; }
.tubescore-card__brand-mark i:nth-child(4) { height: 17px; }
.tubescore-card__title {
  display: -webkit-box;
  align-self: center;
  margin: 6px 0 5px;
  overflow: hidden;
  color: var(--tubescore-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.2;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.tubescore-card__meta-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 8px; }
.tubescore-card__meta { min-width: 0; color: var(--tubescore-secondary); font-size: 12px; white-space: nowrap; }
.tubescore-card__settings-button {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--tubescore-border);
  border-radius: 8px;
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
.tubescore-card__settings-button svg { width: 18px; height: 18px; display: block; fill: none; }
.tubescore-card__ratings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 9px;
  min-width: 0;
  align-content: center;
}
.tubescore-card__rating {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(78px, 1fr) 18px;
  grid-template-rows: auto auto;
  grid-template-areas: 'icon source arrow' 'icon value arrow';
  min-width: 0;
  min-height: 66px;
  padding: 9px 11px;
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
a.tubescore-card__rating:focus-visible { outline: 2px solid #065fd4; outline-offset: 2px; border-color: transparent; }
html[dark] a.tubescore-card__rating:focus-visible, body[dark] a.tubescore-card__rating:focus-visible { outline-color: #3ea6ff; }
.tubescore-card__rating-icon { grid-area: icon; align-self: center; display: grid; place-items: center; width: 30px; height: 30px; color: var(--tubescore-brand, #606060); }
.tubescore-card__rating-icon svg { display: block; width: 28px; height: 28px; overflow: visible; }
.tubescore-card__rating-source { grid-area: source; align-self: end; overflow: hidden; color: var(--tubescore-text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.tubescore-card__rating-value { grid-area: value; align-self: start; margin-top: 2px; color: var(--tubescore-text); font-size: 19px; font-weight: 650; letter-spacing: -.2px; white-space: nowrap; }
.tubescore-card__rating-arrow { grid-area: arrow; align-self: center; justify-self: end; width: 15px; height: 15px; color: var(--tubescore-secondary); opacity: .9; }
.tubescore-card__rating-arrow svg { display: block; width: 15px; height: 15px; fill: currentColor; }
.tubescore-card__empty { display: grid; min-height: 66px; place-items: center; border: 1px solid var(--tubescore-border); border-radius: 11px; background: var(--tubescore-chip); color: var(--tubescore-secondary); font-size: 22px; }
.tubescore-card__settings-panel {
  position: absolute;
  z-index: 1000;
  top: calc(100% + 8px);
  left: 0;
  right: auto;
  display: flex;
  flex-direction: column;
  width: min(370px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 72px));
  overflow: hidden;
  border: 1px solid var(--tubescore-border);
  border-radius: 13px;
  background: var(--tubescore-drawer);
  color: var(--tubescore-text);
  box-shadow: 0 14px 36px rgba(0, 0, 0, .34);
}
.tubescore-card__settings-panel::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 188px;
  width: 11px;
  height: 11px;
  border-left: 1px solid var(--tubescore-border);
  border-top: 1px solid var(--tubescore-border);
  background: var(--tubescore-drawer);
  transform: rotate(45deg);
}
.tubescore-card__settings-panel[hidden] { display: none !important; }
.tubescore-card__settings-header { display: grid; grid-template-columns: 1fr 30px; gap: 8px; padding: 15px 16px 12px; border-bottom: 1px solid var(--tubescore-border); }
.tubescore-card__settings-title { font-size: 17px; font-weight: 700; }
.tubescore-card__settings-help { grid-column: 1 / -1; color: var(--tubescore-secondary); font-size: 12px; line-height: 1.4; }
.tubescore-card__settings-close { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 7px; background: transparent; color: var(--tubescore-secondary); cursor: pointer; }
.tubescore-card__settings-close:hover { background: var(--tubescore-chip-hover); color: var(--tubescore-text); }
.tubescore-card__settings-close svg { width: 16px; height: 16px; fill: currentColor; }
.tubescore-card__source-list { overflow: auto; padding: 8px 10px; scrollbar-gutter: stable; }
.tubescore-card__source-row { display: grid; grid-template-columns: 20px 28px minmax(0, 1fr); gap: 10px; min-height: 38px; padding: 5px 8px; align-items: center; border-radius: 8px; cursor: pointer; }
.tubescore-card__source-row:hover { background: var(--tubescore-chip-hover); }
.tubescore-card__source-row--section-start { margin-top: 6px; padding-top: 11px; border-top: 1px solid var(--tubescore-border); border-radius: 0 0 8px 8px; }
.tubescore-card__source-row .tubescore-card__rating-icon { grid-area: auto; width: 26px; height: 26px; }
.tubescore-card__source-row .tubescore-card__rating-icon svg { width: 25px; height: 25px; }
.tubescore-card__source-name { overflow: visible; min-width: 0; color: var(--tubescore-text); font-size: 13px; font-weight: 500; line-height: 1.25; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
.tubescore-card__source-checkbox { width: 17px; height: 17px; margin: 0; accent-color: #1677e8; cursor: pointer; }
.tubescore-card__settings-footer { display: flex; gap: 12px; justify-content: space-between; align-items: center; padding: 11px 14px; border-top: 1px solid var(--tubescore-border); }
.tubescore-card__settings-reset { padding: 4px 2px; border: 0; background: transparent; color: var(--tubescore-secondary); font-size: 12px; text-decoration: underline; cursor: pointer; }
.tubescore-card__settings-reset:hover { color: var(--tubescore-text); }
.tubescore-card__settings-done { min-width: 84px; padding: 8px 17px; border: 0; border-radius: 9px; background: #1677e8; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.tubescore-card__settings-done:hover { background: #1268cc; }
.tubescore-card[data-tubescore-state='error'] { grid-template-columns: 1fr; }
.tubescore-card[data-tubescore-state='error'] .tubescore-card__summary { border-right: 0; }
@media (max-width: 820px) {
  .tubescore-card { grid-template-columns: 1fr; }
  .tubescore-card__summary { min-height: 0; padding: 0 0 10px; border-right: 0; border-bottom: 1px solid var(--tubescore-border); }
  .tubescore-card__ratings { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .tubescore-card__settings-panel { left: 0; width: min(370px, 100%); }
  .tubescore-card__settings-panel::before { left: 168px; }
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
  const visual = BRAND_VISUALS[name] ?? { color: '#8a8a8a', kind: 'badge' as const, label: name.slice(0, 1).toUpperCase() || '?' };
  const wrapper = doc.createElement('span');
  wrapper.className = 'tubescore-card__rating-icon';
  wrapper.dataset.brandSource = name;
  wrapper.style.setProperty('--tubescore-brand', visual.color);

  const svg = svgElement(doc, 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  if (visual.kind === 'path' && visual.path) {
    const group = svgElement(doc, 'g');
    group.setAttribute('transform', 'translate(2 2)');
    const path = svgElement(doc, 'path');
    path.setAttribute('d', visual.path);
    path.setAttribute('fill', visual.color);
    group.append(path);
    svg.append(group);
  } else if (visual.kind === 'letterboxd') {
    for (const [cx, fill] of [['8', '#ff8000'], ['14', '#00e054'], ['20', '#40bcf4']] as const) {
      const circle = svgElement(doc, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', '14');
      circle.setAttribute('r', '5.5');
      circle.setAttribute('fill', fill);
      svg.append(circle);
    }
  } else if (visual.kind === 'wikidata') {
    const colors = ['#990000', '#339966', '#006699', '#990000', '#339966', '#006699'];
    colors.forEach((fill, index) => {
      const rect = svgElement(doc, 'rect');
      rect.setAttribute('x', String(2 + index * 4));
      rect.setAttribute('y', index % 2 === 0 ? '4' : '7');
      rect.setAttribute('width', '2.5');
      rect.setAttribute('height', index % 2 === 0 ? '20' : '17');
      rect.setAttribute('fill', fill);
      svg.append(rect);
    });
  } else {
    const rect = svgElement(doc, 'rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '2');
    rect.setAttribute('width', '24');
    rect.setAttribute('height', '24');
    rect.setAttribute('rx', '7');
    rect.setAttribute('fill', visual.color);
    svg.append(rect);
    appendSvgText(doc, svg, visual.label ?? name.slice(0, 1).toUpperCase(), {
      x: '14',
      y: '18.5',
      'text-anchor': 'middle',
      'font-size': (visual.label?.length ?? 1) > 1 ? '9' : '13',
      'font-weight': '800',
      fill: visual.labelColor ?? '#fff'
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
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = svgElement(doc, 'path');
  path.setAttribute('d', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.75');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');

  const circle = svgElement(doc, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '3.25');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.75');

  svg.append(path, circle);
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

  for (const [index, name] of catalog.entries()) {
    const row = doc.createElement('label');
    row.className = 'tubescore-card__source-row';
    if (index === DEFAULT_ENABLED_RATING_SOURCES.length) row.classList.add('tubescore-card__source-row--section-start');

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

    const label = doc.createElement('span');
    label.className = 'tubescore-card__source-name';
    label.textContent = name;

    row.append(checkbox, brandIcon(doc, name), label);
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

  const metaRow = doc.createElement('div');
  metaRow.className = 'tubescore-card__meta-row';
  const meta = doc.createElement('span');
  meta.className = 'tubescore-card__meta';
  meta.textContent = candidate.releaseYear
    ? `${mediaTypeLabel(candidate.mediaType)} · ${candidate.releaseYear}`
    : mediaTypeLabel(candidate.mediaType);

  const gear = settingsButton(doc);
  metaRow.append(meta, gear);
  summary.append(title, metaRow);

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

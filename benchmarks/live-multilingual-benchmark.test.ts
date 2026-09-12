import { describe, expect, it } from 'vitest';
import { normalizeYouTubeTitle } from '../src/core/normalize';
import type { CatalogCandidate, MediaType, YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';

type PositiveCase = {
  id: string;
  language: string;
  videoId: string;
  title: string;
  expectedLabels: string[];
  expectedMediaType: MediaType;
  expectedYear?: number;
};

type NegativeCase = {
  id: string;
  language: string;
  title: string;
};

type Outcome = {
  id: string;
  language: string;
  mode: 'title-fallback' | 'actual-id' | 'negative';
  pass: boolean;
  state: string;
  confidence?: number;
  candidateTitle?: string;
  candidateYear?: number;
  candidateMediaType?: MediaType;
  providerId?: string;
  reasons?: string[];
  error?: string;
};

const POSITIVE_CASES: readonly PositiveCase[] = [
  { id: 'en-artificial', language: 'en', videoId: 'rDZplZFnbOk', title: 'Artificial - Official Teaser Trailer - In Theaters Christmas Day', expectedLabels: ['Artificial'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-street-fighter', language: 'en', videoId: 'U6sbm1OaJb8', title: 'Street Fighter | New Trailer (2026 Movie)', expectedLabels: ['Street Fighter'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-harry-potter-hbo', language: 'en', videoId: 'SJVmeJaS44s', title: "Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max", expectedLabels: ['Harry Potter', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'en-resident-evil', language: 'en', videoId: 'mNd1gb19A-c', title: 'RESIDENT EVIL – Official Trailer (4K)', expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'ru-dune-3', language: 'ru', videoId: 'yv5-FG08fqg', title: 'Дюна: Часть третья — Русский трейлер #2 (Дубляж, 2026)', expectedLabels: ['Дюна: Часть третья', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-mayday', language: 'ru', videoId: 'MhHiuQ4_0NI', title: 'МЭЙДЭЙ - Русский трейлер (4K Субтитры, 2026) Мэйдэй, Райан Рейнольдс', expectedLabels: ['Мэйдэй', 'Mayday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-avengers-doomsday', language: 'ru', videoId: '7z6HZNi0HU4', title: 'Мстители 5: Доктор Дум — Русский трейлер (Дубляж, 2026)', expectedLabels: ['Мстители: Доктор Дум', 'Мстители 5: Доктор Дум', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-moana', language: 'ru', videoId: 'tTtftyuS680', title: 'Моана — Русский трейлер (Дубляж, 2026) Дуэйн Джонсон', expectedLabels: ['Моана', 'Moana'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'uk-odyssey', language: 'uk', videoId: 'S9OIqxPKhSo', title: 'Одіссея. Офіційний трейлер', expectedLabels: ['Одіссея', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'uk-killhouse', language: 'uk', videoId: 'bhe3_2zURiY', title: 'Кіллхаус. Офіційний трейлер', expectedLabels: ['Кіллхаус', 'Killhouse'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'uk-disclosure-day', language: 'uk', videoId: 'dC9iqoIFJWw', title: 'День істини. Офіційний трейлер', expectedLabels: ['День істини', 'Disclosure Day'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'uk-u-are-universe', language: 'uk', videoId: 'miv9KWu4s_0', title: 'Ти - Космос - офіційний трейлер', expectedLabels: ['Ти - Космос', 'Ти — Космос', 'U Are the Universe'], expectedMediaType: 'movie' },

  { id: 'es-resident-evil', language: 'es', videoId: 'd6oszs7f5aI', title: 'Resident Evil | Nuevo Tráiler Oficial en español HD. En cines 18 de septiembre.', expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-odyssey', language: 'es', videoId: '8un_UztYsw0', title: 'La Odisea | Tráiler Oficial (Universal Pictures)', expectedLabels: ['La Odisea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-carrie', language: 'es', videoId: 'YBY4xXin8CY', title: 'Carrie - Tráiler oficial | Prime Video', expectedLabels: ['Carrie'], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'es-avengers-doomsday', language: 'es', videoId: 'lAr_uspgHm8', title: 'Avengers: Doomsday | Tráiler Oficial | Doblado', expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'de-old', language: 'de', videoId: 'NU1EdCFuYHs', title: 'OLD - Offizieller Trailer deutsch/german HD', expectedLabels: ['Old'], expectedMediaType: 'movie', expectedYear: 2021 },
  { id: 'de-odyssey', language: 'de', videoId: '1Js6B0_1-v4', title: 'DIE ODYSSEE Neuer Trailer German Deutsch (2026) Matt Damon, Tom Holland', expectedLabels: ['Die Odyssee', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'de-perfect-holiday', language: 'de', videoId: 'Kaeu2N-S_Qw', title: "DER PERFEKTE URLAUB Teaser Trailer German Deutsch (2026) Elyas M'Barek, Karoline Herfurth", expectedLabels: ['Der perfekte Urlaub'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'de-harry-potter-hbo', language: 'de', videoId: 'faL2oI_rRRc', title: 'HARRY POTTER UND DER STEIN DER WEISEN Trailer German Deutsch (2026)', expectedLabels: ['Harry Potter', 'Harry Potter und der Stein der Weisen', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },

  { id: 'fr-moana', language: 'fr', videoId: 'bMqUG0qhgyM', title: 'Vaiana, la légende du bout du monde (2026) - Bande-annonce officielle (VF) | Disney', expectedLabels: ['Vaiana', 'Vaiana, la légende du bout du monde', 'Moana'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'fr-avengers-doomsday', language: 'fr', videoId: 'g9NAGSPpfjs', title: 'Avengers : Doomsday - Bande-annonce officielle (VF) | Marvel', expectedLabels: ['Avengers: Doomsday', 'Avengers : Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'fr-dix-pour-cent', language: 'fr', videoId: 'afCKKmg_BaQ', title: 'Dix pour cent : Le film | Bande-annonce officielle VF | Netflix France', expectedLabels: ['Dix pour cent : Le film', 'Dix pour cent'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'fr-harry-potter-hbo', language: 'fr', videoId: 'YiDGo9I2n24', title: "HARRY POTTER À L'ÉCOLE DES SORCIERS Bande Annonce VF (2026)", expectedLabels: ['Harry Potter', "Harry Potter à l'école des sorciers", "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },

  { id: 'it-odyssey', language: 'it', videoId: '6SbP6gvsrlk', title: 'Odissea | Trailer Ufficiale (Universal Pictures) - HD', expectedLabels: ['Odissea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-dune-3', language: 'it', videoId: 'BlAyKxScwyk', title: 'Dune - Parte Tre | Trailer Ufficiale', expectedLabels: ['Dune - Parte Tre', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-avengers-doomsday', language: 'it', videoId: 'gUth3APCeyg', title: 'Avengers: Doomsday | Trailer Ufficiale | Dal 16 Dicembre al Cinema', expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-kettice', language: 'it', videoId: 'sZvP7e70W_U', title: 'KETTICÈ di Giovanni Tortorici (2026) | Trailer ufficiale', expectedLabels: ['Ketticè'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'pt-odyssey', language: 'pt', videoId: 'Y-Dcn-qnnjs', title: 'A Odisseia | Trailer Oficial  (Universal Pictures) - HD', expectedLabels: ['A Odisseia', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-harry-potter-hbo', language: 'pt', videoId: 'o9Y03GaOCuo', title: 'Harry Potter e a Pedra Filosofal | Teaser Trailer Oficial Dublado | HBO Max', expectedLabels: ['Harry Potter', 'Harry Potter e a Pedra Filosofal', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'pt-scary-movie', language: 'pt', videoId: 'bO_APd0MNVU', title: 'Todo Mundo em Pânico (2026) | Trailer Oficial Dublado', expectedLabels: ['Todo Mundo em Pânico', 'Scary Movie'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-avengers-doomsday', language: 'pt', videoId: 'TcBtFtkQFiU', title: 'Vingadores: Doutor Destino | Trailer Oficial Dublado', expectedLabels: ['Vingadores: Doutor Destino', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'pl-it', language: 'pl', videoId: '2-K7COJbp1Y', title: 'TO I Oficjalny zwiastun filmu PL', expectedLabels: ['To', 'It'], expectedMediaType: 'movie', expectedYear: 2017 },
  { id: 'pl-bogowie', language: 'pl', videoId: '1biE4cOrDPE', title: 'Oficjalny zwiastun filmu BOGOWIE', expectedLabels: ['Bogowie', 'Gods'], expectedMediaType: 'movie', expectedYear: 2014 },
  { id: 'pl-mniej-obcy', language: 'pl', videoId: 'MiddOsmFDYI', title: 'Mniej obcy | Oficjalny Zwiastun | Netflix', expectedLabels: ['Mniej obcy'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pl-paw-patrol-dino', language: 'pl', videoId: 'ijvT2R_4a7c', title: 'Psi Patrol: Dino Film (2026) | Oficjalny zwiastun', expectedLabels: ['Psi Patrol: Dino Film', 'PAW Patrol: The Dino Movie'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'tr-odyssey', language: 'tr', videoId: '4l2QPRNPD6E', title: 'Odyssey | Türkçe Dublajlı Resmi Fragman', expectedLabels: ['Odyssey', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'tr-make-me-believe', language: 'tr', videoId: '9DcUcyqaUe0', title: 'Sen İnandır | Resmi Fragman | Netflix', expectedLabels: ['Sen İnandır', 'Make Me Believe'], expectedMediaType: 'movie', expectedYear: 2023 },
  { id: 'tr-inside-out-2', language: 'tr', videoId: 'JOEQYsUDACA', title: "Ters Yüz 2 | Yeni Resmi Fragman | 14 Haziran'da Sadece Sinemalarda!", expectedLabels: ['Ters Yüz 2', 'Inside Out 2'], expectedMediaType: 'movie', expectedYear: 2024 },
  { id: 'tr-ashes', language: 'tr', videoId: 'O9SZuUeWb7U', title: 'Kül | Resmi Fragman | 9 Şubat’ta sadece Netflix’te!', expectedLabels: ['Kül', 'Ashes'], expectedMediaType: 'movie', expectedYear: 2024 },

  { id: 'ja-godzilla-minus-zero', language: 'ja', videoId: 'F_1FnUxXk8E', title: '『ゴジラ-0.0』予告', expectedLabels: ['ゴジラ-0.0', 'Godzilla Minus Zero'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ja-disclosure-day', language: 'ja', videoId: 'wb_IzhyxKpU', title: '映画『ディスクロージャー・デイ』本予告映像＜10月1日（木）全国公開！＞', expectedLabels: ['ディスクロージャー・デイ', 'Disclosure Day'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ja-look-back', language: 'ja', videoId: 'j2zRU0RQEjA', title: '実写映画『ルックバック』本予告映像解禁【9月11日公開】', expectedLabels: ['ルックバック', 'Look Back'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ja-yatsuhakamura', language: 'ja', videoId: '4WiUjd_MlSA', title: '映画『八つ墓村』本予告【9月18日(金)全国公開】', expectedLabels: ['八つ墓村', 'The Village of Eight Gravestones'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'ko-genie-make-a-wish', language: 'ko', videoId: 'vHva0Cr5tO0', title: '다 이루어질지니 | 공식 예고편 | 넷플릭스', expectedLabels: ['다 이루어질지니', 'Genie, Make a Wish'], expectedMediaType: 'tv', expectedYear: 2025 },
  { id: 'ko-tazza-4', language: 'ko', videoId: 'aMOrloU5Bho', title: '[타짜: 벨제붑의 노래] 메인 예고편', expectedLabels: ['타짜: 벨제붑의 노래'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ko-hana-korea', language: 'ko', videoId: 'r5YJrNHuIQs', title: '하나 코리아 HANA KOREA | 메인 예고편 | 김민하 Kim Minha, 김주령 Kim Jooryoung, 안서현 An Seohyun', expectedLabels: ['하나 코리아', 'Hana Korea'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ko-still-brilliant', language: 'ko', videoId: 'o4Zmu4s6RvI', title: '[여전히 찬란하게] 티저 예고편', expectedLabels: ['여전히 찬란하게'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'zh-rope-curse-4', language: 'zh', videoId: 'n4_gVXzDiwQ', title: '電影【粽邪4：坤蒂拉娜】官方正式預告｜8／27全台上映｜The Rope Curse 4：Kuntilanak Official Trailer', expectedLabels: ['粽邪4：坤蒂拉娜', 'The Rope Curse 4: Kuntilanak'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'zh-odyssey', language: 'zh', videoId: '2rzJuAIj0VI', title: '【奧德賽】終極預告 - 07.17.26 全台戲院見', expectedLabels: ['奧德賽', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'zh-kung-fu-soccer', language: 'zh', videoId: 'x-HE-g5YwZE', title: '功夫女足｜Kung Fu Soccer | Official Trailer | 正式预告片 | Coming to GSC starting 13 August 2026', expectedLabels: ['功夫女足', 'Kung Fu Soccer'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'zh-avengers-doomsday', language: 'zh', videoId: 'ZpmJZRRGK6o', title: '#最新預告首曝《#復仇者聯盟：#末日崛起》2026/12/16 戲院大銀幕 震撼登場', expectedLabels: ['復仇者聯盟：末日崛起', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 }
] as const;

const NEGATIVE_CASES: readonly NegativeCase[] = [
  { id: 'neg-en-gaming', language: 'en', title: 'Street Fighter 6 ranked matches and controller settings' },
  { id: 'neg-ru-cooking', language: 'ru', title: 'Как приготовить борщ дома за 30 минут' },
  { id: 'neg-uk-tech', language: 'uk', title: 'Огляд нового смартфона та тест камери' },
  { id: 'neg-es-cooking', language: 'es', title: 'Receta de paella fácil paso a paso' },
  { id: 'neg-de-travel', language: 'de', title: 'Berlin Reise Vlog Wochenende 2026' },
  { id: 'neg-fr-cooking', language: 'fr', title: 'Recette de croissants maison facile' },
  { id: 'neg-it-travel', language: 'it', title: 'Roma vlog cosa vedere in tre giorni' },
  { id: 'neg-pt-cooking', language: 'pt', title: 'Como fazer pão caseiro fácil' },
  { id: 'neg-pl-cooking', language: 'pl', title: 'Jak ugotować rosół krok po kroku' },
  { id: 'neg-tr-travel', language: 'tr', title: 'İstanbul gezi rehberi 2026' },
  { id: 'neg-ja-travel', language: 'ja', title: '東京旅行 おすすめグルメ10選' },
  { id: 'neg-ko-travel', language: 'ko', title: '서울 여행 맛집 추천 브이로그' },
  { id: 'neg-zh-travel', language: 'zh', title: '北京旅行美食攻略 2026' },

  { id: 'collision-en-old', language: 'en', title: 'Old MacDonald Had a Farm | Kids Songs' },
  { id: 'collision-en-it', language: 'en', title: 'IT support tutorial for beginners' },
  { id: 'collision-es-carrie', language: 'es', title: 'Carrie Underwood en concierto en vivo' },
  { id: 'collision-tr-ashes', language: 'tr', title: 'Kül nasıl temizlenir evde' },
  { id: 'collision-ja-godzilla', language: 'ja', title: 'ゴジラ ゲーム実況 最新アップデート' },
  { id: 'collision-ko-parasite', language: 'ko', title: '기생충 감염 증상과 치료법' },
  { id: 'collision-ru-moana', language: 'ru', title: 'Моана пляж на Гавайях: обзор отеля' },
  { id: 'collision-pl-bogowie', language: 'pl', title: 'Bogowie mitologii greckiej lekcja' }
] as const;

function context(videoId: string, title: string): YouTubeVideoContext {
  return {
    videoId,
    title,
    description: '',
    channelName: 'Live benchmark',
    hashtags: [],
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

function normalized(value: string): string {
  return normalizeYouTubeTitle(value).replace(/\b(19\d{2}|20\d{2}|21\d{2})\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function candidateMatches(candidate: CatalogCandidate, testCase: PositiveCase): boolean {
  const variants = [candidate.title, candidate.originalTitle ?? '', ...(candidate.aliases ?? [])]
    .map(normalized)
    .filter(Boolean);
  const expected = testCase.expectedLabels.map(normalized).filter(Boolean);
  const labelMatches = expected.some((label) => variants.some((variant) => {
    if (variant === label) return true;
    if (label.length < 4 || variant.length < 4) return false;
    return variant.includes(label) || label.includes(variant);
  }));
  if (!labelMatches) return false;
  if (candidate.mediaType !== testCase.expectedMediaType) return false;
  if (testCase.expectedYear !== undefined && candidate.releaseYear !== undefined && candidate.releaseYear !== testCase.expectedYear) return false;
  return true;
}

function fakeVideoId(testCase: PositiveCase | NegativeCase): string {
  const compact = testCase.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
  return `b_${compact}`.slice(0, 20).padEnd(6, 'x');
}

async function positiveOutcome(
  recognize: ReturnType<typeof createPublicRecognitionOrchestrator>,
  testCase: PositiveCase,
  mode: 'title-fallback' | 'actual-id'
): Promise<Outcome> {
  const videoId = mode === 'actual-id' ? testCase.videoId : fakeVideoId(testCase);
  try {
    const result = await recognize(context(videoId, testCase.title), { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, mode, pass: false, state: 'none' };
    const candidate = result.decision.score.candidate;
    const visible = result.decision.state === 'high' || result.decision.state === 'likely';
    return {
      id: testCase.id,
      language: testCase.language,
      mode,
      pass: visible && candidateMatches(candidate, testCase),
      state: result.decision.state,
      confidence: result.decision.score.confidence,
      candidateTitle: candidate.title,
      candidateYear: candidate.releaseYear,
      candidateMediaType: candidate.mediaType,
      providerId: candidate.providerId,
      reasons: result.decision.score.reasons
    };
  } catch (error) {
    return {
      id: testCase.id,
      language: testCase.language,
      mode,
      pass: false,
      state: 'error',
      error: error instanceof Error ? `${error.name}:${error.message}` : String(error)
    };
  }
}

async function negativeOutcome(
  recognize: ReturnType<typeof createPublicRecognitionOrchestrator>,
  testCase: NegativeCase
): Promise<Outcome> {
  try {
    const result = await recognize(context(fakeVideoId(testCase), testCase.title), { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, mode: 'negative', pass: true, state: 'none' };
    const candidate = result.decision.score.candidate;
    const hidden = result.decision.state === 'hidden';
    return {
      id: testCase.id,
      language: testCase.language,
      mode: 'negative',
      pass: hidden,
      state: result.decision.state,
      confidence: result.decision.score.confidence,
      candidateTitle: candidate.title,
      candidateYear: candidate.releaseYear,
      candidateMediaType: candidate.mediaType,
      providerId: candidate.providerId,
      reasons: result.decision.score.reasons
    };
  } catch (error) {
    return {
      id: testCase.id,
      language: testCase.language,
      mode: 'negative',
      pass: false,
      state: 'error',
      error: error instanceof Error ? `${error.name}:${error.message}` : String(error)
    };
  }
}

function report(outcomes: Outcome[]): void {
  const languages = [...new Set(POSITIVE_CASES.map((item) => item.language))];
  const perLanguage = languages.map((language) => {
    const fallback = outcomes.filter((item) => item.language === language && item.mode === 'title-fallback');
    const exact = outcomes.filter((item) => item.language === language && item.mode === 'actual-id');
    return {
      language,
      titleFallback: `${fallback.filter((item) => item.pass).length}/${fallback.length}`,
      actualIdSmoke: `${exact.filter((item) => item.pass).length}/${exact.length}`
    };
  });
  const positives = outcomes.filter((item) => item.mode !== 'negative');
  const negatives = outcomes.filter((item) => item.mode === 'negative');
  const summary = {
    positivePassed: positives.filter((item) => item.pass).length,
    positiveTotal: positives.length,
    negativePassed: negatives.filter((item) => item.pass).length,
    negativeTotal: negatives.length,
    errors: outcomes.filter((item) => item.state === 'error').length,
    perLanguage
  };

  console.log('TUBESCORE_LIVE_BENCHMARK_SUMMARY');
  console.log(JSON.stringify(summary));
  console.log('TUBESCORE_LIVE_BENCHMARK_FAILURES');
  for (const outcome of outcomes.filter((item) => !item.pass)) console.log(JSON.stringify(outcome));
}

describe('TubeScore v0.3.1 live multilingual quality benchmark', () => {
  it('recognizes real YouTube trailer titles across 13 languages and avoids unrelated-video false positives', async () => {
    const recognize = createPublicRecognitionOrchestrator();
    const outcomes: Outcome[] = [];

    for (const testCase of POSITIVE_CASES) {
      outcomes.push(await positiveOutcome(recognize, testCase, 'title-fallback'));
    }

    const firstPerLanguage = new Map<string, PositiveCase>();
    for (const testCase of POSITIVE_CASES) {
      if (!firstPerLanguage.has(testCase.language)) firstPerLanguage.set(testCase.language, testCase);
    }
    for (const testCase of firstPerLanguage.values()) {
      outcomes.push(await positiveOutcome(recognize, testCase, 'actual-id'));
    }

    for (const testCase of NEGATIVE_CASES) {
      outcomes.push(await negativeOutcome(recognize, testCase));
    }

    report(outcomes);
    const failures = outcomes.filter((item) => !item.pass);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
  }, 600_000);
});

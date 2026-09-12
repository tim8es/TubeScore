import { describe, expect, it } from 'vitest';
import { normalizeYouTubeTitle } from '../src/core/normalize';
import type { CatalogCandidate, MediaType, YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';

type PositiveCase = {
  id: string;
  language: string;
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  hashtags: string[];
  expectedLabels: string[];
  expectedMediaType: MediaType;
  expectedYear?: number;
};

type NegativeCase = { id: string; language: string; title: string };

type Outcome = {
  id: string;
  language: string;
  visible: boolean;
  correct?: boolean;
  hidden?: boolean;
  state: string;
  providerId?: string;
  candidateTitle?: string;
  candidateYear?: number;
  candidateMediaType?: MediaType;
  reasons?: string[];
  error?: string;
};

// Live YouTube metadata was read on 2026-09-13. Descriptions are reduced only to
// the first line plus all four-digit-year/media-type/original-title evidence used
// by current main. That is behaviorally equivalent for the current query builder
// and scorer, which consume description[0], four-digit years, and hashtags.
const POSITIVE_CASES: readonly PositiveCase[] = [
  { id: 'en-artificial', language: 'en', videoId: 'rDZplZFnbOk', title: 'Artificial - Official Teaser Trailer - In Theaters Christmas Day', description: 'A film by Luca Guadagnino.', channelName: 'NEON', hashtags: [], expectedLabels: ['Artificial'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-street-fighter', language: 'en', videoId: 'U6sbm1OaJb8', title: 'Street Fighter | New Trailer (2026 Movie)', description: 'PERFECT! Watch the New Trailer for #StreetFighterMovie, hitting theaters everywhere October 16. Set in 1993.', channelName: 'Paramount Pictures', hashtags: ['StreetFighterMovie'], expectedLabels: ['Street Fighter'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-harry-potter-hbo', language: 'en', videoId: 'SJVmeJaS44s', title: "Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max", description: 'Welcome to a new year at Hogwarts. The HBO Original Series Harry Potter and the Philosopher’s Stone premieres this Christmas on HBO Max. #HarryPotterHBO', channelName: 'Harry Potter', hashtags: ['HarryPotterHBO'], expectedLabels: ['Harry Potter', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'en-resident-evil', language: 'en', videoId: 'mNd1gb19A-c', title: 'RESIDENT EVIL – Official Trailer (4K)', description: 'No sweat. Resident Evil hits theatres September 18, 2026. #ResidentEvil #ResidentEvilMovie', channelName: 'Sony Pictures Entertainment', hashtags: ['ResidentEvil', 'ResidentEvilMovie'], expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'es-resident-evil', language: 'es', videoId: 'd6oszs7f5aI', title: 'Resident Evil | Nuevo Tráiler Oficial en español HD. En cines 18 de septiembre.', description: 'Pan comido. De la mente de Zach Cregger. Descubre el tráiler oficial de #ResidentEvilLaPelícula. Exclusivamente en cines 18 de septiembre.', channelName: 'Sony Pictures España', hashtags: ['ResidentEvilLaPelícula'], expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-odyssey', language: 'es', videoId: '8un_UztYsw0', title: 'La Odisea | Tráiler Oficial (Universal Pictures)', description: '16 07 26 solo en cines. Christopher Nolan presenta su próxima película, La Odisea, y llegará a los cines de todo el mundo el 16 de julio de 2026.', channelName: 'Universal Pictures México', hashtags: [], expectedLabels: ['La Odisea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-carrie', language: 'es', videoId: 'YBY4xXin8CY', title: 'Carrie - Tráiler oficial | Prime Video', description: 'Creer que conoces su historia puede ser un error mortal. Carrie, la nueva serie de Mike Flanagan, basada en la icónica novela con la que debutó Stephen King, llega el 7 de octubre a Prime Video.', channelName: 'Amazon Prime Video España', hashtags: [], expectedLabels: ['Carrie'], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'es-avengers-doomsday', language: 'es', videoId: 'lAr_uspgHm8', title: 'Avengers: Doomsday | Tráiler Oficial | Doblado', description: 'Él solía ser diferente. Avengers: Doomsday, estreno 17 de diciembre. Solo en cines.', channelName: 'Marvel Latinoamérica Oficial', hashtags: [], expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'pt-odyssey', language: 'pt', videoId: 'Y-Dcn-qnnjs', title: 'A Odisseia | Trailer Oficial  (Universal Pictures) - HD', description: '16.07.26. O próximo filme de Christopher Nolan, A Odisseia, estreia nos cinemas de todo o mundo em 17 de julho de 2026. #AOdisseiaFilme', channelName: 'Universal Pictures Brasil', hashtags: ['AOdisseiaFilme'], expectedLabels: ['A Odisseia', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-harry-potter-hbo', language: 'pt', videoId: 'o9Y03GaOCuo', title: 'Harry Potter e a Pedra Filosofal | Teaser Trailer Oficial Dublado | HBO Max', description: 'Bem-vindos a um novo ano em Hogwarts. Harry Potter e a Pedra Filosofal, a série original da HBO, estreia neste Natal na HBO Max. #HarryPotterHBO', channelName: 'HBO Max Brasil', hashtags: ['HarryPotterHBO'], expectedLabels: ['Harry Potter', 'Harry Potter e a Pedra Filosofal', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'pt-scary-movie', language: 'pt', videoId: 'bO_APd0MNVU', title: 'Todo Mundo em Pânico (2026) | Trailer Oficial Dublado', description: 'Todo Mundo em Pânico (2026) | Trailer Oficial Dublado. O filme estreia em 4 de junho de 2026 nos cinemas do Brasil!', channelName: 'ingresso.com', hashtags: ['TodoMundoEmPânico'], expectedLabels: ['Todo Mundo em Pânico', 'Scary Movie'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-avengers-doomsday', language: 'pt', videoId: 'TcBtFtkQFiU', title: 'Vingadores: Doutor Destino | Trailer Oficial Dublado', description: 'Vamos precisar de um milagre. #Vingadores: Doutor Destino, em 17 de dezembro nos cinemas.', channelName: 'Marvel Brasil', hashtags: ['Vingadores'], expectedLabels: ['Vingadores: Doutor Destino', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'ru-dune-3', language: 'ru', videoId: 'yv5-FG08fqg', title: 'Дюна: Часть третья — Русский трейлер #2 (Дубляж, 2026)', description: 'Официальный дублированный трейлер фильма «Дюна: Часть третья» 2026 года. Оригинальное название: Dune: Part Three. Премьера — 18 декабря 2026. #ДюнаЧастьТретья #DuneMovie', channelName: 'Kinoman', hashtags: ['ДюнаЧастьТретья', 'DuneMovie'], expectedLabels: ['Дюна: Часть третья', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-mayday', language: 'ru', videoId: 'MhHiuQ4_0NI', title: 'МЭЙДЭЙ - Русский трейлер (4K Субтитры, 2026) Мэйдэй, Райан Рейнольдс', description: 'Официальный трейлер с русскими субтитрами фильма «МэйДэй» [2026]. Премьера: 4 сентября 2026. Оригинальное название: Mayday. © 2026 Apple TV+. #Mayday #Мэйдэй', channelName: 'FRESH Trailers', hashtags: ['Mayday', 'Мэйдэй'], expectedLabels: ['Мэйдэй', 'Mayday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-avengers-doomsday', language: 'ru', videoId: '7z6HZNi0HU4', title: 'Мстители 5: Доктор Дум — Русский трейлер (Дубляж, 2026)', description: 'Официальный дублированный трейлер фильма «Мстители: Доктор Дум» 2026 года. Премьера — 18 декабря 2026. Оригинальное название: Avengers: Doomsday. © 2026 Marvel Studios. #МстителиДокторДум #AvengersDoomsday', channelName: 'Kinoman', hashtags: ['МстителиДокторДум', 'AvengersDoomsday'], expectedLabels: ['Мстители: Доктор Дум', 'Мстители 5: Доктор Дум', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-moana', language: 'ru', videoId: 'tTtftyuS680', title: 'Моана — Русский трейлер (Дубляж, 2026) Дуэйн Джонсон', description: 'Официальный дублированный трейлер фильма «Моана» 2026 года. Премьера — 10 июля 2026. Оригинальное название: Moana. © 2026 Disney. #Моана #Moana', channelName: 'Kinoman', hashtags: ['Моана', 'Moana'], expectedLabels: ['Моана', 'Moana'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'it-odyssey', language: 'it', videoId: '6SbP6gvsrlk', title: 'Odissea | Trailer Ufficiale (Universal Pictures) - HD', description: 'Dal 16 07 2026 al cinema. Il prossimo film di Christopher Nolan, Odissea, uscirà nelle sale italiane il 16 luglio 2026.', channelName: 'Universal Pictures International Italy', hashtags: [], expectedLabels: ['Odissea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-dune-3', language: 'it', videoId: 'BlAyKxScwyk', title: 'Dune - Parte Tre | Trailer Ufficiale', description: 'Perdonatemi per ciò che ho fatto. Dune - Parte Tre, dal 16 dicembre solo al cinema.', channelName: 'Warner Bros. Italia', hashtags: [], expectedLabels: ['Dune - Parte Tre', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-avengers-doomsday', language: 'it', videoId: 'gUth3APCeyg', title: 'Avengers: Doomsday | Trailer Ufficiale | Dal 16 Dicembre al Cinema', description: 'Doomsday arriva il 16 Dicembre. Vivi Avengers: Doomsday solo al cinema.', channelName: 'Marvel Italia', hashtags: [], expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-kettice', language: 'it', videoId: 'sZvP7e70W_U', title: 'KETTICÈ di Giovanni Tortorici (2026) | Trailer ufficiale', description: 'Un film di Giovanni Tortorici. Palermo, 2012. #Ketticè', channelName: 'PiperFilm', hashtags: ['Ketticè'], expectedLabels: ['Ketticè'], expectedMediaType: 'movie', expectedYear: 2026 }
] as const;

const NEGATIVE_CASES: readonly NegativeCase[] = [
  { id: 'neg-en-gaming', language: 'en', title: 'Street Fighter 6 ranked matches and controller settings' },
  { id: 'collision-en-old', language: 'en', title: 'Old MacDonald Had a Farm | Kids Songs' },
  { id: 'collision-en-it', language: 'en', title: 'IT support tutorial for beginners' },
  { id: 'neg-es-cooking', language: 'es', title: 'Receta de paella fácil paso a paso' },
  { id: 'collision-es-carrie', language: 'es', title: 'Carrie Underwood en concierto en vivo' },
  { id: 'neg-pt-cooking', language: 'pt', title: 'Como fazer pão caseiro fácil' },
  { id: 'neg-ru-cooking', language: 'ru', title: 'Как приготовить борщ дома за 30 минут' },
  { id: 'collision-ru-moana', language: 'ru', title: 'Моана пляж на Гавайях: обзор отеля' },
  { id: 'neg-it-travel', language: 'it', title: 'Roma vlog cosa vedere in tre giorni' }
] as const;

function fakeVideoId(id: string): string {
  return `pc_${id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 14)}`;
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

function visible(state: string): boolean {
  return state === 'high' || state === 'likely';
}

const liveFetch = globalThis.fetch.bind(globalThis);
const fetchFn: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.searchParams.get('action') === 'query' && url.searchParams.get('list') === 'search' && (url.searchParams.get('srsearch') ?? '').startsWith('haswbstatement:P1651=')) {
    return new Response(JSON.stringify({ query: { search: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return liveFetch(input, init);
};

async function positiveOutcome(recognize: ReturnType<typeof createPublicRecognitionOrchestrator>, testCase: PositiveCase): Promise<Outcome> {
  const context: YouTubeVideoContext = {
    videoId: fakeVideoId(testCase.id),
    title: testCase.title,
    description: testCase.description,
    channelName: testCase.channelName,
    hashtags: [...testCase.hashtags],
    url: `https://www.youtube.com/watch?v=${testCase.videoId}`
  };
  try {
    const result = await recognize(context, { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, visible: false, correct: false, state: 'none' };
    const candidate = result.decision.score.candidate;
    return {
      id: testCase.id,
      language: testCase.language,
      visible: visible(result.decision.state),
      correct: visible(result.decision.state) && candidateMatches(candidate, testCase),
      state: result.decision.state,
      providerId: candidate.providerId,
      candidateTitle: candidate.title,
      candidateYear: candidate.releaseYear,
      candidateMediaType: candidate.mediaType,
      reasons: result.decision.score.reasons
    };
  } catch (error) {
    return { id: testCase.id, language: testCase.language, visible: false, correct: false, state: 'error', error: error instanceof Error ? `${error.name}:${error.message}` : String(error) };
  }
}

async function negativeOutcome(recognize: ReturnType<typeof createPublicRecognitionOrchestrator>, testCase: NegativeCase): Promise<Outcome> {
  const context: YouTubeVideoContext = { videoId: fakeVideoId(testCase.id), title: testCase.title, description: '', channelName: 'Adversarial benchmark', hashtags: [], url: `https://www.youtube.com/watch?v=${fakeVideoId(testCase.id)}` };
  try {
    const result = await recognize(context, { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, visible: false, hidden: true, state: 'none' };
    return { id: testCase.id, language: testCase.language, visible: visible(result.decision.state), hidden: !visible(result.decision.state), state: result.decision.state, providerId: result.decision.score.candidate.providerId, candidateTitle: result.decision.score.candidate.title, candidateYear: result.decision.score.candidate.releaseYear, candidateMediaType: result.decision.score.candidate.mediaType, reasons: result.decision.score.reasons };
  } catch (error) {
    return { id: testCase.id, language: testCase.language, visible: false, hidden: false, state: 'error', error: error instanceof Error ? `${error.name}:${error.message}` : String(error) };
  }
}

describe('production-context affected evaluator', () => {
  it('measures current main with production metadata signals', async () => {
    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const outcomes: Outcome[] = [];
    for (const testCase of POSITIVE_CASES) {
      outcomes.push(await positiveOutcome(recognize, testCase));
    }
    for (const testCase of NEGATIVE_CASES) {
      outcomes.push(await negativeOutcome(recognize, testCase));
    }

    const positives = outcomes.filter((item) => item.correct !== undefined);
    const negatives = outcomes.filter((item) => item.hidden !== undefined);
    const correctVisible = positives.filter((item) => item.correct).length;
    const wrongVisible = positives.filter((item) => item.visible && !item.correct).length;
    const adversarialHidden = negatives.filter((item) => item.hidden).length;
    const adversarialVisible = negatives.filter((item) => item.visible).length;
    const precisionDenominator = correctVisible + wrongVisible + adversarialVisible;
    const summary = {
      correctVisible,
      positiveTotal: positives.length,
      wrongVisible,
      adversarialHidden,
      adversarialTotal: negatives.length,
      adversarialVisible,
      precision: precisionDenominator === 0 ? 0 : Number((correctVisible / precisionDenominator).toFixed(4)),
      recall: Number((correctVisible / positives.length).toFixed(4)),
      errors: outcomes.filter((item) => item.state === 'error').length
    };

    console.log('PRODUCTION_CONTEXT_SUMMARY', JSON.stringify(summary));
    for (const outcome of outcomes) console.log('PRODUCTION_CONTEXT_OUTCOME', JSON.stringify(outcome));

    expect(summary.errors).toBe(0);
  }, 900_000);
});

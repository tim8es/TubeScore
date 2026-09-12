import { describe, expect, it } from 'vitest';
import { normalizeYouTubeTitle } from '../src/core/normalize';
import type { CatalogCandidate, MediaType, YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';

type PositiveCase = {
  id: string;
  language: 'en' | 'es' | 'pt' | 'ru' | 'it';
  title: string;
  expectedLabels: string[];
  expectedMediaType: MediaType;
  expectedYear?: number;
};

type NegativeCase = {
  id: string;
  language: 'en' | 'es' | 'pt' | 'ru' | 'it';
  title: string;
};

type PositiveOutcome = {
  id: string;
  language: string;
  visible: boolean;
  correct: boolean;
  state: string;
  providerId?: string;
  candidateTitle?: string;
  candidateYear?: number;
  reasons?: string[];
};

type NegativeOutcome = {
  id: string;
  language: string;
  hidden: boolean;
  state: string;
  providerId?: string;
  candidateTitle?: string;
};

const POSITIVES: readonly PositiveCase[] = [
  { id: 'en-artificial', language: 'en', title: 'Artificial - Official Teaser Trailer - In Theaters Christmas Day', expectedLabels: ['Artificial'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-street-fighter', language: 'en', title: 'Street Fighter | New Trailer (2026 Movie)', expectedLabels: ['Street Fighter'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'en-harry-potter-hbo', language: 'en', title: "Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max", expectedLabels: ['Harry Potter', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'en-resident-evil', language: 'en', title: 'RESIDENT EVIL – Official Trailer (4K)', expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'es-resident-evil', language: 'es', title: 'Resident Evil | Nuevo Tráiler Oficial en español HD. En cines 18 de septiembre.', expectedLabels: ['Resident Evil'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-odyssey', language: 'es', title: 'La Odisea | Tráiler Oficial (Universal Pictures)', expectedLabels: ['La Odisea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'es-carrie', language: 'es', title: 'Carrie - Tráiler oficial | Prime Video', expectedLabels: ['Carrie'], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'es-avengers-doomsday', language: 'es', title: 'Avengers: Doomsday | Tráiler Oficial | Doblado', expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'pt-odyssey', language: 'pt', title: 'A Odisseia | Trailer Oficial  (Universal Pictures) - HD', expectedLabels: ['A Odisseia', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-harry-potter-hbo', language: 'pt', title: 'Harry Potter e a Pedra Filosofal | Teaser Trailer Oficial Dublado | HBO Max', expectedLabels: ['Harry Potter', 'Harry Potter e a Pedra Filosofal', "Harry Potter and the Philosopher's Stone"], expectedMediaType: 'tv', expectedYear: 2026 },
  { id: 'pt-scary-movie', language: 'pt', title: 'Todo Mundo em Pânico (2026) | Trailer Oficial Dublado', expectedLabels: ['Todo Mundo em Pânico', 'Scary Movie'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'pt-avengers-doomsday', language: 'pt', title: 'Vingadores: Doutor Destino | Trailer Oficial Dublado', expectedLabels: ['Vingadores: Doutor Destino', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'ru-dune-3', language: 'ru', title: 'Дюна: Часть третья — Русский трейлер #2 (Дубляж, 2026)', expectedLabels: ['Дюна: Часть третья', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-mayday', language: 'ru', title: 'МЭЙДЭЙ - Русский трейлер (4K Субтитры, 2026) Мэйдэй, Райан Рейнольдс', expectedLabels: ['МэйДЭЙ', 'Мэйдэй', 'Mayday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-avengers-doomsday', language: 'ru', title: 'Мстители 5: Доктор Дум — Русский трейлер (Дубляж, 2026)', expectedLabels: ['Мстители: Доктор Дум', 'Мстители 5: Доктор Дум', 'Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'ru-moana', language: 'ru', title: 'Моана — Русский трейлер (Дубляж, 2026) Дуэйн Джонсон', expectedLabels: ['Моана', 'Moana'], expectedMediaType: 'movie', expectedYear: 2026 },

  { id: 'it-odyssey', language: 'it', title: 'Odissea | Trailer Ufficiale (Universal Pictures) - HD', expectedLabels: ['Odissea', 'The Odyssey'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-dune-3', language: 'it', title: 'Dune - Parte Tre | Trailer Ufficiale', expectedLabels: ['Dune - Parte Tre', 'Dune: Part Three'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-avengers-doomsday', language: 'it', title: 'Avengers: Doomsday | Trailer Ufficiale | Dal 16 Dicembre al Cinema', expectedLabels: ['Avengers: Doomsday'], expectedMediaType: 'movie', expectedYear: 2026 },
  { id: 'it-kettice', language: 'it', title: 'KETTICÈ di Giovanni Tortorici (2026) | Trailer ufficiale', expectedLabels: ['Ketticè'], expectedMediaType: 'movie', expectedYear: 2026 }
] as const;

const NEGATIVES: readonly NegativeCase[] = [
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

function context(id: string, title: string): YouTubeVideoContext {
  return {
    videoId: `bench_${id}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20),
    title,
    description: '',
    channelName: 'Affected benchmark',
    hashtags: [],
    url: 'https://www.youtube.com/watch?v=benchmark'
  };
}

function normalized(value: string): string {
  return normalizeYouTubeTitle(value)
    .replace(/\b(19\d{2}|20\d{2}|21\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const throttledFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input));
  if (url.searchParams.get('action') === 'query' && url.searchParams.get('list') === 'search') {
    const query = url.searchParams.get('srsearch') ?? '';
    if (query.startsWith('haswbstatement:P1651=bench_')) {
      return new Response(JSON.stringify({ query: { search: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  await sleep(350);
  return fetch(input, init);
};

async function runPositive(recognize: ReturnType<typeof createPublicRecognitionOrchestrator>, testCase: PositiveCase): Promise<PositiveOutcome> {
  try {
    const result = await recognize(context(testCase.id, testCase.title), { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, visible: false, correct: false, state: 'none' };
    const visible = result.decision.state === 'high' || result.decision.state === 'likely';
    const candidate = result.decision.score.candidate;
    return {
      id: testCase.id,
      language: testCase.language,
      visible,
      correct: visible && candidateMatches(candidate, testCase),
      state: result.decision.state,
      providerId: candidate.providerId,
      candidateTitle: candidate.title,
      candidateYear: candidate.releaseYear,
      reasons: result.decision.score.reasons
    };
  } catch (error) {
    return { id: testCase.id, language: testCase.language, visible: false, correct: false, state: `error:${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runNegative(recognize: ReturnType<typeof createPublicRecognitionOrchestrator>, testCase: NegativeCase): Promise<NegativeOutcome> {
  try {
    const result = await recognize(context(testCase.id, testCase.title), { enabledSources: [] });
    if (!result) return { id: testCase.id, language: testCase.language, hidden: true, state: 'none' };
    const candidate = result.decision.score.candidate;
    const hidden = result.decision.state === 'hidden';
    return { id: testCase.id, language: testCase.language, hidden, state: result.decision.state, providerId: candidate.providerId, candidateTitle: candidate.title };
  } catch (error) {
    return { id: testCase.id, language: testCase.language, hidden: false, state: `error:${error instanceof Error ? error.message : String(error)}` };
  }
}

describe('entity consensus affected benchmark', () => {
  it('reports EN/ES/PT/RU/IT precision and recall', async () => {
    const recognize = createPublicRecognitionOrchestrator({ fetchFn: throttledFetch });
    const positives: PositiveOutcome[] = [];
    const negatives: NegativeOutcome[] = [];

    for (const testCase of POSITIVES) {
      const outcome = await runPositive(recognize, testCase);
      positives.push(outcome);
      console.log('ENTITY_CONSENSUS_POSITIVE', JSON.stringify(outcome));
    }
    for (const testCase of NEGATIVES) {
      const outcome = await runNegative(recognize, testCase);
      negatives.push(outcome);
      console.log('ENTITY_CONSENSUS_NEGATIVE', JSON.stringify(outcome));
    }

    const correctVisible = positives.filter((item) => item.correct).length;
    const wrongVisible = positives.filter((item) => item.visible && !item.correct).length;
    const adversarialHidden = negatives.filter((item) => item.hidden).length;
    const adversarialVisible = negatives.length - adversarialHidden;
    const visiblePredictions = correctVisible + wrongVisible + adversarialVisible;
    const precision = visiblePredictions === 0 ? 0 : correctVisible / visiblePredictions;
    const recall = correctVisible / POSITIVES.length;
    const summary = {
      correctVisible,
      positiveTotal: POSITIVES.length,
      wrongVisible,
      adversarialHidden,
      adversarialTotal: NEGATIVES.length,
      adversarialVisible,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      errors: [...positives, ...negatives].filter((item) => item.state.startsWith('error:')).length
    };
    console.log('ENTITY_CONSENSUS_SUMMARY', JSON.stringify(summary));

    expect(summary.positiveTotal).toBe(20);
    expect(summary.adversarialTotal).toBe(9);
  }, 900_000);
});

import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { buildSearchQueries } from '../core/query-builder';
import type { CatalogCandidate, MatchScore, RecognitionResult, YouTubeVideoContext } from '../core/types';
import { TmdbCatalogProvider } from '../providers/tmdb/tmdb-catalog-provider';
import { TmdbRatingsProvider } from '../providers/tmdb/tmdb-ratings-provider';

export const RUNTIME_CONFIG_KEY = 'tubescoreRuntimeConfig';

export interface RuntimeConfigStorage {
  get(key: string): Promise<Record<string, unknown>>;
}

export interface TubeScoreRuntimeConfig {
  tmdbAccessToken: string;
}

export class InvalidRuntimeConfigError extends Error {
  constructor() {
    super('invalid_runtime_config');
    this.name = 'InvalidRuntimeConfigError';
  }
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RecognitionOrchestratorOptions {
  storage: RuntimeConfigStorage;
  fetchFn?: FetchFn;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function loadRuntimeConfig(
  storage: RuntimeConfigStorage
): Promise<TubeScoreRuntimeConfig | null> {
  const stored = await storage.get(RUNTIME_CONFIG_KEY);
  const raw = stored[RUNTIME_CONFIG_KEY];

  if (raw === undefined) return null;
  if (!isRecord(raw)
    || typeof raw.tmdbAccessToken !== 'string'
    || raw.tmdbAccessToken.trim() === '') {
    throw new InvalidRuntimeConfigError();
  }

  return { tmdbAccessToken: raw.tmdbAccessToken.trim() };
}

function bestScore(
  context: YouTubeVideoContext,
  candidates: CatalogCandidate[]
): MatchScore | null {
  let best: MatchScore | null = null;
  for (const candidate of candidates) {
    const score = scoreCandidate(context, candidate);
    if (best === null || score.confidence > best.confidence) {
      best = score;
    }
  }
  return best;
}

export function createRecognitionOrchestrator(
  options: RecognitionOrchestratorOptions
): (context: YouTubeVideoContext) => Promise<RecognitionResult | null> {
  return async (context) => {
    const config = await loadRuntimeConfig(options.storage);
    if (!config) return null;

    const catalog = new TmdbCatalogProvider({
      accessToken: config.tmdbAccessToken,
      ...(options.fetchFn ? { fetchFn: options.fetchFn } : {})
    });
    const ratings = new TmdbRatingsProvider({
      accessToken: config.tmdbAccessToken,
      ...(options.fetchFn ? { fetchFn: options.fetchFn } : {})
    });

    const [query] = buildSearchQueries(context);
    if (!query) return null;

    const candidates = await catalog.search(query);
    const score = bestScore(context, candidates);
    if (!score) return null;

    const decision = decideMatch(score);
    if (decision.state === 'hidden') {
      return { decision, ratings: [] };
    }

    const rating = await ratings.getRating(score.candidate);
    return {
      decision,
      ratings: [rating]
    };
  };
}

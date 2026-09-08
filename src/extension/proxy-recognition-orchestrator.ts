import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { buildSearchQueries } from '../core/query-builder';
import type { CatalogCandidate, MatchScore, RecognitionResult, YouTubeVideoContext } from '../core/types';
import {
  TmdbProxyCatalogProvider,
  TmdbProxyRatingsProvider,
  normalizeTmdbProxyBaseUrl
} from '../providers/tmdb/tmdb-proxy-provider';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ProductionProxyRuntimeConfig {
  tmdbProxyBaseUrl: string;
}

export interface ProxyRecognitionOrchestratorOptions extends ProductionProxyRuntimeConfig {
  fetchFn?: FetchFn;
}

export function validateProductionProxyRuntimeConfig(
  value: ProductionProxyRuntimeConfig
): ProductionProxyRuntimeConfig {
  return { tmdbProxyBaseUrl: normalizeTmdbProxyBaseUrl(value.tmdbProxyBaseUrl) };
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

export function createProxyRecognitionOrchestrator(
  options: ProxyRecognitionOrchestratorOptions
): (context: YouTubeVideoContext) => Promise<RecognitionResult | null> {
  const config = validateProductionProxyRuntimeConfig(options);
  const catalog = new TmdbProxyCatalogProvider({
    baseUrl: config.tmdbProxyBaseUrl,
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {})
  });
  const ratings = new TmdbProxyRatingsProvider({
    baseUrl: config.tmdbProxyBaseUrl,
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {})
  });

  return async (context) => {
    const [query] = buildSearchQueries(context);
    if (!query) return null;

    const candidates = await catalog.search(query);
    const score = bestScore(context, candidates);
    if (!score) return null;

    const decision = decideMatch(score);
    if (decision.state === 'hidden') {
      return { decision, ratings: [] };
    }

    return {
      decision,
      ratings: [await ratings.getRating(score.candidate)]
    };
  };
}

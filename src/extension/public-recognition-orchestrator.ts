import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { buildSearchQueries } from '../core/query-builder';
import type { CatalogCandidate, MatchScore, RecognitionResult, YouTubeVideoContext } from '../core/types';
import {
  ImdbPublicCatalogProvider,
  ImdbPublicRatingsProvider
} from '../providers/imdb/imdb-public-provider';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PublicRecognitionOrchestratorOptions {
  fetchFn?: FetchFn;
  suggestionBaseUrl?: string;
  titleBaseUrl?: string;
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

export function createPublicRecognitionOrchestrator(
  options: PublicRecognitionOrchestratorOptions = {}
): (context: YouTubeVideoContext) => Promise<RecognitionResult | null> {
  const catalog = new ImdbPublicCatalogProvider({
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    ...(options.suggestionBaseUrl ? { suggestionBaseUrl: options.suggestionBaseUrl } : {})
  });
  const ratings = new ImdbPublicRatingsProvider({
    ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    ...(options.titleBaseUrl ? { titleBaseUrl: options.titleBaseUrl } : {})
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

    const rating = await ratings.getRating(score.candidate);
    return {
      decision,
      ratings: [rating]
    };
  };
}

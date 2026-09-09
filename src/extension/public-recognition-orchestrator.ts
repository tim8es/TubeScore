import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { buildSearchQueries } from '../core/query-builder';
import type { CatalogCandidate, MatchScore, RecognitionResult, YouTubeVideoContext } from '../core/types';
import {
  WikidataApiClient,
  WikidataProviderError,
  WikidataPublicCatalogProvider,
  WikidataPublicRatingsProvider
} from '../providers/wikidata/wikidata-public-provider';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PublicRecognitionOrchestratorOptions {
  fetchFn?: FetchFn;
  apiBaseUrl?: string;
}

function bestScore(
  context: YouTubeVideoContext,
  candidates: CatalogCandidate[]
): MatchScore | null {
  let best: MatchScore | null = null;
  for (const candidate of candidates) {
    const score = scoreCandidate(context, candidate);
    if (best === null || score.confidence > best.confidence) best = score;
  }
  return best;
}

export function createPublicRecognitionOrchestrator(
  options: PublicRecognitionOrchestratorOptions = {}
): (context: YouTubeVideoContext) => Promise<RecognitionResult | null> {
  const client = new WikidataApiClient(options.fetchFn ? { fetchFn: options.fetchFn } : {});
  const providerOptions = {
    client,
    ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})
  };
  const catalog = new WikidataPublicCatalogProvider(providerOptions);
  const ratings = new WikidataPublicRatingsProvider(providerOptions);

  return async (context) => {
    let bestHidden: MatchScore | null = null;

    for (const query of buildSearchQueries(context)) {
      const candidates = await catalog.search(query);
      const score = bestScore(context, candidates);
      if (!score) continue;

      const decision = decideMatch(score);
      if (decision.state === 'hidden') {
        if (bestHidden === null || score.confidence > bestHidden.confidence) {
          bestHidden = score;
        }
        continue;
      }

      try {
        const rating = await ratings.getRating(score.candidate);
        return { decision, ratings: [rating] };
      } catch (error) {
        if (error instanceof WikidataProviderError && error.code === 'rating_unavailable') {
          return { decision, ratings: [] };
        }
        throw error;
      }
    }

    if (bestHidden) {
      return { decision: decideMatch(bestHidden), ratings: [] };
    }
    return null;
  };
}

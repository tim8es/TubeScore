import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { buildSearchQueries } from '../core/query-builder';
import { filterRatingsBySources } from '../core/rating-sources';
import type {
  CatalogCandidate,
  MatchScore,
  RecognitionOptions,
  RecognitionResult,
  YouTubeVideoContext
} from '../core/types';
import { enrichWikidataRatingUrls } from '../providers/wikidata/wikidata-platform-links';
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

function withExactYouTubeIdEvidence(score: MatchScore): MatchScore {
  return {
    ...score,
    confidence: Math.max(score.confidence, 0.95),
    reasons: [...new Set([...score.reasons, 'youtube-video-id-match'])]
  };
}

export function createPublicRecognitionOrchestrator(
  options: PublicRecognitionOrchestratorOptions = {}
): (
  context: YouTubeVideoContext,
  recognitionOptions?: RecognitionOptions
) => Promise<RecognitionResult | null> {
  const client = new WikidataApiClient(options.fetchFn ? { fetchFn: options.fetchFn } : {});
  const providerOptions = {
    client,
    ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {})
  };
  const catalog = new WikidataPublicCatalogProvider(providerOptions);
  const ratings = new WikidataPublicRatingsProvider(providerOptions);

  const resultForVisibleScore = async (
    score: MatchScore,
    recognitionOptions?: RecognitionOptions
  ): Promise<RecognitionResult> => {
    const decision = decideMatch(score);
    const enabledSources = recognitionOptions?.enabledSources;
    if (enabledSources?.length === 0) return { decision, ratings: [] };

    try {
      const available = await ratings.getRatings(score.candidate);
      const enriched = await enrichWikidataRatingUrls(
        score.candidate,
        available,
        client,
        options.apiBaseUrl
      );
      return {
        decision,
        ratings: enabledSources === undefined
          ? enriched
          : filterRatingsBySources(enriched, enabledSources)
      };
    } catch (error) {
      if (error instanceof WikidataProviderError && error.code === 'rating_unavailable') {
        return { decision, ratings: [] };
      }
      throw error;
    }
  };

  return async (context, recognitionOptions) => {
    let bestHidden: MatchScore | null = null;

    const exactScore = bestScore(context, await catalog.searchByYouTubeVideoId(context.videoId));
    if (exactScore) {
      return resultForVisibleScore(withExactYouTubeIdEvidence(exactScore), recognitionOptions);
    }

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

      return resultForVisibleScore(score, recognitionOptions);
    }

    if (bestHidden) {
      return { decision: decideMatch(bestHidden), ratings: [] };
    }
    return null;
  };
}

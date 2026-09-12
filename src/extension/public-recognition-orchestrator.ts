import { scoreCandidate } from '../core/candidate-scorer';
import { decideMatch } from '../core/match-decision';
import { extractFourDigitYear } from '../core/normalize';
import { buildLocalizedSearchRequests } from '../core/query-builder';
import { filterRatingsBySources } from '../core/rating-sources';
import type {
  CatalogCandidate,
  MatchScore,
  RecognitionOptions,
  RecognitionResult,
  YouTubeVideoContext
} from '../core/types';
import { WikidataMultilingualCatalogProvider } from '../providers/wikidata/wikidata-multilingual-catalog';
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

interface CandidateConsensus {
  bestScore: MatchScore;
  supports: Set<string>;
  yearMatched: boolean;
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

function explicitContextYear(context: YouTubeVideoContext): number | undefined {
  return extractFourDigitYear(context.title) ?? extractFourDigitYear(context.description);
}

function requestKey(query: string, language: string): string {
  return `${language.trim().toLowerCase()}\u0000${query.trim().toLowerCase()}`;
}

function hiddenResult(score: MatchScore): RecognitionResult {
  return {
    decision: { state: 'hidden', score },
    ratings: []
  };
}

function compareConsensus(a: CandidateConsensus, b: CandidateConsensus): number {
  const supportDifference = b.supports.size - a.supports.size;
  if (supportDifference !== 0) return supportDifference;

  const yearDifference = Number(b.yearMatched) - Number(a.yearMatched);
  if (yearDifference !== 0) return yearDifference;

  return b.bestScore.confidence - a.bestScore.confidence;
}

function consensusTie(a: CandidateConsensus, b: CandidateConsensus): boolean {
  return a.supports.size === b.supports.size
    && a.yearMatched === b.yearMatched
    && a.bestScore.confidence === b.bestScore.confidence;
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
  const exactCatalog = new WikidataPublicCatalogProvider(providerOptions);
  const titleCatalog = new WikidataMultilingualCatalogProvider(providerOptions);
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
    const exactScore = bestScore(context, await exactCatalog.searchByYouTubeVideoId(context.videoId));
    if (exactScore) {
      return resultForVisibleScore(withExactYouTubeIdEvidence(exactScore), recognitionOptions);
    }

    const requests = buildLocalizedSearchRequests(context);
    if (requests.length === 0) return null;

    const contextYear = explicitContextYear(context);
    const consensusByProvider = new Map<string, CandidateConsensus>();
    let bestFallback: MatchScore | null = null;

    for (const request of requests) {
      const candidates = await titleCatalog.search(request.query, request.language);
      const score = bestScore(context, candidates);
      if (!score) continue;

      if (bestFallback === null || score.confidence > bestFallback.confidence) {
        bestFallback = score;
      }

      const decision = decideMatch(score);
      if (decision.state === 'hidden') continue;

      if (
        contextYear !== undefined
        && score.candidate.releaseYear !== undefined
        && score.candidate.releaseYear !== contextYear
      ) {
        continue;
      }

      const providerId = score.candidate.providerId;
      const existing = consensusByProvider.get(providerId);
      const support = requestKey(request.query, request.language);
      if (!existing) {
        consensusByProvider.set(providerId, {
          bestScore: score,
          supports: new Set([support]),
          yearMatched: score.reasons.includes('year-match')
        });
        continue;
      }

      existing.supports.add(support);
      existing.yearMatched ||= score.reasons.includes('year-match');
      if (score.confidence > existing.bestScore.confidence) {
        existing.bestScore = score;
      }
    }

    const qualified = [...consensusByProvider.values()]
      .filter((entry) => {
        if (contextYear !== undefined) {
          return entry.yearMatched && entry.supports.size >= 2;
        }
        if (requests.length === 1) return entry.supports.size === 1;
        return entry.supports.size >= 2;
      })
      .sort(compareConsensus);

    const winner = qualified[0];
    if (winner) {
      const runnerUp = qualified[1];
      if (runnerUp && consensusTie(winner, runnerUp)) {
        return bestFallback ? hiddenResult(bestFallback) : null;
      }
      return resultForVisibleScore(winner.bestScore, recognitionOptions);
    }

    return bestFallback ? hiddenResult(bestFallback) : null;
  };
}

import type { CatalogCandidate, RatingValue } from '../../core/types';
import { TmdbProviderError } from './tmdb-catalog-provider';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TmdbRatingsProviderOptions {
  accessToken: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class TmdbRatingsProvider {
  private readonly accessToken: string;
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(options: TmdbRatingsProviderOptions) {
    this.accessToken = options.accessToken;
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.themoviedb.org/3';
  }

  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    const url = new URL(`${this.baseUrl}/${candidate.mediaType}/${candidate.providerId}`);
    url.searchParams.set('language', 'en-US');

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new TmdbProviderError(
        'http_error',
        `TMDB rating request failed with HTTP ${response.status}`,
        response.status
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TmdbProviderError('invalid_json', 'TMDB returned malformed rating JSON');
    }

    if (!isRecord(payload)
      || typeof payload.vote_average !== 'number'
      || !Number.isFinite(payload.vote_average)
      || payload.vote_average < 0
      || payload.vote_average > 10
      || typeof payload.vote_count !== 'number'
      || !Number.isInteger(payload.vote_count)
      || payload.vote_count < 0) {
      throw new TmdbProviderError('invalid_response', 'TMDB rating response is invalid');
    }

    return {
      source: 'TMDB',
      value: payload.vote_average,
      scale: 10,
      voteCount: payload.vote_count
    };
  }
}

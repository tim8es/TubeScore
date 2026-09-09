import type { CatalogCandidate, MediaType, RatingValue } from '../../core/types';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ImdbPublicProviderErrorCode =
  | 'http_error'
  | 'invalid_json'
  | 'invalid_response'
  | 'invalid_candidate'
  | 'rating_unavailable';

export class ImdbPublicProviderError extends Error {
  readonly code: ImdbPublicProviderErrorCode;
  readonly status?: number;

  constructor(code: ImdbPublicProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ImdbPublicProviderError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

export interface ImdbPublicCatalogProviderOptions {
  fetchFn?: FetchFn;
  suggestionBaseUrl?: string;
}

export interface ImdbPublicRatingsProviderOptions {
  fetchFn?: FetchFn;
  titleBaseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizedBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function classifyMediaType(entry: Record<string, unknown>): MediaType | null {
  const descriptor = [entry.qid, entry.q]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase();

  if (!descriptor) return null;
  if (/(episode|video\s*game|podcast|music\s*video)/i.test(descriptor)) return null;
  if (/(tv\s*series|tvseries|tv\s*mini|tvmini|tv\s*movie|television\s*series)/i.test(descriptor)) {
    return 'tv';
  }
  if (/(movie|feature|short|film)/i.test(descriptor)) return 'movie';
  return null;
}

function mapSuggestion(entry: unknown): CatalogCandidate | null {
  if (!isRecord(entry)) return null;
  if (typeof entry.id !== 'string' || !/^tt\d{5,12}$/.test(entry.id)) return null;
  if (typeof entry.l !== 'string' || entry.l.trim() === '') return null;

  const mediaType = classifyMediaType(entry);
  if (!mediaType) return null;

  const releaseYear = typeof entry.y === 'number'
    && Number.isInteger(entry.y)
    && entry.y >= 1800
    && entry.y <= 3000
    ? entry.y
    : undefined;

  return {
    providerId: entry.id,
    mediaType,
    title: entry.l.trim(),
    ...(releaseYear !== undefined ? { releaseYear } : {})
  };
}

export class ImdbPublicCatalogProvider {
  private readonly fetchFn: FetchFn;
  private readonly suggestionBaseUrl: string;

  constructor(options: ImdbPublicCatalogProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.suggestionBaseUrl = normalizedBaseUrl(
      options.suggestionBaseUrl ?? 'https://v3.sg.media-imdb.com/suggestion/x'
    );
  }

  async search(query: string): Promise<CatalogCandidate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const url = new URL(`${this.suggestionBaseUrl}/${encodeURIComponent(normalizedQuery)}.json`);
    url.searchParams.set('includeVideos', '0');

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new ImdbPublicProviderError(
        'http_error',
        `IMDb suggestion request failed with HTTP ${response.status}`,
        response.status
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ImdbPublicProviderError('invalid_json', 'IMDb suggestion response is not valid JSON');
    }

    if (!isRecord(payload) || !Array.isArray(payload.d)) {
      throw new ImdbPublicProviderError('invalid_response', 'IMDb suggestion response has an invalid shape');
    }

    return payload.d
      .map(mapSuggestion)
      .filter((candidate): candidate is CatalogCandidate => candidate !== null);
  }
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function findAggregateRating(value: unknown): { value: number; voteCount: number } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAggregateRating(item);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  if (isRecord(value.aggregateRating)) {
    const ratingValue = parseFiniteNumber(value.aggregateRating.ratingValue);
    const ratingCount = parseFiniteNumber(value.aggregateRating.ratingCount);
    if (ratingValue !== null
      && ratingValue >= 0
      && ratingValue <= 10
      && ratingCount !== null
      && Number.isInteger(ratingCount)
      && ratingCount >= 0) {
      return { value: ratingValue, voteCount: ratingCount };
    }
  }

  if (Array.isArray(value['@graph'])) {
    return findAggregateRating(value['@graph']);
  }

  return null;
}

export function parseImdbAggregateRating(html: string): { value: number; voteCount: number } | null {
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const source = match[1]?.trim();
    if (!source) continue;

    let payload: unknown;
    try {
      payload = JSON.parse(source);
    } catch {
      continue;
    }

    const rating = findAggregateRating(payload);
    if (rating) return rating;
  }
  return null;
}

export class ImdbPublicRatingsProvider {
  private readonly fetchFn: FetchFn;
  private readonly titleBaseUrl: string;

  constructor(options: ImdbPublicRatingsProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.titleBaseUrl = normalizedBaseUrl(options.titleBaseUrl ?? 'https://www.imdb.com/title');
  }

  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    if (!/^tt\d{5,12}$/.test(candidate.providerId)) {
      throw new ImdbPublicProviderError('invalid_candidate', 'IMDb candidate id is invalid');
    }

    const url = `${this.titleBaseUrl}/${candidate.providerId}/`;
    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new ImdbPublicProviderError(
        'http_error',
        `IMDb title request failed with HTTP ${response.status}`,
        response.status
      );
    }

    const rating = parseImdbAggregateRating(await response.text());
    if (!rating) {
      throw new ImdbPublicProviderError('rating_unavailable', 'IMDb title page contains no usable rating');
    }

    return {
      source: 'IMDb',
      value: rating.value,
      scale: 10,
      voteCount: rating.voteCount,
      url
    };
  }
}

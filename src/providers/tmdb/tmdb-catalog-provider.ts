import type { CatalogCandidate, MediaType } from '../../core/types';
import type { CatalogProvider } from '../catalog-provider';

export type TmdbProviderErrorCode = 'http_error' | 'invalid_json' | 'invalid_response';

export class TmdbProviderError extends Error {
  readonly code: TmdbProviderErrorCode;
  readonly status?: number;

  constructor(code: TmdbProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'TmdbProviderError';
    this.code = code;
    this.status = status;
  }
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface TmdbCatalogProviderOptions {
  accessToken: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}

interface TmdbSearchResponse {
  results: unknown[];
}

interface TmdbRawResult {
  id: number;
  media_type: MediaType;
  title?: string;
  original_title?: string;
  release_date?: string;
  name?: string;
  original_name?: string;
  first_air_date?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseYear(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  return match ? Number(match[1]) : undefined;
}

function mapResult(value: unknown): CatalogCandidate | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'number' || !Number.isFinite(value.id)) return null;
  if (value.media_type !== 'movie' && value.media_type !== 'tv') return null;

  const raw = value as unknown as TmdbRawResult;
  const title = raw.media_type === 'movie' ? raw.title : raw.name;
  const originalTitle = raw.media_type === 'movie' ? raw.original_title : raw.original_name;
  const releaseYear = raw.media_type === 'movie'
    ? parseYear(raw.release_date)
    : parseYear(raw.first_air_date);

  if (typeof title !== 'string' || title.trim() === '') return null;

  return {
    providerId: String(raw.id),
    mediaType: raw.media_type,
    title,
    ...(typeof originalTitle === 'string' && originalTitle.trim() !== '' ? { originalTitle } : {}),
    ...(releaseYear !== undefined ? { releaseYear } : {})
  };
}

export class TmdbCatalogProvider implements CatalogProvider {
  private readonly accessToken: string;
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(options: TmdbCatalogProviderOptions) {
    this.accessToken = options.accessToken;
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.themoviedb.org/3';
  }

  async search(query: string): Promise<CatalogCandidate[]> {
    const url = new URL(`${this.baseUrl}/search/multi`);
    url.searchParams.set('query', query);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');

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
        `TMDB request failed with HTTP ${response.status}`,
        response.status
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new TmdbProviderError('invalid_json', 'TMDB returned malformed JSON');
    }

    if (!isRecord(payload) || !Array.isArray(payload.results)) {
      throw new TmdbProviderError('invalid_response', 'TMDB response is missing results array');
    }

    return (payload as unknown as TmdbSearchResponse).results
      .map(mapResult)
      .filter((candidate): candidate is CatalogCandidate => candidate !== null);
  }
}

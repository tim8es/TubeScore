import type { CatalogCandidate, MediaType, RatingValue } from '../../core/types';
import type { CatalogProvider } from '../catalog-provider';

export class TmdbProxyProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TmdbProxyProviderError';
    this.status = status;
  }
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ProxyProviderOptions {
  baseUrl: string;
  fetchFn?: FetchFn;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseYear(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  return match ? Number(match[1]) : undefined;
}

function mapCandidate(value: unknown): CatalogCandidate | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'number' || !Number.isFinite(value.id)) return null;
  if (value.media_type !== 'movie' && value.media_type !== 'tv') return null;

  const mediaType: MediaType = value.media_type;
  const title = mediaType === 'movie' ? value.title : value.name;
  const originalTitle = mediaType === 'movie' ? value.original_title : value.original_name;
  const releaseYear = mediaType === 'movie'
    ? parseYear(value.release_date)
    : parseYear(value.first_air_date);

  if (typeof title !== 'string' || title.trim() === '') return null;

  return {
    providerId: String(value.id),
    mediaType,
    title,
    ...(typeof originalTitle === 'string' && originalTitle.trim() !== '' ? { originalTitle } : {}),
    ...(releaseYear !== undefined ? { releaseYear } : {})
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new TmdbProxyProviderError('proxy_request_failed', response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new TmdbProxyProviderError('proxy_invalid_json');
  }
}

export function normalizeTmdbProxyBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('invalid_proxy_base_url');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('invalid_proxy_base_url');
  }

  return url.toString().replace(/\/$/, '');
}

abstract class BaseProxyProvider {
  protected readonly baseUrl: string;
  protected readonly fetchFn: FetchFn;

  constructor(options: ProxyProviderOptions) {
    this.baseUrl = normalizeTmdbProxyBaseUrl(options.baseUrl);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  protected get(input: string): Promise<Response> {
    return this.fetchFn(input, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
  }
}

export class TmdbProxyCatalogProvider extends BaseProxyProvider implements CatalogProvider {
  async search(query: string): Promise<CatalogCandidate[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');

    const payload = await readJson(await this.get(url.toString()));
    if (!isRecord(payload) || !Array.isArray(payload.results)) {
      throw new TmdbProxyProviderError('proxy_invalid_response');
    }

    return payload.results
      .map(mapCandidate)
      .filter((candidate): candidate is CatalogCandidate => candidate !== null);
  }
}

export class TmdbProxyRatingsProvider extends BaseProxyProvider {
  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    if (!/^\d+$/.test(candidate.providerId)) {
      throw new TmdbProxyProviderError('invalid_provider_id');
    }

    const url = new URL(`${this.baseUrl}/${candidate.mediaType}/${candidate.providerId}`);
    url.searchParams.set('language', 'en-US');

    const payload = await readJson(await this.get(url.toString()));
    if (!isRecord(payload)
      || typeof payload.vote_average !== 'number'
      || !Number.isFinite(payload.vote_average)) {
      throw new TmdbProxyProviderError('proxy_invalid_response');
    }

    return {
      source: 'TMDB',
      value: payload.vote_average,
      scale: 10,
      ...(typeof payload.vote_count === 'number' && Number.isFinite(payload.vote_count)
        ? { voteCount: payload.vote_count }
        : {})
    };
  }
}

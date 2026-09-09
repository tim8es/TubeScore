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
  ratingsDatasetUrl?: string;
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
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];

    const url = new URL(`${this.suggestionBaseUrl}/${encodeURIComponent(normalizedQuery)}.json`);
    const response = await this.fetchFn(url, {
      method: 'GET',
      cache: 'force-cache',
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

async function decodeRatingsDataset(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return new TextDecoder().decode(bytes);

  try {
    const body = new Response(buffer).body;
    if (!body) throw new Error('missing_body');
    const stream = body.pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch {
    throw new ImdbPublicProviderError(
      'invalid_response',
      'IMDb ratings dataset could not be decompressed'
    );
  }
}

function findRatingRow(dataset: string, providerId: string): { value: number; voteCount: number } | null {
  const marker = `\n${providerId}\t`;
  const markerIndex = dataset.indexOf(marker);
  if (markerIndex < 0) return null;

  const rowStart = markerIndex + 1;
  const rowEndIndex = dataset.indexOf('\n', rowStart);
  const rowEnd = rowEndIndex < 0 ? dataset.length : rowEndIndex;
  const row = dataset.slice(rowStart, rowEnd);
  const [id, ratingRaw, votesRaw] = row.split('\t');
  if (id !== providerId || ratingRaw === undefined || votesRaw === undefined) return null;

  const value = Number(ratingRaw);
  const voteCount = Number(votesRaw);
  if (!Number.isFinite(value)
    || value < 0
    || value > 10
    || !Number.isInteger(voteCount)
    || voteCount < 0) {
    return null;
  }

  return { value, voteCount };
}

export class ImdbPublicRatingsProvider {
  private readonly fetchFn: FetchFn;
  private readonly ratingsDatasetUrl: string;
  private datasetPromise: Promise<string> | null = null;

  constructor(options: ImdbPublicRatingsProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.ratingsDatasetUrl = options.ratingsDatasetUrl
      ?? 'https://datasets.imdbws.com/title.ratings.tsv.gz';
  }

  private async fetchDataset(): Promise<string> {
    const response = await this.fetchFn(this.ratingsDatasetUrl, {
      method: 'GET',
      cache: 'force-cache',
      headers: { Accept: 'application/gzip, application/octet-stream, text/tab-separated-values' }
    });

    if (!response.ok) {
      throw new ImdbPublicProviderError(
        'http_error',
        `IMDb ratings dataset request failed with HTTP ${response.status}`,
        response.status
      );
    }

    return decodeRatingsDataset(await response.arrayBuffer());
  }

  private loadDataset(): Promise<string> {
    if (this.datasetPromise) return this.datasetPromise;
    this.datasetPromise = this.fetchDataset().catch((error: unknown) => {
      this.datasetPromise = null;
      throw error;
    });
    return this.datasetPromise;
  }

  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    if (!/^tt\d{5,12}$/.test(candidate.providerId)) {
      throw new ImdbPublicProviderError('invalid_candidate', 'IMDb candidate id is invalid');
    }

    const rating = findRatingRow(await this.loadDataset(), candidate.providerId);
    if (!rating) {
      throw new ImdbPublicProviderError(
        'rating_unavailable',
        'IMDb ratings dataset contains no usable rating for this title'
      );
    }

    return {
      source: 'IMDb',
      value: rating.value,
      scale: 10,
      voteCount: rating.voteCount,
      url: `https://www.imdb.com/title/${candidate.providerId}/`
    };
  }
}

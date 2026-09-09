import type { CatalogCandidate, RatingValue } from '../../core/types';

export type WikidataProviderErrorCode =
  | 'http_error'
  | 'invalid_json'
  | 'invalid_response'
  | 'invalid_candidate'
  | 'rating_unavailable';

export class WikidataProviderError extends Error {
  readonly code: WikidataProviderErrorCode;
  readonly status?: number;

  constructor(code: WikidataProviderErrorCode, options: { status?: number; cause?: unknown } = {}) {
    super(code, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'WikidataProviderError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
  }
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface WikidataProviderOptions {
  fetchFn?: FetchFn;
  apiBaseUrl?: string;
}

const DEFAULT_API_BASE_URL = 'https://www.wikidata.org/w/api.php';
const API_USER_AGENT = 'TubeScore/0.1 (https://github.com/tim8es/TubeScore)';
const ITEM_ID = /^Q\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defaultFetch(): FetchFn {
  return globalThis.fetch.bind(globalThis);
}

function commonHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Api-User-Agent': API_USER_AGENT
  };
}

async function fetchJson(fetchFn: FetchFn, url: URL): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      cache: 'force-cache',
      headers: commonHeaders()
    });
  } catch (cause) {
    throw new WikidataProviderError('http_error', { cause });
  }

  if (!response.ok) {
    throw new WikidataProviderError('http_error', { status: response.status });
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new WikidataProviderError('invalid_json', { cause });
  }
}

function classifyDescription(description: string): CatalogCandidate['mediaType'] | null {
  if (/\b(?:film|movie)\b/i.test(description)) return 'movie';
  if (/\b(?:television|tv)\s+(?:series|program|programme|miniseries)\b/i.test(description)) return 'tv';
  if (/\b(?:web series|miniseries)\b/i.test(description)) return 'tv';
  return null;
}

function extractYear(description: string): number | undefined {
  const match = description.match(/\b(18\d{2}|19\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function searchCandidate(value: unknown): CatalogCandidate | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const label = value.label;
  const description = value.description;
  if (typeof id !== 'string' || !ITEM_ID.test(id)) return null;
  if (typeof label !== 'string' || label.trim() === '') return null;
  if (typeof description !== 'string') return null;

  const mediaType = classifyDescription(description);
  if (!mediaType) return null;

  const releaseYear = extractYear(description);
  return {
    providerId: id,
    mediaType,
    title: label.trim(),
    ...(releaseYear === undefined ? {} : { releaseYear })
  };
}

function parseNumericScore(value: unknown): { value: number; scale: number } | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const score = Number(fraction[1]);
    const scale = Number(fraction[2]);
    if (Number.isFinite(score) && Number.isFinite(scale) && scale > 0 && score >= 0 && score <= scale) {
      return { value: score, scale };
    }
    return null;
  }

  const percent = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    const score = Number(percent[1]);
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      return { value: score, scale: 100 };
    }
  }

  return null;
}

function statementValue(statement: unknown): string | null {
  if (!isRecord(statement)) return null;
  const mainsnak = statement.mainsnak;
  if (!isRecord(mainsnak)) return null;
  const datavalue = mainsnak.datavalue;
  if (!isRecord(datavalue)) return null;
  return typeof datavalue.value === 'string' ? datavalue.value : null;
}

function issuerId(statement: unknown): string | null {
  if (!isRecord(statement) || !isRecord(statement.qualifiers)) return null;
  const values = statement.qualifiers.P447;
  if (!Array.isArray(values)) return null;
  for (const snak of values) {
    if (!isRecord(snak) || !isRecord(snak.datavalue) || !isRecord(snak.datavalue.value)) continue;
    const id = snak.datavalue.value.id;
    if (typeof id === 'string' && ITEM_ID.test(id)) return id;
  }
  return null;
}

function chooseReviewStatement(statements: unknown[]): { parsed: { value: number; scale: number }; issuerId: string | null } | null {
  const ranked = [...statements].sort((a, b) => {
    const rankValue = (item: unknown) => isRecord(item) && item.rank === 'preferred' ? 0 : 1;
    return rankValue(a) - rankValue(b);
  });

  for (const statement of ranked) {
    if (isRecord(statement) && statement.rank === 'deprecated') continue;
    const parsed = parseNumericScore(statementValue(statement));
    if (!parsed) continue;
    return { parsed, issuerId: issuerId(statement) };
  }
  return null;
}

function entityFromPayload(payload: unknown, id: string): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.entities)) {
    throw new WikidataProviderError('invalid_response');
  }
  const entity = payload.entities[id];
  if (!isRecord(entity)) throw new WikidataProviderError('invalid_response');
  return entity;
}

export class WikidataPublicCatalogProvider {
  private readonly fetchFn: FetchFn;
  private readonly apiBaseUrl: string;

  constructor(options: WikidataProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? defaultFetch();
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  async search(query: string): Promise<CatalogCandidate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const url = new URL(this.apiBaseUrl);
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', normalizedQuery);
    url.searchParams.set('language', 'en');
    url.searchParams.set('uselang', 'en');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const payload = await fetchJson(this.fetchFn, url);
    if (!isRecord(payload) || !Array.isArray(payload.search)) {
      throw new WikidataProviderError('invalid_response');
    }

    return payload.search
      .map(searchCandidate)
      .filter((candidate): candidate is CatalogCandidate => candidate !== null);
  }
}

export class WikidataPublicRatingsProvider {
  private readonly fetchFn: FetchFn;
  private readonly apiBaseUrl: string;

  constructor(options: WikidataProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? defaultFetch();
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    if (!ITEM_ID.test(candidate.providerId)) {
      throw new WikidataProviderError('invalid_candidate');
    }

    const entity = await this.getEntity(candidate.providerId, 'claims');
    const claims = entity.claims;
    if (!isRecord(claims) || !Array.isArray(claims.P444)) {
      throw new WikidataProviderError('rating_unavailable');
    }

    const chosen = chooseReviewStatement(claims.P444);
    if (!chosen) throw new WikidataProviderError('rating_unavailable');

    const issuer = chosen.issuerId ? await this.getEnglishLabel(chosen.issuerId) : null;
    return {
      source: issuer ? `${issuer} via Wikidata` : 'Wikidata',
      value: chosen.parsed.value,
      scale: chosen.parsed.scale,
      url: `https://www.wikidata.org/wiki/${candidate.providerId}`
    };
  }

  private async getEnglishLabel(id: string): Promise<string | null> {
    const entity = await this.getEntity(id, 'labels');
    if (!isRecord(entity.labels) || !isRecord(entity.labels.en)) return null;
    const value = entity.labels.en.value;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async getEntity(id: string, props: 'claims' | 'labels'): Promise<Record<string, unknown>> {
    const url = new URL(this.apiBaseUrl);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', id);
    url.searchParams.set('props', props);
    url.searchParams.set('languages', 'en');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    const payload = await fetchJson(this.fetchFn, url);
    return entityFromPayload(payload, id);
  }
}

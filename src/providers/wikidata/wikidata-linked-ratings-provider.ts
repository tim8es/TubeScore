import type { CatalogCandidate, RatingValue } from '../../core/types';
import {
  WikidataApiClient,
  WikidataProviderError,
  WikidataPublicRatingsProvider,
  type WikidataProviderOptions
} from './wikidata-public-provider';

const DEFAULT_API_BASE_URL = 'https://www.wikidata.org/w/api.php';

type Claims = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstClaimString(claims: Claims, property: string): string | null {
  const statements = claims[property];
  if (!Array.isArray(statements)) return null;
  for (const statement of statements) {
    if (!isRecord(statement) || !isRecord(statement.mainsnak) || !isRecord(statement.mainsnak.datavalue)) continue;
    const value = statement.mainsnak.datavalue.value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function platformUrl(source: string, claims: Claims): string | undefined {
  if (source === 'IMDb') {
    const id = firstClaimString(claims, 'P345');
    return id && /^tt\d+$/.test(id) ? `https://www.imdb.com/title/${id}/` : undefined;
  }
  if (source === 'Rotten Tomatoes') {
    const id = firstClaimString(claims, 'P1258');
    return id && /^(?:m|tv)\/[A-Za-z0-9_\/-]+$/.test(id) && !id.includes('..')
      ? `https://www.rottentomatoes.com/${id}`
      : undefined;
  }
  if (source === 'Metacritic') {
    const id = firstClaimString(claims, 'P1712');
    return id && /^(?:movie|tv)\/[A-Za-z0-9_\/-]+$/.test(id) && !id.includes('..')
      ? `https://www.metacritic.com/${id}`
      : undefined;
  }
  if (source === 'Kinopoisk') {
    const id = firstClaimString(claims, 'P2603');
    return id && /^\d+$/.test(id) ? `https://www.kinopoisk.ru/film/${id}/` : undefined;
  }
  return undefined;
}

function sourceName(source: string): string {
  return source.replace(/\s+via Wikidata$/i, '').trim();
}

export class WikidataLinkedRatingsProvider {
  private readonly client: WikidataApiClient;
  private readonly ratings: WikidataPublicRatingsProvider;
  private readonly apiBaseUrl: string;

  constructor(options: WikidataProviderOptions = {}) {
    this.client = options.client ?? new WikidataApiClient(options);
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    this.ratings = new WikidataPublicRatingsProvider({ ...options, client: this.client });
  }

  async getRatings(candidate: CatalogCandidate): Promise<RatingValue[]> {
    const ratings = await this.ratings.getRatings(candidate);
    const claims = await this.getClaims(candidate.providerId);

    return ratings.map((rating) => {
      const directUrl = platformUrl(sourceName(rating.source), claims);
      if (directUrl) return { ...rating, url: directUrl };
      const { url: _ignored, ...withoutUrl } = rating;
      return withoutUrl;
    });
  }

  async getRating(candidate: CatalogCandidate): Promise<RatingValue> {
    const ratings = await this.getRatings(candidate);
    const first = ratings[0];
    if (!first) throw new WikidataProviderError('rating_unavailable');
    return first;
  }

  private async getClaims(id: string): Promise<Claims> {
    const url = new URL(this.apiBaseUrl);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', id);
    url.searchParams.set('props', 'claims');
    url.searchParams.set('languages', 'en');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const payload = await this.client.getJson(url);
    if (!isRecord(payload) || !isRecord(payload.entities) || !isRecord(payload.entities[id])) {
      throw new WikidataProviderError('invalid_response');
    }
    const claims = payload.entities[id].claims;
    return isRecord(claims) ? claims : {};
  }
}

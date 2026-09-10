import { ratingSourceName } from '../../core/rating-sources';
import type { CatalogCandidate, RatingValue } from '../../core/types';
import { WikidataApiClient, WikidataProviderError } from './wikidata-public-provider';

const DEFAULT_API_BASE_URL = 'https://www.wikidata.org/w/api.php';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statementValue(statement: unknown): string | null {
  if (!isRecord(statement) || !isRecord(statement.mainsnak) || !isRecord(statement.mainsnak.datavalue)) return null;
  const value = statement.mainsnak.datavalue.value;
  return typeof value === 'string' ? value.trim() : null;
}

function firstClaimString(claims: Record<string, unknown>, property: string): string | null {
  const statements = claims[property];
  if (!Array.isArray(statements)) return null;
  const ranked = [...statements].sort((a, b) => {
    const rank = (item: unknown) => {
      if (!isRecord(item)) return 1;
      if (item.rank === 'preferred') return 0;
      if (item.rank === 'deprecated') return 2;
      return 1;
    };
    return rank(a) - rank(b);
  });
  for (const statement of ranked) {
    if (isRecord(statement) && statement.rank === 'deprecated') continue;
    const value = statementValue(statement);
    if (value) return value;
  }
  return null;
}

function exactPlatformUrl(source: string, claims: Record<string, unknown>): string | null {
  if (source === 'Letterboxd') {
    const id = firstClaimString(claims, 'P6127');
    return id && /^[a-z0-9][a-z0-9_-]*$/i.test(id)
      ? `https://letterboxd.com/film/${id}/`
      : null;
  }
  if (source === 'Douban') {
    const id = firstClaimString(claims, 'P4529');
    return id && /^\d{1,12}$/.test(id)
      ? `https://movie.douban.com/subject/${id}/`
      : null;
  }
  if (source === 'AllMovie') {
    const id = firstClaimString(claims, 'P1562');
    return id && /^[A-Za-z0-9_-]{2,40}$/.test(id)
      ? `https://www.allmovie.com/movie/-${id}`
      : null;
  }
  if (source === 'FilmAffinity') {
    const id = firstClaimString(claims, 'P480');
    return id && /^\d{1,12}$/.test(id)
      ? `https://www.filmaffinity.com/en/film${id}.html`
      : null;
  }
  if (source === 'Trakt.tv') {
    const id = firstClaimString(claims, 'P8013');
    return id
      && /^(?:movies|shows)\/[a-z0-9][a-z0-9_/-]*$/i.test(id)
      && !id.includes('..')
      ? `https://trakt.tv/${id}`
      : null;
  }
  return null;
}

export async function enrichWikidataRatingUrls(
  candidate: CatalogCandidate,
  ratings: readonly RatingValue[],
  client: WikidataApiClient,
  apiBaseUrl = DEFAULT_API_BASE_URL
): Promise<RatingValue[]> {
  const needsEnrichment = ratings.some((rating) =>
    ['Letterboxd', 'Douban', 'AllMovie', 'FilmAffinity', 'Trakt.tv'].includes(ratingSourceName(rating.source))
  );
  if (!needsEnrichment) return [...ratings];

  const url = new URL(apiBaseUrl);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', candidate.providerId);
  url.searchParams.set('props', 'claims');
  url.searchParams.set('languages', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const payload = await client.getJson(url);
  if (!isRecord(payload) || !isRecord(payload.entities)) {
    throw new WikidataProviderError('invalid_response');
  }
  const entity = payload.entities[candidate.providerId];
  if (!isRecord(entity) || !isRecord(entity.claims)) {
    throw new WikidataProviderError('invalid_response');
  }
  const claims = entity.claims;

  return ratings.map((rating) => {
    const direct = exactPlatformUrl(ratingSourceName(rating.source), claims);
    return direct ? { ...rating, url: direct } : { ...rating };
  });
}

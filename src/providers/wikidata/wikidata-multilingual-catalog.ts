import type { CatalogCandidate } from '../../core/types';
import {
  WikidataApiClient,
  WikidataProviderError,
  type WikidataProviderOptions
} from './wikidata-public-provider';

const DEFAULT_API_BASE_URL = 'https://www.wikidata.org/w/api.php';
const ITEM_ID = /^Q\d+$/;
const SUPPORTED_LANGUAGES = new Set([
  'en', 'ru', 'uk', 'es', 'de', 'fr', 'it', 'pt', 'pl', 'tr', 'ja', 'ko', 'zh'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  return SUPPORTED_LANGUAGES.has(value) ? value : 'en';
}

function classifyDescription(description: string): CatalogCandidate['mediaType'] | null {
  const value = description.normalize('NFKC').toLowerCase();

  if (/\b(?:film|movie|filme)\b/u.test(value)) return 'movie';
  if (/(?:фильм|фільм|película)/u.test(value)) return 'movie';
  if (/(?:映画|영화|电影|電影)/u.test(value)) return 'movie';

  if (/\b(?:television|tv)\s+(?:series|program|programme|miniseries)\b/u.test(value)) return 'tv';
  if (/(?:web series|miniseries|телесериал|сериал|телесеріал|серіал|fernsehserie|serial|dizi)/u.test(value)) return 'tv';
  if (/(?:serie\s+de\s+televisión|série\s+de\s+televisão|série\s+télévisée|serie\s+televisiva)/u.test(value)) return 'tv';
  if (/(?:テレビ(?:ドラマ|シリーズ)|텔레비전\s*(?:드라마|시리즈)|드라마|电视剧|電視劇|电视连续剧|電視連續劇)/u.test(value)) return 'tv';

  return null;
}

function extractYear(description: string): number | undefined {
  const match = description.match(/\b(18\d{2}|19\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

function aliasesFromSearchResult(value: Record<string, unknown>, label: string): string[] {
  if (!Array.isArray(value.aliases)) return [];
  const seen = new Set([label.toLocaleLowerCase()]);
  const aliases: string[] = [];
  for (const raw of value.aliases) {
    if (typeof raw !== 'string') continue;
    const alias = raw.trim();
    const key = alias.toLocaleLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
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

  const title = label.trim();
  const aliases = aliasesFromSearchResult(value, title);
  const releaseYear = extractYear(description);
  return {
    providerId: id,
    mediaType,
    title,
    ...(aliases.length === 0 ? {} : { aliases }),
    ...(releaseYear === undefined ? {} : { releaseYear })
  };
}

export class WikidataMultilingualCatalogProvider {
  private readonly client: WikidataApiClient;
  private readonly apiBaseUrl: string;

  constructor(options: WikidataProviderOptions = {}) {
    this.client = options.client ?? new WikidataApiClient(options);
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  async search(query: string, language: string): Promise<CatalogCandidate[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const locale = normalizedLanguage(language);

    const url = new URL(this.apiBaseUrl);
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', normalizedQuery);
    url.searchParams.set('language', locale);
    url.searchParams.set('uselang', locale);
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const payload = await this.client.getJson(url);
    if (!isRecord(payload) || !Array.isArray(payload.search)) {
      throw new WikidataProviderError('invalid_response');
    }

    return payload.search
      .map(searchCandidate)
      .filter((candidate): candidate is CatalogCandidate => candidate !== null);
  }
}

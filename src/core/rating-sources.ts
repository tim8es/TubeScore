import type { RatingValue } from './types';

export const DEFAULT_ENABLED_RATING_SOURCES = [
  'Kinopoisk',
  'IMDb',
  'Rotten Tomatoes',
  'Metacritic'
] as const;

export const RATING_SOURCE_CATALOG = [
  ...DEFAULT_ENABLED_RATING_SOURCES,
  'AllMovie',
  'Letterboxd',
  'Douban',
  'FilmAffinity',
  'Trakt.tv',
  'Watcha!',
  'Wikidata',
  'TMDB'
] as const;

const SOURCE_ALIASES = new Map<string, string>([
  ['kinopoisk', 'Kinopoisk'],
  ['kinopoisk.ru', 'Kinopoisk'],
  ['кинопоиск', 'Kinopoisk'],
  ['imdb', 'IMDb'],
  ['internet movie database', 'IMDb'],
  ['rotten tomatoes', 'Rotten Tomatoes'],
  ['metacritic', 'Metacritic'],
  ['allmovie', 'AllMovie'],
  ['all movie', 'AllMovie'],
  ['letterboxd', 'Letterboxd'],
  ['douban', 'Douban'],
  ['filmaffinity', 'FilmAffinity'],
  ['film affinity', 'FilmAffinity'],
  ['trakt', 'Trakt.tv'],
  ['trakt.tv', 'Trakt.tv'],
  ['watcha', 'Watcha!'],
  ['watcha!', 'Watcha!'],
  ['wikidata', 'Wikidata'],
  ['tmdb', 'TMDB']
]);

export function ratingSourceName(source: string): string {
  const stripped = source.replace(/\s+via Wikidata$/i, '').trim();
  if (!stripped) return '';
  return SOURCE_ALIASES.get(stripped.toLocaleLowerCase()) ?? stripped;
}

export function normalizeEnabledRatingSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_ENABLED_RATING_SOURCES];

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const name = ratingSourceName(item);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }

  const priority = new Map<string, number>(RATING_SOURCE_CATALOG.map((name, index) => [name, index]));
  return normalized
    .map((name, index) => ({ name, index }))
    .sort((a, b) => {
      const aPriority = priority.get(a.name) ?? RATING_SOURCE_CATALOG.length + a.index;
      const bPriority = priority.get(b.name) ?? RATING_SOURCE_CATALOG.length + b.index;
      return aPriority - bPriority;
    })
    .map(({ name }) => name);
}

export function sourceCatalogWithRatings(ratings: readonly RatingValue[]): string[] {
  return normalizeEnabledRatingSources([
    ...RATING_SOURCE_CATALOG,
    ...ratings.map((rating) => ratingSourceName(rating.source))
  ]);
}

export function filterRatingsBySources(
  ratings: readonly RatingValue[],
  enabledSources: readonly string[]
): RatingValue[] {
  const enabled = new Set(normalizeEnabledRatingSources(enabledSources));
  return ratings.filter((rating) => enabled.has(ratingSourceName(rating.source)));
}

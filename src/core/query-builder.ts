import type { YouTubeVideoContext } from './types';
import {
  extractFourDigitYear,
  normalizeYouTubeTitle,
  primaryYouTubeTitle
} from './normalize';

export interface LocalizedSearchRequest {
  query: string;
  language: string;
}

const LATIN_FALLBACK_LANGUAGES = ['en', 'es', 'de', 'fr', 'it', 'pt', 'pl', 'tr'] as const;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function inferWikidataSearchLanguages(input: string): string[] {
  const value = input.normalize('NFKC').toLowerCase();

  if (/[\u3040-\u30ff]/u.test(value) || /(?:予告|映画)/u.test(value)) return ['ja', 'zh', 'en'];
  if (/[\uac00-\ud7af]/u.test(value) || /예고편/u.test(value)) return ['ko', 'en'];
  if (/[\u3400-\u4dbf\u4e00-\u9fff]/u.test(value)) return ['zh', 'ja', 'en'];

  if (/[іїєґ]/u.test(value)) return ['uk', 'ru', 'en'];
  if (/[а-яё]/u.test(value)) return ['ru', 'uk', 'en'];

  if (/offiziell|filmtrailer|kinotrailer|deutsch/u.test(value)) return ['de', 'en'];
  if (/bande[-\s]?annonce|officielle/u.test(value)) return ['fr', 'en'];
  if (/ufficiale/u.test(value)) return ['it', 'en'];
  if (/dublado|legendado|portugu[eê]s|\bfilme\b/u.test(value)) return ['pt', 'en'];
  if (/zwiastun|polski/u.test(value)) return ['pl', 'en'];
  if (/fragman|türk|turk/u.test(value)) return ['tr', 'en'];
  if (/tráiler|avance|película|castellano|latino/u.test(value)) return ['es', 'en'];
  if (/trailer\s+oficial/u.test(value)) return ['es', 'pt', 'en'];
  if (/official\s+(?:trailer|teaser)|\b(?:trailer|teaser)\b/u.test(value)) return ['en'];

  if (/[ñ¿¡]/u.test(value)) return ['es', 'en'];
  if (/[ãõ]/u.test(value)) return ['pt', 'en'];
  if (/[ąęłńśźż]/u.test(value)) return ['pl', 'en'];
  if (/[ğış]/u.test(value)) return ['tr', 'en'];
  if (/ß/u.test(value)) return ['de', 'en'];
  if (/œ/u.test(value)) return ['fr', 'en'];
  if (/[äöü]/u.test(value)) return ['de', 'tr', 'en'];

  return [...LATIN_FALLBACK_LANGUAGES];
}

export function buildSearchQueries(context: YouTubeVideoContext): string[] {
  const primaryTitle = primaryYouTubeTitle(context.title);
  const titleYear = extractFourDigitYear(context.title);
  const descriptionYear = extractFourDigitYear(context.description);
  const candidates = [
    titleYear && primaryTitle ? `${primaryTitle} ${titleYear}` : primaryTitle,
    !titleYear && descriptionYear && primaryTitle ? `${primaryTitle} ${descriptionYear}` : '',
    normalizeYouTubeTitle(context.title),
    normalizeYouTubeTitle(context.description.split('\n')[0] ?? ''),
    ...context.hashtags.map((tag) => normalizeYouTubeTitle(tag.replace(/^#/, '')))
  ].filter((value) => value.length >= 2);

  return [...new Set(candidates)];
}

export function buildLocalizedSearchRequests(context: YouTubeVideoContext): LocalizedSearchRequest[] {
  const queries = buildSearchQueries(context);
  const primaryQuery = queries[0];
  if (!primaryQuery) return [];

  const languages = inferWikidataSearchLanguages(context.title);
  const requests: LocalizedSearchRequest[] = [];
  const seen = new Set<string>();
  const add = (query: string, language: string): void => {
    const key = `${language}\u0000${query}`;
    if (seen.has(key)) return;
    seen.add(key);
    requests.push({ query, language });
  };

  for (const language of languages) add(primaryQuery, language);

  const secondaryLanguages = unique([languages[0] ?? 'en', 'en']);
  for (const query of queries.slice(1)) {
    for (const language of secondaryLanguages) add(query, language);
  }

  return requests;
}

import type { YouTubeVideoContext } from './types';
import {
  extractFourDigitYear,
  normalizeYouTubeTitle,
  primaryYouTubeTitle
} from './normalize';

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

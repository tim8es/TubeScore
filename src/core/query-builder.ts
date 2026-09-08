import type { YouTubeVideoContext } from './types';
import { normalizeYouTubeTitle } from './normalize';

export function buildSearchQueries(context: YouTubeVideoContext): string[] {
  const candidates = [
    normalizeYouTubeTitle(context.title),
    normalizeYouTubeTitle(context.description.split('\n')[0] ?? ''),
    ...context.hashtags.map((tag) => normalizeYouTubeTitle(tag.replace(/^#/, '')))
  ].filter((value) => value.length >= 2);

  return [...new Set(candidates)];
}

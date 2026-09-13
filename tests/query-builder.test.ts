import { describe, expect, it } from 'vitest';
import { buildSearchQueries } from '../src/core/query-builder';
import type { YouTubeVideoContext } from '../src/core/types';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer 3 (2024) 4K',
  description: 'Warner Bros. Pictures presents Dune: Part Two.',
  channelName: 'Warner Bros. Pictures',
  hashtags: ['DunePartTwo'],
  url: 'https://www.youtube.com/watch?v=abc123'
};

describe('buildSearchQueries', () => {
  it('emits a compact year-qualified query first and avoids duplicates', () => {
    const queries = buildSearchQueries(context);
    expect(queries[0]).toBe('dune part two 2024');
    expect(new Set(queries).size).toBe(queries.length);
  });

  it('also emits the clean primary title without the year as a Wikidata fallback', () => {
    const russianContext: YouTubeVideoContext = {
      videoId: 'yv5-FG08fqg',
      title: 'Дюна: Часть третья — Русский трейлер #2 (Дубляж, 2026)',
      description: '',
      channelName: 'Live benchmark',
      hashtags: [],
      url: 'https://www.youtube.com/watch?v=yv5-FG08fqg'
    };

    const queries = buildSearchQueries(russianContext);
    expect(queries[0]).toBe('дюна часть третья 2026');
    expect(queries).toContain('дюна часть третья');
  });

  it('uses the YouTube publish year as a weak query hint when release year is absent', () => {
    const publishedContext = {
      videoId: 'SJVmeJaS44s',
      title: "Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max",
      description: 'Welcome to a new year at Hogwarts. The HBO Original Series premieres this Christmas.',
      channelName: 'Harry Potter',
      hashtags: ['HarryPotterHBO'],
      url: 'https://www.youtube.com/watch?v=SJVmeJaS44s',
      publishedYear: 2026
    } as YouTubeVideoContext & { publishedYear: number };

    const queries = buildSearchQueries(publishedContext);
    expect(queries[0]).toBe('harry potter and the philosopher s stone 2026');
    expect(queries[1]).toBe('harry potter and the philosopher s stone 2027');
    expect(queries).toContain('harry potter and the philosopher s stone');
  });

  it('does not add upload-year hints when the title already states a release year', () => {
    const publishedContext = {
      ...context,
      publishedYear: 2026
    } as YouTubeVideoContext & { publishedYear: number };

    const queries = buildSearchQueries(publishedContext);
    expect(queries[0]).toBe('dune part two 2024');
    expect(queries).not.toContain('dune part two 2026');
    expect(queries).not.toContain('dune part two 2027');
  });
});

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
  it('emits a compact canonical title query first and avoids duplicates', () => {
    const queries = buildSearchQueries(context);
    expect(queries[0]).toBe('dune part two 2024');
    expect(new Set(queries).size).toBe(queries.length);
  });
});

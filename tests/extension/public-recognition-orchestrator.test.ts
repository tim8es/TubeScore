import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideoContext } from '../../src/core/types';
import { createPublicRecognitionOrchestrator } from '../../src/extension/public-recognition-orchestrator';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer (2024)',
  description: '',
  channelName: 'Warner Bros. Pictures',
  hashtags: ['DunePartTwo'],
  url: 'https://www.youtube.com/watch?v=abc123'
};

function ratingsDataset(): Uint8Array {
  return new Uint8Array(gzipSync([
    'tconst\taverageRating\tnumVotes',
    'tt15239678\t8.5\t650123',
    ''
  ].join('\n')));
}

describe('zero-config production recognition orchestrator', () => {
  it('recognizes and rates through public IMDb data without runtime config or credentials', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('sg.media-imdb.com/suggestion/')) {
        return new Response(JSON.stringify({
          d: [{ id: 'tt15239678', l: 'Dune: Part Two', y: 2024, qid: 'movie' }]
        }), { status: 200 });
      }
      if (url === 'https://datasets.imdbws.com/title.ratings.tsv.gz') {
        return new Response(ratingsDataset(), { status: 200 });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate).toMatchObject({
      providerId: 'tt15239678',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });
    expect(result?.ratings).toEqual([{
      source: 'IMDb',
      value: 8.5,
      scale: 10,
      voteCount: 650123,
      url: 'https://www.imdb.com/title/tt15239678/'
    }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchFn.mock.calls) {
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
    }
  });

  it('does not load the ratings dataset when the catalog match is hidden', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      d: [{ id: 'tt0000001', l: 'Completely Different Film', y: 1900, qid: 'movie' }]
    }), { status: 200 }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('hidden');
    expect(result?.ratings).toEqual([]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('returns null when IMDb search has no supported title candidates', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      d: [{ id: 'nm0000001', l: 'A Person', qid: 'name' }]
    }), { status: 200 }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    await expect(recognize(context)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

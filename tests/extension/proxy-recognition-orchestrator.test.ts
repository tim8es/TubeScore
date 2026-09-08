import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideoContext } from '../../src/core/types';
import { createProxyRecognitionOrchestrator } from '../../src/extension/proxy-recognition-orchestrator';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer (2024)',
  description: '',
  channelName: 'Warner Bros. Pictures',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=abc123'
};

describe('proxy-backed recognition orchestrator', () => {
  it('runs catalog -> score -> decision -> rating entirely through the proxy', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/search')) {
        return new Response(JSON.stringify({
          results: [{
            id: 693134,
            media_type: 'movie',
            title: 'Dune: Part Two',
            release_date: '2024-02-27'
          }]
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ vote_average: 8.4, vote_count: 6200 }), { status: 200 });
    });

    const recognize = createProxyRecognitionOrchestrator({
      tmdbProxyBaseUrl: 'https://proxy.example/api/tmdb',
      fetchFn
    });

    const result = await recognize(context);

    expect(result?.decision.state).toBe('high');
    expect(result?.ratings[0]).toEqual({ source: 'TMDB', value: 8.4, scale: 10, voteCount: 6200 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchFn.mock.calls) {
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
    }
  });

  it('does not request details for a hidden match', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      results: [{ id: 1, media_type: 'movie', title: 'Completely Different Film' }]
    }), { status: 200 }));

    const recognize = createProxyRecognitionOrchestrator({
      tmdbProxyBaseUrl: 'https://proxy.example/api/tmdb',
      fetchFn
    });

    const result = await recognize(context);

    expect(result?.decision.state).toBe('hidden');
    expect(result?.ratings).toEqual([]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { scoreCandidate } from '../../src/core/candidate-scorer';
import type { YouTubeVideoContext } from '../../src/core/types';
import {
  TmdbCatalogProvider,
  TmdbProviderError
} from '../../src/providers/tmdb/tmdb-catalog-provider';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer 3 (2024)',
  description: '',
  channelName: 'Warner Bros. Pictures',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=abc123'
};

describe('TmdbCatalogProvider', () => {
  it('maps valid movie and TV results into CatalogCandidate values compatible with scorer', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      results: [
        {
          id: 693134,
          media_type: 'movie',
          title: 'Dune: Part Two',
          original_title: 'Dune: Part Two',
          release_date: '2024-02-27'
        },
        {
          id: 94997,
          media_type: 'tv',
          name: 'House of the Dragon',
          original_name: 'House of the Dragon',
          first_air_date: '2022-08-21'
        }
      ]
    }), { status: 200 }));

    const provider = new TmdbCatalogProvider({
      accessToken: 'test-token',
      fetchFn
    });

    const candidates = await provider.search('dune part two 2024');

    expect(candidates).toEqual([
      {
        providerId: '693134',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        originalTitle: 'Dune: Part Two',
        releaseYear: 2024
      },
      {
        providerId: '94997',
        mediaType: 'tv',
        title: 'House of the Dragon',
        originalTitle: 'House of the Dragon',
        releaseYear: 2022
      }
    ]);
    expect(scoreCandidate(context, candidates[0]!).confidence).toBeGreaterThanOrEqual(0.9);

    expect(fetchFn).toHaveBeenCalledOnce();
    const firstCall = fetchFn.mock.calls[0]!;
    const url = firstCall[0];
    const init = firstCall[1];
    expect(String(url)).toContain('/search/multi?');
    expect(String(url)).toContain('query=dune+part+two+2024');
    expect(init).toMatchObject({
      headers: { Authorization: 'Bearer test-token' }
    });
  });

  it('throws a normalized provider error for non-2xx HTTP responses', async () => {
    const provider = new TmdbCatalogProvider({
      accessToken: 'test-token',
      fetchFn: vi.fn(async () => new Response('{"status_message":"Too many requests"}', { status: 429 }))
    });

    await expect(provider.search('dune')).rejects.toEqual(
      expect.objectContaining<TmdbProviderError>({
        name: 'TmdbProviderError',
        code: 'http_error',
        status: 429
      })
    );
  });

  it('throws invalid_json when TMDB returns malformed JSON', async () => {
    const provider = new TmdbCatalogProvider({
      accessToken: 'test-token',
      fetchFn: vi.fn(async () => new Response('{not-json', { status: 200 }))
    });

    await expect(provider.search('dune')).rejects.toEqual(
      expect.objectContaining<TmdbProviderError>({
        name: 'TmdbProviderError',
        code: 'invalid_json'
      })
    );
  });

  it('throws invalid_response when the JSON response has no results array', async () => {
    const provider = new TmdbCatalogProvider({
      accessToken: 'test-token',
      fetchFn: vi.fn(async () => new Response(JSON.stringify({ page: 1 }), { status: 200 }))
    });

    await expect(provider.search('dune')).rejects.toEqual(
      expect.objectContaining<TmdbProviderError>({
        name: 'TmdbProviderError',
        code: 'invalid_response'
      })
    );
  });

  it('skips malformed and unsupported result items without failing valid candidates', async () => {
    const provider = new TmdbCatalogProvider({
      accessToken: 'test-token',
      fetchFn: vi.fn(async () => new Response(JSON.stringify({
        results: [
          { id: 1, media_type: 'person', name: 'Actor' },
          { id: 'bad', media_type: 'movie', title: 'Broken' },
          { id: 2, media_type: 'movie', title: '', release_date: '2024-01-01' },
          { id: 3, media_type: 'movie', title: 'Valid Movie', release_date: '' }
        ]
      }), { status: 200 }))
    });

    await expect(provider.search('valid movie')).resolves.toEqual([
      {
        providerId: '3',
        mediaType: 'movie',
        title: 'Valid Movie'
      }
    ]);
  });
});

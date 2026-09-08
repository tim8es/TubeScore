import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideoContext } from '../../src/core/types';
import {
  createRecognitionOrchestrator,
  InvalidRuntimeConfigError,
  loadRuntimeConfig,
  type RuntimeConfigStorage
} from '../../src/extension/recognition-orchestrator';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer 3 (2024)',
  description: 'Dune: Part Two official trailer',
  channelName: 'Warner Bros. Pictures',
  hashtags: ['DunePartTwo'],
  url: 'https://www.youtube.com/watch?v=abc123'
};

function responseJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('runtime TMDB configuration', () => {
  it('returns null when runtime config has not been provisioned', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({}))
    };

    await expect(loadRuntimeConfig(storage)).resolves.toBeNull();
  });

  it('rejects malformed runtime config without attempting recognition', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({ tubescoreRuntimeConfig: { tmdbAccessToken: '   ' } }))
    };

    await expect(loadRuntimeConfig(storage)).rejects.toBeInstanceOf(InvalidRuntimeConfigError);
  });
});

describe('service-worker recognition orchestrator', () => {
  it('runs config -> TMDB search -> scorer -> decision -> TMDB rating', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({
        tubescoreRuntimeConfig: { tmdbAccessToken: 'runtime-only-token' }
      }))
    };
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/multi')) {
        return responseJson({
          results: [
            {
              id: 693134,
              media_type: 'movie',
              title: 'Dune: Part Two',
              original_title: 'Dune: Part Two',
              release_date: '2024-02-27'
            }
          ]
        });
      }
      if (url.includes('/movie/693134')) {
        return responseJson({ vote_average: 8.1, vote_count: 6400 });
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const recognize = createRecognitionOrchestrator({ storage, fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate).toMatchObject({
      providerId: '693134',
      mediaType: 'movie',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });
    expect(result?.ratings).toEqual([
      { source: 'TMDB', value: 8.1, scale: 10, voteCount: 6400 }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns null when runtime config is missing', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({}))
    };
    const fetchFn = vi.fn();
    const recognize = createRecognitionOrchestrator({ storage, fetchFn });

    await expect(recognize(context)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns null when no catalog candidates are returned', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({
        tubescoreRuntimeConfig: { tmdbAccessToken: 'runtime-only-token' }
      }))
    };
    const fetchFn = vi.fn(async () => responseJson({ results: [] }));
    const recognize = createRecognitionOrchestrator({ storage, fetchFn });

    await expect(recognize(context)).resolves.toBeNull();
  });

  it('propagates catalog provider failures for the message boundary to normalize', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({
        tubescoreRuntimeConfig: { tmdbAccessToken: 'runtime-only-token' }
      }))
    };
    const fetchFn = vi.fn(async () => responseJson({ status_message: 'rate limited' }, 429));
    const recognize = createRecognitionOrchestrator({ storage, fetchFn });

    await expect(recognize(context)).rejects.toMatchObject({ code: 'http_error', status: 429 });
  });

  it('propagates invalid rating responses instead of rendering fabricated data', async () => {
    const storage: RuntimeConfigStorage = {
      get: vi.fn(async () => ({
        tubescoreRuntimeConfig: { tmdbAccessToken: 'runtime-only-token' }
      }))
    };
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/multi')) {
        return responseJson({
          results: [{
            id: 693134,
            media_type: 'movie',
            title: 'Dune: Part Two',
            release_date: '2024-02-27'
          }]
        });
      }
      return responseJson({ vote_average: 'not-a-number', vote_count: 6400 });
    });
    const recognize = createRecognitionOrchestrator({ storage, fetchFn });

    await expect(recognize(context)).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

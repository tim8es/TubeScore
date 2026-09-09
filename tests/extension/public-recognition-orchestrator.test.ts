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

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('zero-config production recognition orchestrator', () => {
  it('recognizes and rates through Wikidata without runtime config or credentials', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');
      if (action === 'wbsearchentities') {
        return jsonResponse({
          search: [{ id: 'Q109228991', label: 'Dune: Part Two', description: '2024 film directed by Denis Villeneuve' }]
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q109228991') {
        return jsonResponse({
          entities: {
            Q109228991: {
              id: 'Q109228991',
              claims: {
                P444: [{
                  rank: 'preferred',
                  mainsnak: { datavalue: { value: '79/100' } },
                  qualifiers: { P447: [{ datavalue: { value: { id: 'Q150248' } } }] }
                }]
              }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q150248') {
        return jsonResponse({
          entities: {
            Q150248: { id: 'Q150248', labels: { en: { language: 'en', value: 'Metacritic' } } }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate).toMatchObject({
      providerId: 'Q109228991',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });
    expect(result?.ratings).toEqual([{
      source: 'Metacritic via Wikidata',
      value: 79,
      scale: 100,
      url: 'https://www.wikidata.org/wiki/Q109228991'
    }]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchFn.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(headers.get('Api-User-Agent')).toContain('TubeScore/');
    }
  });

  it('does not load ratings when the catalog match is hidden', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      search: [{ id: 'Q1', label: 'Completely Different Film', description: '1900 film' }]
    }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('hidden');
    expect(result?.ratings).toEqual([]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('returns null when Wikidata search has no movie or TV candidates', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      search: [{ id: 'Q42', label: 'Douglas Adams', description: 'English author and humorist' }]
    }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    await expect(recognize(context)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

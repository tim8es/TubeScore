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
  it('uses exact Wikidata P1651 YouTube-ID lookup before title search', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action') ?? '';
      calls.push(`${action}:${url.searchParams.get('list') ?? ''}:${url.searchParams.get('ids') ?? ''}`);

      if (action === 'query' && url.searchParams.get('list') === 'search') {
        expect(url.searchParams.get('srsearch')).toBe('haswbstatement:P1651=abc123');
        return jsonResponse({ query: { search: [{ title: 'Q109228991' }] } });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q109228991' && url.searchParams.get('props') === 'labels|descriptions') {
        return jsonResponse({
          entities: {
            Q109228991: {
              labels: { en: { value: 'Dune: Part Two' } },
              descriptions: { en: { value: '2024 film directed by Denis Villeneuve' } }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q109228991') {
        return jsonResponse({ entities: { Q109228991: { claims: {} } } });
      }
      if (action === 'wbsearchentities') {
        throw new Error('title search must not run after a visible exact-ID match');
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(context);

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate.providerId).toBe('Q109228991');
    expect(calls[0]).toBe('query:search:');
    expect(fetchFn.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('action') === 'wbsearchentities')).toBe(false);
  });

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

  it('does not load ratings when all catalog matches remain hidden', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      search: [{ id: 'Q1', label: 'Completely Different Film', description: '1900 film' }]
    }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('hidden');
    expect(result?.ratings).toEqual([]);
    expect(fetchFn).toHaveBeenCalled();
    for (const [input] of fetchFn.mock.calls) {
      const url = new URL(String(input));
      expect(url.searchParams.get('action')).toBe('wbsearchentities');
    }
  });

  it('returns null when Wikidata search has no movie or TV candidates', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      search: [{ id: 'Q42', label: 'Douglas Adams', description: 'English author and humorist' }]
    }));

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    await expect(recognize(context)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalled();
    for (const [input] of fetchFn.mock.calls) {
      const url = new URL(String(input));
      expect(url.searchParams.get('action')).toBe('wbsearchentities');
    }
  });
});

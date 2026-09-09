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

function exactIdMiss(): Response {
  return jsonResponse({ query: { search: [] } });
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

  it('treats an exact P1651 match as authoritative when the YouTube marketing title is longer than the canonical film title', async () => {
    const f1Context: YouTubeVideoContext = {
      videoId: '8yh9BPUBbbQ',
      title: 'F1® The Movie | Main Trailer',
      description: 'F1® The Movie, directed by Joseph Kosinski and starring Brad Pitt.',
      channelName: 'Warner Bros. Pictures',
      hashtags: ['F1TheMovie'],
      url: 'https://www.youtube.com/watch?v=8yh9BPUBbbQ'
    };

    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');

      if (action === 'query' && url.searchParams.get('list') === 'search') {
        expect(url.searchParams.get('srsearch')).toBe('haswbstatement:P1651=8yh9BPUBbbQ');
        return jsonResponse({ query: { search: [{ title: 'Q114246242' }] } });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q114246242' && url.searchParams.get('props') === 'labels|descriptions') {
        return jsonResponse({
          entities: {
            Q114246242: {
              labels: { en: { value: 'F1' } },
              descriptions: { en: { value: '2025 film directed by Joseph Kosinski' } }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q114246242') {
        return jsonResponse({ entities: { Q114246242: { claims: {} } } });
      }
      if (action === 'wbsearchentities') {
        throw new Error('title search must not veto an exact P1651 match');
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(f1Context);

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate).toMatchObject({
      providerId: 'Q114246242',
      title: 'F1',
      releaseYear: 2025
    });
    expect(result?.decision.score.reasons).toContain('youtube-video-id-match');
    expect(fetchFn.mock.calls.some(([input]) => new URL(String(input)).searchParams.get('action') === 'wbsearchentities')).toBe(false);
  });

  it('recognizes and returns multiple Wikidata ratings without runtime config or credentials', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');
      if (action === 'query') return exactIdMiss();
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
                P444: [
                  {
                    rank: 'preferred',
                    mainsnak: { datavalue: { value: '79/100' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q101' } } }] }
                  },
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '92%' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q102' } } }] }
                  },
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '8.4/10' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q103' } } }] }
                  }
                ]
              }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q101|Q102|Q103') {
        return jsonResponse({
          entities: {
            Q101: { labels: { en: { value: 'Metacritic' } } },
            Q102: { labels: { en: { value: 'Rotten Tomatoes' } } },
            Q103: { labels: { en: { value: 'Internet Movie Database' } } }
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
    expect(result?.ratings).toEqual([
      {
        source: 'IMDb via Wikidata',
        value: 8.4,
        scale: 10,
        url: 'https://www.wikidata.org/wiki/Q109228991'
      },
      {
        source: 'Rotten Tomatoes via Wikidata',
        value: 92,
        scale: 100,
        url: 'https://www.wikidata.org/wiki/Q109228991'
      },
      {
        source: 'Metacritic via Wikidata',
        value: 79,
        scale: 100,
        url: 'https://www.wikidata.org/wiki/Q109228991'
      }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    for (const [, init] of fetchFn.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.has('authorization')).toBe(false);
      expect(headers.get('Api-User-Agent')).toContain('TubeScore/');
    }
  });

  it('does not load ratings when all catalog matches remain hidden', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'query') return exactIdMiss();
      return jsonResponse({
        search: [{ id: 'Q1', label: 'Completely Different Film', description: '1900 film' }]
      });
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    const result = await recognize(context);

    expect(result?.decision.state).toBe('hidden');
    expect(result?.ratings).toEqual([]);
    expect(fetchFn).toHaveBeenCalled();
    const actions = fetchFn.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('action'));
    expect(actions[0]).toBe('query');
    expect(actions.slice(1).every((action) => action === 'wbsearchentities')).toBe(true);
  });

  it('returns null when Wikidata search has no movie or TV candidates', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'query') return exactIdMiss();
      return jsonResponse({
        search: [{ id: 'Q42', label: 'Douglas Adams', description: 'English author and humorist' }]
      });
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn });
    await expect(recognize(context)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalled();
    const actions = fetchFn.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('action'));
    expect(actions[0]).toBe('query');
    expect(actions.slice(1).every((action) => action === 'wbsearchentities')).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  WikidataPublicCatalogProvider,
  WikidataPublicRatingsProvider
} from '../../src/providers/wikidata/wikidata-public-provider';

const apiBaseUrl = 'https://www.wikidata.org/w/api.php';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Wikidata public providers', () => {
  it('searches movie and TV entities without credentials and identifies the client', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      search: [
        { id: 'Q109228991', label: 'Dune: Part Two', description: '2024 film directed by Denis Villeneuve' },
        { id: 'Q23572', label: 'Game of Thrones', description: 'American fantasy drama television series' },
        { id: 'Q42', label: 'Douglas Adams', description: 'English author and humorist' }
      ]
    }));

    const provider = new WikidataPublicCatalogProvider({ fetchFn, apiBaseUrl });
    const result = await provider.search('Dune Part Two');

    expect(result).toEqual([
      {
        providerId: 'Q109228991',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        releaseYear: 2024
      },
      {
        providerId: 'Q23572',
        mediaType: 'tv',
        title: 'Game of Thrones'
      }
    ]);

    const [input, init] = fetchFn.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe(apiBaseUrl);
    expect(url.searchParams.get('action')).toBe('wbsearchentities');
    expect(url.searchParams.get('search')).toBe('Dune Part Two');
    expect(url.searchParams.get('language')).toBe('en');
    const headers = new Headers(init?.headers);
    expect(headers.get('Api-User-Agent')).toContain('TubeScore/');
    expect(headers.has('authorization')).toBe(false);
  });

  it('loads a numeric review score and preserves issuer provenance via Wikidata', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get('ids');
      if (ids === 'Q109228991') {
        return jsonResponse({
          entities: {
            Q109228991: {
              id: 'Q109228991',
              claims: {
                P444: [
                  {
                    rank: 'preferred',
                    mainsnak: { datavalue: { value: '79/100' } },
                    qualifiers: {
                      P447: [{ datavalue: { value: { id: 'Q150248' } } }]
                    }
                  },
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '92%' } },
                    qualifiers: {}
                  }
                ]
              }
            }
          }
        });
      }
      if (ids === 'Q150248') {
        return jsonResponse({
          entities: {
            Q150248: {
              id: 'Q150248',
              labels: { en: { language: 'en', value: 'Metacritic' } }
            }
          }
        });
      }
      throw new Error(`unexpected_ids:${ids}`);
    });

    const provider = new WikidataPublicRatingsProvider({ fetchFn, apiBaseUrl });
    const result = await provider.getRating({
      providerId: 'Q109228991',
      mediaType: 'movie',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });

    expect(result).toEqual({
      source: 'Metacritic via Wikidata',
      value: 79,
      scale: 100,
      url: 'https://www.wikidata.org/wiki/Q109228991'
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns multiple issuer ratings in product priority order with one label batch', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get('ids');
      if (ids === 'Q109228991') {
        return jsonResponse({
          entities: {
            Q109228991: {
              id: 'Q109228991',
              claims: {
                P345: [
                  { rank: 'normal', mainsnak: { datavalue: { value: 'tt0000000' } } },
                  { rank: 'preferred', mainsnak: { datavalue: { value: 'tt15239678' } } }
                ],
                P1258: [{ rank: 'normal', mainsnak: { datavalue: { value: 'm/dune_part_two' } } }],
                P1712: [{ rank: 'normal', mainsnak: { datavalue: { value: 'movie/dune-part-two' } } }],
                P2603: [{ rank: 'normal', mainsnak: { datavalue: { value: '1234567' } } }],
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
                  },
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '8.6/10' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q104' } } }] }
                  },
                  {
                    rank: 'deprecated',
                    mainsnak: { datavalue: { value: '70%' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q102' } } }] }
                  }
                ]
              }
            }
          }
        });
      }
      if (ids === 'Q101|Q102|Q103|Q104') {
        return jsonResponse({
          entities: {
            Q101: { labels: { en: { value: 'Metacritic' } } },
            Q102: { labels: { en: { value: 'Rotten Tomatoes' } } },
            Q103: { labels: { en: { value: 'Internet Movie Database' } } },
            Q104: { labels: { en: { value: 'Kinopoisk' } } }
          }
        });
      }
      throw new Error(`unexpected_ids:${ids}`);
    });

    const provider = new WikidataPublicRatingsProvider({ fetchFn, apiBaseUrl });
    const result = await provider.getRatings({
      providerId: 'Q109228991',
      mediaType: 'movie',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });

    expect(result).toEqual([
      { source: 'Kinopoisk via Wikidata', value: 8.6, scale: 10, url: 'https://www.kinopoisk.ru/film/1234567/' },
      { source: 'IMDb via Wikidata', value: 8.4, scale: 10, url: 'https://www.imdb.com/title/tt15239678/' },
      { source: 'Rotten Tomatoes via Wikidata', value: 92, scale: 100, url: 'https://www.rottentomatoes.com/m/dune_part_two' },
      { source: 'Metacritic via Wikidata', value: 79, scale: 100, url: 'https://www.metacritic.com/movie/dune-part-two' }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('accepts percent and decimal-over-ten score formats', async () => {
    const responses = [
      { score: '92%', expected: { value: 92, scale: 100 } },
      { score: '8.4/10', expected: { value: 8.4, scale: 10 } }
    ];

    for (const { score, expected } of responses) {
      const fetchFn = vi.fn(async () => jsonResponse({
        entities: {
          Q1: {
            id: 'Q1',
            claims: {
              P444: [{ rank: 'normal', mainsnak: { datavalue: { value: score } }, qualifiers: {} }]
            }
          }
        }
      }));
      const provider = new WikidataPublicRatingsProvider({ fetchFn, apiBaseUrl });
      const result = await provider.getRating({ providerId: 'Q1', mediaType: 'movie', title: 'Example' });
      expect(result).toMatchObject({ source: 'Wikidata', ...expected });
    }
  });

  it('fails safely when no usable review score exists', async () => {
    const provider = new WikidataPublicRatingsProvider({
      apiBaseUrl,
      fetchFn: async () => jsonResponse({
        entities: {
          Q1: { id: 'Q1', claims: { P444: [{ mainsnak: { datavalue: { value: 'A+' } } }] } }
        }
      })
    });

    await expect(provider.getRating({ providerId: 'Q1', mediaType: 'movie', title: 'Example' }))
      .rejects.toMatchObject({ code: 'rating_unavailable' });
  });

  it('normalizes API HTTP failures and rejects invalid entity ids before network access', async () => {
    const httpProvider = new WikidataPublicCatalogProvider({
      apiBaseUrl,
      fetchFn: async () => new Response('blocked', { status: 503 })
    });
    await expect(httpProvider.search('Dune')).rejects.toMatchObject({ code: 'http_error', status: 503 });

    const fetchFn = vi.fn();
    const ratingsProvider = new WikidataPublicRatingsProvider({ fetchFn, apiBaseUrl });
    await expect(ratingsProvider.getRating({ providerId: '../bad', mediaType: 'movie', title: 'Bad' }))
      .rejects.toMatchObject({ code: 'invalid_candidate' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
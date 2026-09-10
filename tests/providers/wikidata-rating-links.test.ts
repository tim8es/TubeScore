import { describe, expect, it, vi } from 'vitest';
import { WikidataLinkedRatingsProvider } from '../../src/providers/wikidata/wikidata-linked-ratings-provider';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Wikidata rating platform links', () => {
  it('builds direct title URLs from external IDs already present in the movie claims', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get('ids');

      if (ids === 'Q1') {
        return jsonResponse({
          entities: {
            Q1: {
              id: 'Q1',
              claims: {
                P345: [{ mainsnak: { datavalue: { value: 'tt15239678' } } }],
                P1258: [{ mainsnak: { datavalue: { value: 'm/dune_part_two' } } }],
                P1712: [{ mainsnak: { datavalue: { value: 'movie/dune-part-two' } } }],
                P2603: [{ mainsnak: { datavalue: { value: '4540126' } } }],
                P444: [
                  { mainsnak: { datavalue: { value: '8.4/10' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q37312' } } }] } },
                  { mainsnak: { datavalue: { value: '92%' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q105584' } } }] } },
                  { mainsnak: { datavalue: { value: '79/100' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q150248' } } }] } },
                  { mainsnak: { datavalue: { value: '8.6/10' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q2389071' } } }] } }
                ]
              }
            }
          }
        });
      }

      if (ids === 'Q37312|Q105584|Q150248|Q2389071') {
        return jsonResponse({
          entities: {
            Q37312: { labels: { en: { value: 'Internet Movie Database' } } },
            Q105584: { labels: { en: { value: 'Rotten Tomatoes' } } },
            Q150248: { labels: { en: { value: 'Metacritic' } } },
            Q2389071: { labels: { en: { value: 'Kinopoisk' } } }
          }
        });
      }

      throw new Error(`unexpected_ids:${ids}`);
    });

    const provider = new WikidataLinkedRatingsProvider({
      fetchFn,
      apiBaseUrl: 'https://www.wikidata.org/w/api.php'
    });
    const ratings = await provider.getRatings({ providerId: 'Q1', mediaType: 'movie', title: 'Dune: Part Two' });

    expect(Object.fromEntries(ratings.map((rating) => [rating.source, rating.url]))).toEqual({
      'Kinopoisk via Wikidata': 'https://www.kinopoisk.ru/film/4540126/',
      'IMDb via Wikidata': 'https://www.imdb.com/title/tt15239678/',
      'Rotten Tomatoes via Wikidata': 'https://www.rottentomatoes.com/m/dune_part_two',
      'Metacritic via Wikidata': 'https://www.metacritic.com/movie/dune-part-two'
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { CatalogCandidate } from '../../src/core/types';
import {
  WikidataApiClient,
  WikidataPublicRatingsProvider
} from '../../src/providers/wikidata/wikidata-public-provider';
import { enrichWikidataRatingUrls } from '../../src/providers/wikidata/wikidata-platform-links';

const candidate: CatalogCandidate = {
  providerId: 'Q48252',
  mediaType: 'movie',
  title: 'Everything Everywhere All at Once',
  releaseYear: 2022
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Wikidata direct platform destinations', () => {
  it('builds exact service URLs for additional rating issuers when Wikidata exposes their external IDs', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const ids = url.searchParams.get('ids');
      const props = url.searchParams.get('props');

      if (ids === 'Q48252' && props === 'claims') {
        return jsonResponse({
          entities: {
            Q48252: {
              claims: {
                P444: [
                  { mainsnak: { datavalue: { value: '4.4/5' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q18709181' } } }] } },
                  { mainsnak: { datavalue: { value: '7.6/10' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q1028704' } } }] } },
                  { mainsnak: { datavalue: { value: '6.8/10' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q477809' } } }] } },
                  { mainsnak: { datavalue: { value: '7.9/10' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q2638147' } } }] } },
                  { mainsnak: { datavalue: { value: '80%' } }, qualifiers: { P447: [{ datavalue: { value: { id: 'Q84591894' } } }] } }
                ],
                P6127: [{ mainsnak: { datavalue: { value: 'everything-everywhere-all-at-once' } } }],
                P4529: [{ mainsnak: { datavalue: { value: '30314848' } } }],
                P1562: [{ mainsnak: { datavalue: { value: 'v727042' } } }],
                P480: [{ mainsnak: { datavalue: { value: '689708' } } }],
                P8013: [{ mainsnak: { datavalue: { value: 'movies/everything-everywhere-all-at-once-2022' } } }]
              }
            }
          }
        });
      }
      if (ids === 'Q18709181|Q1028704|Q477809|Q2638147|Q84591894' && props === 'labels') {
        return jsonResponse({
          entities: {
            Q18709181: { labels: { en: { value: 'Letterboxd' } } },
            Q1028704: { labels: { en: { value: 'Douban' } } },
            Q477809: { labels: { en: { value: 'AllMovie' } } },
            Q2638147: { labels: { en: { value: 'FilmAffinity' } } },
            Q84591894: { labels: { en: { value: 'Trakt.tv' } } }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const client = new WikidataApiClient({ fetchFn });
    const provider = new WikidataPublicRatingsProvider({ client });
    const baseRatings = await provider.getRatings(candidate);
    const ratings = await enrichWikidataRatingUrls(candidate, baseRatings, client);

    expect(Object.fromEntries(ratings.map((rating) => [rating.source.replace(' via Wikidata', ''), rating.url]))).toMatchObject({
      Letterboxd: 'https://letterboxd.com/film/everything-everywhere-all-at-once/',
      Douban: 'https://movie.douban.com/subject/30314848/',
      AllMovie: 'https://www.allmovie.com/movie/-v727042',
      FilmAffinity: 'https://www.filmaffinity.com/en/film689708.html',
      'Trakt.tv': 'https://trakt.tv/movies/everything-everywhere-all-at-once-2022'
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

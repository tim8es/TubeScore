import { describe, expect, it, vi } from 'vitest';
import { WikidataPublicCatalogProvider } from '../../src/providers/wikidata/wikidata-public-provider';

const apiBaseUrl = 'https://www.wikidata.org/w/api.php';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Wikidata YouTube video ID catalog lookup', () => {
  it('resolves an exact P1651 YouTube video ID into a movie candidate', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'query') {
        expect(url.searchParams.get('list')).toBe('search');
        expect(url.searchParams.get('srsearch')).toBe('haswbstatement:P1651=AMLCbpM1fRQ');
        return jsonResponse({
          query: {
            search: [{ title: 'Q131451703' }]
          }
        });
      }
      if (url.searchParams.get('action') === 'wbgetentities') {
        expect(url.searchParams.get('ids')).toBe('Q131451703');
        return jsonResponse({
          entities: {
            Q131451703: {
              id: 'Q131451703',
              labels: { en: { language: 'en', value: 'Onslaught' } },
              descriptions: { en: { language: 'en', value: '2026 film directed by Adam Wingard' } }
            }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const provider = new WikidataPublicCatalogProvider({ fetchFn, apiBaseUrl });
    const result = await provider.searchByYouTubeVideoId('AMLCbpM1fRQ');

    expect(result).toEqual([{
      providerId: 'Q131451703',
      mediaType: 'movie',
      title: 'Onslaught',
      releaseYear: 2026
    }]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns no candidates without entity loading when P1651 has no hits', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ query: { search: [] } }));
    const provider = new WikidataPublicCatalogProvider({ fetchFn, apiBaseUrl });

    await expect(provider.searchByYouTubeVideoId('abcdefghijk')).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

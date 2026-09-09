import { describe, expect, it, vi } from 'vitest';
import {
  ImdbPublicCatalogProvider,
  ImdbPublicRatingsProvider
} from '../../src/providers/imdb/imdb-public-provider';

const suggestionBaseUrl = 'https://v3.sg.media-imdb.com/suggestion/x';
const titleBaseUrl = 'https://www.imdb.com/title';

describe('IMDb public providers', () => {
  it('searches titles through the public suggestion endpoint without credentials', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      d: [
        { id: 'tt15239678', l: 'Dune: Part Two', y: 2024, qid: 'movie' },
        { id: 'tt0944947', l: 'Game of Thrones', y: 2011, qid: 'tvSeries' },
        { id: 'nm0000001', l: 'A Person', qid: 'name' },
        { id: 'tt1234567', l: 'Some Game', y: 2025, qid: 'videoGame' }
      ]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const provider = new ImdbPublicCatalogProvider({ fetchFn, suggestionBaseUrl });
    const result = await provider.search('Dune Part Two');

    expect(result).toEqual([
      {
        providerId: 'tt15239678',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        releaseYear: 2024
      },
      {
        providerId: 'tt0944947',
        mediaType: 'tv',
        title: 'Game of Thrones',
        releaseYear: 2011
      }
    ]);

    const [input, init] = fetchFn.mock.calls[0]!;
    expect(String(input)).toContain('/suggestion/x/Dune%20Part%20Two.json');
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });

  it('skips malformed or unsupported suggestion entries', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      d: [
        null,
        {},
        { id: 'tt1', l: '' },
        { id: 'tt2', l: 'Episode', qid: 'tvEpisode' },
        { id: 'tt3', l: 'Podcast', qid: 'podcastSeries' }
      ]
    }), { status: 200 }));

    const provider = new ImdbPublicCatalogProvider({ fetchFn, suggestionBaseUrl });
    await expect(provider.search('anything')).resolves.toEqual([]);
  });

  it('normalizes suggestion HTTP and JSON failures', async () => {
    const httpProvider = new ImdbPublicCatalogProvider({
      suggestionBaseUrl,
      fetchFn: async () => new Response('blocked', { status: 503 })
    });
    await expect(httpProvider.search('Dune')).rejects.toMatchObject({
      code: 'http_error',
      status: 503
    });

    const jsonProvider = new ImdbPublicCatalogProvider({
      suggestionBaseUrl,
      fetchFn: async () => new Response('{bad-json', { status: 200 })
    });
    await expect(jsonProvider.search('Dune')).rejects.toMatchObject({
      code: 'invalid_json'
    });
  });

  it('extracts aggregate rating from IMDb title JSON-LD without credentials', async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Movie",
        "name":"Dune: Part Two",
        "aggregateRating":{
          "@type":"AggregateRating",
          "ratingValue":8.5,
          "ratingCount":650123
        }
      }</script>
    </head></html>`;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(html, { status: 200 }));

    const provider = new ImdbPublicRatingsProvider({ fetchFn, titleBaseUrl });
    const rating = await provider.getRating({
      providerId: 'tt15239678',
      mediaType: 'movie',
      title: 'Dune: Part Two',
      releaseYear: 2024
    });

    expect(rating).toEqual({
      source: 'IMDb',
      value: 8.5,
      scale: 10,
      voteCount: 650123,
      url: 'https://www.imdb.com/title/tt15239678/'
    });

    const [input, init] = fetchFn.mock.calls[0]!;
    expect(String(input)).toBe('https://www.imdb.com/title/tt15239678/');
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });

  it('fails safely when an IMDb page has no usable aggregate rating', async () => {
    const provider = new ImdbPublicRatingsProvider({
      titleBaseUrl,
      fetchFn: async () => new Response('<html><body>No rating yet</body></html>', { status: 200 })
    });

    await expect(provider.getRating({
      providerId: 'tt15239678',
      mediaType: 'movie',
      title: 'Dune: Part Two'
    })).rejects.toMatchObject({
      code: 'rating_unavailable'
    });
  });

  it('rejects invalid IMDb title ids before network access', async () => {
    const fetchFn = vi.fn();
    const provider = new ImdbPublicRatingsProvider({ fetchFn, titleBaseUrl });

    await expect(provider.getRating({
      providerId: '../etc/passwd',
      mediaType: 'movie',
      title: 'Bad'
    })).rejects.toMatchObject({
      code: 'invalid_candidate'
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { buildSearchQueries } from '../src/core/query-builder';
import { scoreCandidate } from '../src/core/candidate-scorer';
import type { CatalogCandidate, YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';
import { renderRatingCard } from '../src/ui/rating-card';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function exactIdMiss(): Response {
  return jsonResponse({ query: { search: [] } });
}

const onslaught: YouTubeVideoContext = {
  videoId: 'AMLCbpM1fRQ',
  title: 'Onslaught | Official Trailer 2 HD | A24',
  description: 'Onslaught is in theaters September 4, 2026.',
  channelName: 'A24',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=AMLCbpM1fRQ'
};

const odyssey: YouTubeVideoContext = {
  videoId: 'Mzw2ttJD2qQ',
  title: 'The Odyssey | Official Trailer',
  description: 'The Odyssey - In Theaters July 17, 2026. A film by Christopher Nolan.',
  channelName: 'Universal Pictures',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=Mzw2ttJD2qQ'
};

describe('manual YouTube regression cases', () => {
  it('builds a studio-free primary query for the Onslaught A24 trailer', () => {
    expect(buildSearchQueries(onslaught)[0]).toBe('onslaught');
  });

  it('uses description year to disambiguate identical The Odyssey titles', () => {
    const current: CatalogCandidate = {
      providerId: 'Q2026',
      mediaType: 'movie',
      title: 'The Odyssey',
      releaseYear: 2026
    };
    const older: CatalogCandidate = {
      providerId: 'Q1997',
      mediaType: 'movie',
      title: 'The Odyssey',
      releaseYear: 1997
    };

    const currentScore = scoreCandidate(odyssey, current);
    const olderScore = scoreCandidate(odyssey, older);

    expect(currentScore.confidence).toBeGreaterThanOrEqual(0.9);
    expect(currentScore.reasons).toContain('year-match');
    expect(olderScore.confidence).toBeLessThan(0.75);
    expect(olderScore.reasons).toContain('year-mismatch');
  });

  it('recognizes the real Onslaught title despite the trailing A24 segment', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');
      if (action === 'query') return exactIdMiss();
      if (action === 'wbsearchentities') {
        const query = url.searchParams.get('search');
        return jsonResponse({
          search: query === 'onslaught'
            ? [{ id: 'Q200', label: 'Onslaught', description: '2026 film directed by Adam Wingard' }]
            : []
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q200') {
        return jsonResponse({
          entities: {
            Q200: {
              id: 'Q200',
              claims: {
                P444: [{ rank: 'preferred', mainsnak: { datavalue: { value: '72/100' } } }]
              }
            }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(onslaught);

    expect(result?.decision.state).not.toBe('hidden');
    expect(result?.decision.score.candidate.title).toBe('Onslaught');
    expect(result?.ratings[0]).toMatchObject({ value: 72, scale: 100 });
  });

  it('tries later search queries when the first Wikidata query has no film candidates', async () => {
    const context: YouTubeVideoContext = {
      videoId: 'fallback',
      title: 'Dune: Part Two | Official Trailer',
      description: 'Dune: Part Two opens in 2024.',
      channelName: 'Warner Bros. Pictures',
      hashtags: [],
      url: 'https://www.youtube.com/watch?v=fallback'
    };

    const seenQueries: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'query') return exactIdMiss();
      if (url.searchParams.get('action') === 'wbsearchentities') {
        const query = url.searchParams.get('search') ?? '';
        seenQueries.push(query);
        if (seenQueries.length === 1) {
          return jsonResponse({ search: [{ id: 'Q42', label: 'Douglas Adams', description: 'English author' }] });
        }
        return jsonResponse({
          search: [{ id: 'Q109228991', label: 'Dune: Part Two', description: '2024 film directed by Denis Villeneuve' }]
        });
      }
      if (url.searchParams.get('action') === 'wbgetentities') {
        return jsonResponse({
          entities: {
            Q109228991: {
              id: 'Q109228991',
              claims: { P444: [{ rank: 'preferred', mainsnak: { datavalue: { value: '79/100' } } }] }
            }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(context);

    expect(seenQueries.length).toBeGreaterThan(1);
    expect(result?.decision.score.candidate.providerId).toBe('Q109228991');
  });

  it('continues past a hidden older title when a later query finds the correct year', async () => {
    const seenQueries: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');
      if (action === 'query') return exactIdMiss();
      if (action === 'wbsearchentities') {
        const query = url.searchParams.get('search') ?? '';
        seenQueries.push(query);
        if (query === 'onslaught') {
          return jsonResponse({
            search: [{ id: 'Q100', label: 'Onslaught', description: '2016 film' }]
          });
        }
        if (query === 'onslaught 2026') {
          return jsonResponse({
            search: [{ id: 'Q200', label: 'Onslaught', description: '2026 film directed by Adam Wingard' }]
          });
        }
        return jsonResponse({ search: [] });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q200') {
        return jsonResponse({
          entities: {
            Q200: {
              id: 'Q200',
              claims: {
                P444: [{ rank: 'preferred', mainsnak: { datavalue: { value: '72/100' } } }]
              }
            }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(onslaught);

    expect(seenQueries).toContain('onslaught 2026');
    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate.providerId).toBe('Q200');
  });

  it('renders a recognized title with no P444 as an accessible dash rather than a provider error', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('action') === 'query') return exactIdMiss();
      if (url.searchParams.get('action') === 'wbsearchentities') {
        return jsonResponse({
          search: [{ id: 'Q300', label: 'The Odyssey', description: '2026 film directed by Christopher Nolan' }]
        });
      }
      if (url.searchParams.get('action') === 'wbgetentities') {
        return jsonResponse({ entities: { Q300: { id: 'Q300', claims: {} } } });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const result = await createPublicRecognitionOrchestrator({ fetchFn })(odyssey);

    expect(result).not.toBeNull();
    expect(result?.ratings).toEqual([]);
    const card = renderRatingCard(result!);
    const empty = card.querySelector('.tubescore-card__empty');
    expect(empty?.textContent).toBe('—');
    expect(empty?.getAttribute('aria-label')).toBe('No ratings available');
    expect(card.textContent).not.toContain('Unavailable');
  });
});

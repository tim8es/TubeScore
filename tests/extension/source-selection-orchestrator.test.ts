import { describe, expect, it, vi } from 'vitest';
import type { RecognitionResult, YouTubeVideoContext } from '../../src/core/types';
import { createPublicRecognitionOrchestrator } from '../../src/extension/public-recognition-orchestrator';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Everything Everywhere All at Once | Official Trailer (2022)',
  description: 'Official trailer',
  channelName: 'A24',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=abc123'
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

type RecognizeWithSources = (
  context: YouTubeVideoContext,
  options?: { enabledSources?: readonly string[] }
) => Promise<RecognitionResult | null>;

describe('production source filtering', () => {
  it('returns only ratings selected by the content script', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');

      if (action === 'query' && url.searchParams.get('list') === 'search') {
        return jsonResponse({ query: { search: [{ title: 'Q48252' }] } });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q48252' && url.searchParams.get('props') === 'labels|descriptions') {
        return jsonResponse({
          entities: {
            Q48252: {
              labels: { en: { value: 'Everything Everywhere All at Once' } },
              descriptions: { en: { value: '2022 film' } }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q48252' && url.searchParams.get('props') === 'claims') {
        return jsonResponse({
          entities: {
            Q48252: {
              claims: {
                P444: [
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '7.7/10' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q37312' } } }] }
                  },
                  {
                    rank: 'normal',
                    mainsnak: { datavalue: { value: '93%' } },
                    qualifiers: { P447: [{ datavalue: { value: { id: 'Q105584' } } }] }
                  }
                ]
              }
            }
          }
        });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q37312|Q105584') {
        return jsonResponse({
          entities: {
            Q37312: { labels: { en: { value: 'Internet Movie Database' } } },
            Q105584: { labels: { en: { value: 'Rotten Tomatoes' } } }
          }
        });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn }) as unknown as RecognizeWithSources;
    const result = await recognize(context, { enabledSources: ['IMDb'] });

    expect(result?.ratings.map((rating) => rating.source)).toEqual(['IMDb via Wikidata']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { scoreCandidate } from '../src/core/candidate-scorer';
import { normalizeYouTubeTitle } from '../src/core/normalize';
import { buildLocalizedSearchRequests } from '../src/core/query-builder';
import type { YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';
import { WikidataPublicCatalogProvider } from '../src/providers/wikidata/wikidata-public-provider';

const apiBaseUrl = 'https://www.wikidata.org/w/api.php';

function context(title: string, description = ''): YouTubeVideoContext {
  return {
    videoId: 'abc123',
    title,
    description,
    channelName: 'Example',
    hashtags: [],
    url: 'https://www.youtube.com/watch?v=abc123'
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('multilingual recognition', () => {
  it('removes localized trailer boilerplate without removing the localized title', () => {
    expect(normalizeYouTubeTitle('Паразиты — официальный русский трейлер (2019) 4K')).toBe('паразиты 2019');
    expect(normalizeYouTubeTitle('La sociedad de la nieve | Tráiler oficial')).toBe('la sociedad de la nieve');
    expect(normalizeYouTubeTitle('Oppenheimer | Offizieller Trailer')).toBe('oppenheimer');
    expect(normalizeYouTubeTitle('君たちはどう生きるか 予告')).toBe('君たちはどう生きるか');
    expect(normalizeYouTubeTitle('기생충 공식 예고편')).toBe('기생충');
  });

  it('builds localized Wikidata search requests with English fallback', () => {
    const russian = buildLocalizedSearchRequests(context('Паразиты — официальный русский трейлер (2019)'));
    expect(russian[0]).toEqual({ query: 'паразиты 2019', language: 'ru' });
    expect(russian.some((request) => request.language === 'en')).toBe(true);

    const spanish = buildLocalizedSearchRequests(context('La sociedad de la nieve | Tráiler oficial'));
    expect(spanish[0]).toEqual({ query: 'la sociedad de la nieve', language: 'es' });

    const japanese = buildLocalizedSearchRequests(context('君たちはどう生きるか 予告'));
    expect(japanese[0]).toEqual({ query: '君たちはどう生きるか', language: 'ja' });
  });

  it('scores a localized alias as a title match', () => {
    const score = scoreCandidate(context('Паразиты — официальный трейлер (2019)'), {
      providerId: 'Q61448040',
      mediaType: 'movie',
      title: 'Parasite',
      aliases: ['Паразиты', '기생충'],
      releaseYear: 2019
    });

    expect(score.confidence).toBeGreaterThanOrEqual(0.9);
    expect(score.reasons).toContain('title-match');
    expect(score.reasons).toContain('year-match');
  });

  it('searches Wikidata in a requested language and preserves aliases', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('language')).toBe('ru');
      return jsonResponse({
        search: [{
          id: 'Q61448040',
          label: 'Паразиты',
          description: 'южнокорейский фильм 2019 года',
          aliases: ['Паразит']
        }]
      });
    });

    const provider = new WikidataPublicCatalogProvider({ fetchFn, apiBaseUrl });
    await expect(provider.search('Паразиты', 'ru')).resolves.toEqual([{
      providerId: 'Q61448040',
      mediaType: 'movie',
      title: 'Паразиты',
      aliases: ['Паразит'],
      releaseYear: 2019
    }]);
  });

  it('recognizes a Russian trailer through localized Wikidata search after exact-ID miss', async () => {
    const searchLanguages: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get('action');

      if (action === 'query') {
        return jsonResponse({ query: { search: [] } });
      }
      if (action === 'wbsearchentities') {
        const language = url.searchParams.get('language') ?? '';
        searchLanguages.push(language);
        if (language === 'ru') {
          return jsonResponse({
            search: [{
              id: 'Q61448040',
              label: 'Паразиты',
              description: 'южнокорейский фильм 2019 года',
              aliases: ['Паразит']
            }]
          });
        }
        return jsonResponse({ search: [] });
      }
      if (action === 'wbgetentities' && url.searchParams.get('ids') === 'Q61448040') {
        return jsonResponse({ entities: { Q61448040: { claims: {} } } });
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const recognize = createPublicRecognitionOrchestrator({ fetchFn, apiBaseUrl });
    const result = await recognize(context('Паразиты — официальный русский трейлер (2019)'));

    expect(result?.decision.state).toBe('high');
    expect(result?.decision.score.candidate.providerId).toBe('Q61448040');
    expect(searchLanguages[0]).toBe('ru');
    expect(searchLanguages).toEqual(['ru']);
  });
});

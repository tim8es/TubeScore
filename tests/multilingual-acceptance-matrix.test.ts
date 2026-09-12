import { describe, expect, it, vi } from 'vitest';
import { inferWikidataSearchLanguages, buildLocalizedSearchRequests } from '../src/core/query-builder';
import { normalizeYouTubeTitle } from '../src/core/normalize';
import type { MediaType, YouTubeVideoContext } from '../src/core/types';
import { createPublicRecognitionOrchestrator } from '../src/extension/public-recognition-orchestrator';
import { WikidataMultilingualCatalogProvider } from '../src/providers/wikidata/wikidata-multilingual-catalog';

const apiBaseUrl = 'https://www.wikidata.org/w/api.php';

type LanguageCase = {
  language: string;
  title: string;
  canonicalTitle: string;
  year: number;
  description: string;
};

const MOVIE_CASES: readonly LanguageCase[] = [
  {
    language: 'en',
    title: 'Dune: Part Two Official Trailer (2024)',
    canonicalTitle: 'Dune: Part Two',
    year: 2024,
    description: '2024 American film'
  },
  {
    language: 'ru',
    title: 'Дюна: Часть вторая — официальный русский трейлер (2024)',
    canonicalTitle: 'Дюна: Часть вторая',
    year: 2024,
    description: 'американский фильм 2024 года'
  },
  {
    language: 'uk',
    title: 'Дюна: Частина друга — офіційний український трейлер (2024)',
    canonicalTitle: 'Дюна: Частина друга',
    year: 2024,
    description: 'американський фільм 2024 року'
  },
  {
    language: 'es',
    title: 'La sociedad de la nieve Tráiler oficial Latino (2023)',
    canonicalTitle: 'La sociedad de la nieve',
    year: 2023,
    description: 'película española de 2023'
  },
  {
    language: 'de',
    title: 'Im Westen nichts Neues Offizieller Trailer Deutsch (2022)',
    canonicalTitle: 'Im Westen nichts Neues',
    year: 2022,
    description: 'deutscher Film aus dem Jahr 2022'
  },
  {
    language: 'fr',
    title: "Anatomie d'une chute Bande-annonce officielle (2023)",
    canonicalTitle: "Anatomie d'une chute",
    year: 2023,
    description: 'film français de 2023'
  },
  {
    language: 'it',
    title: 'La grande bellezza Trailer ufficiale (2013)',
    canonicalTitle: 'La grande bellezza',
    year: 2013,
    description: 'film italiano del 2013'
  },
  {
    language: 'pt',
    title: 'Cidade de Deus Trailer Oficial Legendado (2002)',
    canonicalTitle: 'Cidade de Deus',
    year: 2002,
    description: 'filme brasileiro de 2002'
  },
  {
    language: 'pl',
    title: 'Zimna wojna Oficjalny zwiastun (2018)',
    canonicalTitle: 'Zimna wojna',
    year: 2018,
    description: 'polski film z 2018 roku'
  },
  {
    language: 'tr',
    title: 'Kış Uykusu Resmi Fragman (2014)',
    canonicalTitle: 'Kış Uykusu',
    year: 2014,
    description: '2014 yapımı Türk filmi'
  },
  {
    language: 'ja',
    title: '君たちはどう生きるか 公式予告 (2023)',
    canonicalTitle: '君たちはどう生きるか',
    year: 2023,
    description: '2023年の日本のアニメーション映画'
  },
  {
    language: 'ko',
    title: '기생충 공식 예고편 (2019)',
    canonicalTitle: '기생충',
    year: 2019,
    description: '2019년 대한민국의 영화'
  },
  {
    language: 'zh',
    title: '流浪地球 官方预告片 (2019)',
    canonicalTitle: '流浪地球',
    year: 2019,
    description: '2019年中国科幻电影'
  }
] as const;

const TV_DESCRIPTIONS: ReadonlyArray<{ language: string; description: string }> = [
  { language: 'en', description: 'American television series' },
  { language: 'ru', description: 'российский телесериал 2021 года' },
  { language: 'uk', description: 'український телесеріал 2021 року' },
  { language: 'es', description: 'serie de televisión española' },
  { language: 'de', description: 'deutsche Fernsehserie' },
  { language: 'fr', description: 'série télévisée française' },
  { language: 'it', description: 'serie televisiva italiana' },
  { language: 'pt', description: 'série de televisão brasileira' },
  { language: 'pl', description: 'polski serial telewizyjny' },
  { language: 'tr', description: 'Türk televizyon dizisi' },
  { language: 'ja', description: '日本のテレビドラマ' },
  { language: 'ko', description: '대한민국의 텔레비전 드라마' },
  { language: 'zh', description: '中国电视剧' }
];

function context(title: string): YouTubeVideoContext {
  return {
    videoId: 'acceptance-video',
    title,
    description: '',
    channelName: 'Acceptance Test',
    hashtags: [],
    url: 'https://www.youtube.com/watch?v=acceptance-video'
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function mediaSearchResponse(
  language: string,
  expectedLanguage: string,
  label: string,
  description: string,
  id: string
): unknown {
  if (language !== expectedLanguage) return { search: [] };
  return {
    search: [{ id, label, description, aliases: [] }]
  };
}

function qid(prefix: number, language: string, source: ReadonlyArray<{ language: string }>): string {
  const index = source.findIndex((entry) => entry.language === language);
  if (index < 0) throw new Error(`unknown_language:${language}`);
  return `Q${prefix + index}`;
}

describe('multilingual acceptance matrix', () => {
  it.each(MOVIE_CASES)(
    '$language routes a localized trailer to the intended Wikidata locale',
    ({ language, title }) => {
      const languages = inferWikidataSearchLanguages(title);
      expect(languages).toContain(language);
      expect(languages[0]).toBe(language);

      const requests = buildLocalizedSearchRequests(context(title));
      expect(requests.some((request) => request.language === language)).toBe(true);
    }
  );

  it.each(MOVIE_CASES)(
    '$language preserves the canonical title strongly enough for deterministic matching',
    ({ title, canonicalTitle }) => {
      const normalized = normalizeYouTubeTitle(title);
      const canonical = normalizeYouTubeTitle(canonicalTitle);
      expect(normalized).toContain(canonical);
    }
  );

  it.each(MOVIE_CASES)(
    '$language reaches a high-confidence recognition result after exact-ID miss',
    async ({ language, title, canonicalTitle, description }) => {
      const providerId = qid(900000, language, MOVIE_CASES);
      const searchedLanguages: string[] = [];
      const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const action = url.searchParams.get('action');

        if (action === 'query') {
          return jsonResponse({ query: { search: [] } });
        }

        if (action === 'wbsearchentities') {
          const requestedLanguage = url.searchParams.get('language') ?? '';
          searchedLanguages.push(requestedLanguage);
          return jsonResponse(mediaSearchResponse(
            requestedLanguage,
            language,
            canonicalTitle,
            description,
            providerId
          ));
        }

        if (action === 'wbgetentities' && url.searchParams.get('ids') === providerId) {
          return jsonResponse({ entities: { [providerId]: { claims: {} } } });
        }

        throw new Error(`unexpected_url:${url}`);
      });

      const recognize = createPublicRecognitionOrchestrator({ fetchFn, apiBaseUrl });
      const result = await recognize(context(title));

      expect(searchedLanguages).toContain(language);
      expect(result?.decision.state).toBe('high');
      expect(result?.decision.score.candidate.providerId).toBe(providerId);
    }
  );

  it.each(TV_DESCRIPTIONS)(
    '$language classifies localized TV descriptions as television content',
    async ({ language, description }) => {
      const provider = new WikidataMultilingualCatalogProvider({
        apiBaseUrl,
        fetchFn: vi.fn(async () => jsonResponse({
          search: [{
            id: qid(800000, language, TV_DESCRIPTIONS),
            label: `Series ${language}`,
            description
          }]
        }))
      });

      const candidates = await provider.search('Series', language);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.mediaType).toBe('tv' satisfies MediaType);
    }
  );

  it('keeps ambiguous generic Latin titles safe by searching multiple Latin locales', () => {
    const languages = inferWikidataSearchLanguages('Perfect Days');
    expect(languages).toEqual(['en', 'es', 'de', 'fr', 'it', 'pt', 'pl', 'tr']);
  });

  it('distinguishes the paired script/language ambiguity fallbacks', () => {
    expect(inferWikidataSearchLanguages('Мої думки тихі офіційний трейлер').slice(0, 3))
      .toEqual(['uk', 'ru', 'en']);
    expect(inferWikidataSearchLanguages('Паразиты официальный трейлер').slice(0, 3))
      .toEqual(['ru', 'uk', 'en']);
    expect(inferWikidataSearchLanguages('Cidade de Deus Trailer Oficial Legendado').slice(0, 2))
      .toEqual(['pt', 'en']);
    expect(inferWikidataSearchLanguages('La sociedad de la nieve Tráiler oficial').slice(0, 2))
      .toEqual(['es', 'en']);
    expect(inferWikidataSearchLanguages('君たちはどう生きるか 予告').slice(0, 2))
      .toEqual(['ja', 'zh']);
    expect(inferWikidataSearchLanguages('流浪地球 官方预告片').slice(0, 2))
      .toEqual(['zh', 'ja']);
  });
});

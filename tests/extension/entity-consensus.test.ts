import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideoContext } from '../../src/core/types';
import { createPublicRecognitionOrchestrator } from '../../src/extension/public-recognition-orchestrator';

type WrongTitleCase = {
  id: string;
  title: string;
  oldId: string;
  oldLabel: string;
  oldDescription: string;
  correctId: string;
  correctLabel: string;
  correctDescription: string;
};

type CorrectTitleOnlyCase = {
  id: string;
  title: string;
  providerId: string;
  label: string;
  description: string;
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function context(id: string, title: string): YouTubeVideoContext {
  return {
    videoId: `consensus_${id}`,
    title,
    description: '',
    channelName: 'Consensus regression',
    hashtags: [],
    url: `https://www.youtube.com/watch?v=consensus_${id}`
  };
}

function visible(state: string | undefined): boolean {
  return state === 'high' || state === 'likely';
}

const WRONG_TITLE_CASES: readonly WrongTitleCase[] = [
  {
    id: 'en-harry-potter-hbo',
    title: "Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max",
    oldId: 'Q901001',
    oldLabel: "Harry Potter and the Philosopher's Stone",
    oldDescription: '2001 film',
    correctId: 'Q901002',
    correctLabel: 'Harry Potter',
    correctDescription: '2026 television series'
  },
  {
    id: 'es-resident-evil',
    title: 'Resident Evil | Nuevo Tráiler Oficial en español HD. En cines 18 de septiembre.',
    oldId: 'Q902001',
    oldLabel: 'Resident Evil',
    oldDescription: '2002 film',
    correctId: 'Q902002',
    correctLabel: 'Resident Evil',
    correctDescription: '2026 film'
  },
  {
    id: 'es-odyssey',
    title: 'La Odisea | Tráiler Oficial (Universal Pictures)',
    oldId: 'Q903001',
    oldLabel: 'La Odisea',
    oldDescription: '1997 film',
    correctId: 'Q903002',
    correctLabel: 'La Odisea',
    correctDescription: '2026 film'
  },
  {
    id: 'es-carrie',
    title: 'Carrie - Tráiler oficial | Prime Video',
    oldId: 'Q904001',
    oldLabel: 'Carrie',
    oldDescription: '1976 film',
    correctId: 'Q904002',
    correctLabel: 'Carrie',
    correctDescription: '2026 television series'
  },
  {
    id: 'pt-odyssey',
    title: 'A Odisseia | Trailer Oficial  (Universal Pictures) - HD',
    oldId: 'Q905001',
    oldLabel: 'A Odisseia',
    oldDescription: '1997 film',
    correctId: 'Q905002',
    correctLabel: 'A Odisseia',
    correctDescription: '2026 film'
  },
  {
    id: 'pt-harry-potter-hbo',
    title: 'Harry Potter e a Pedra Filosofal | Teaser Trailer Oficial Dublado | HBO Max',
    oldId: 'Q906001',
    oldLabel: 'Harry Potter e a Pedra Filosofal',
    oldDescription: '2001 film',
    correctId: 'Q906002',
    correctLabel: 'Harry Potter e a Pedra Filosofal',
    correctDescription: '2026 television series'
  }
] as const;

const CORRECT_TITLE_ONLY_CASES: readonly CorrectTitleOnlyCase[] = [
  {
    id: 'en-resident-evil',
    title: 'RESIDENT EVIL – Official Trailer (4K)',
    providerId: 'Q911001',
    label: 'Resident Evil',
    description: '2026 film'
  },
  {
    id: 'es-avengers-doomsday',
    title: 'Avengers: Doomsday | Tráiler Oficial | Doblado',
    providerId: 'Q912001',
    label: 'Avengers: Doomsday',
    description: '2026 film'
  },
  {
    id: 'it-odyssey',
    title: 'Odissea | Trailer Ufficiale (Universal Pictures) - HD',
    providerId: 'Q913001',
    label: 'Odissea',
    description: '2026 film'
  },
  {
    id: 'it-avengers-doomsday',
    title: 'Avengers: Doomsday | Trailer Ufficiale | Dal 16 Dicembre al Cinema',
    providerId: 'Q914001',
    label: 'Avengers: Doomsday',
    description: '2026 film'
  },
  {
    id: 'ru-moana-title-only',
    title: 'Моана — Русский трейлер',
    providerId: 'Q915001',
    label: 'Моана',
    description: '2026 фильм'
  }
] as const;

function wrongTitleFetch(testCase: WrongTitleCase) {
  let titleSearchCalls = 0;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const action = url.searchParams.get('action');
    if (action === 'query' && url.searchParams.get('list') === 'search') {
      return jsonResponse({ query: { search: [] } });
    }
    if (action === 'wbsearchentities') {
      titleSearchCalls += 1;
      if (titleSearchCalls === 1) {
        return jsonResponse({
          search: [{ id: testCase.oldId, label: testCase.oldLabel, description: testCase.oldDescription }]
        });
      }
      return jsonResponse({
        search: [{ id: testCase.correctId, label: testCase.correctLabel, description: testCase.correctDescription }]
      });
    }
    throw new Error(`unexpected_url:${url}`);
  });
}

function unanimousFetch(testCase: CorrectTitleOnlyCase) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const action = url.searchParams.get('action');
    if (action === 'query' && url.searchParams.get('list') === 'search') {
      return jsonResponse({ query: { search: [] } });
    }
    if (action === 'wbsearchentities') {
      return jsonResponse({
        search: [{ id: testCase.providerId, label: testCase.label, description: testCase.description }]
      });
    }
    throw new Error(`unexpected_url:${url}`);
  });
}

describe('entity/cross-query consensus candidate', () => {
  it.each(WRONG_TITLE_CASES)('does not expose the first stale exact-title entity: $id', async (testCase) => {
    const fetchFn = wrongTitleFetch(testCase);
    const result = await createPublicRecognitionOrchestrator({ fetchFn })(context(testCase.id, testCase.title), { enabledSources: [] });

    const oldEntityIsVisible = visible(result?.decision.state) && result?.decision.score.candidate.providerId === testCase.oldId;
    expect(oldEntityIsVisible).toBe(false);
  });

  it.each(CORRECT_TITLE_ONLY_CASES)('preserves a correct title-only entity when evidence is unambiguous: $id', async (testCase) => {
    const fetchFn = unanimousFetch(testCase);
    const result = await createPublicRecognitionOrchestrator({ fetchFn })(context(testCase.id, testCase.title), { enabledSources: [] });

    expect(visible(result?.decision.state)).toBe(true);
    expect(result?.decision.score.candidate.providerId).toBe(testCase.providerId);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { RecognitionResult, YouTubeVideoContext } from '../../src/core/types';
import {
  createContentRecognizer,
  createRecognitionMessageHandler,
  RECOGNIZE_MESSAGE_TYPE
} from '../../src/extension/message-bridge';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Everything Everywhere All at Once | Official Trailer',
  description: 'Official trailer',
  channelName: 'A24',
  hashtags: [],
  url: 'https://www.youtube.com/watch?v=abc123'
};

const result: RecognitionResult = {
  decision: {
    state: 'high',
    score: {
      candidate: {
        providerId: 'Q48252',
        mediaType: 'movie',
        title: 'Everything Everywhere All at Once',
        releaseYear: 2022
      },
      confidence: 0.98,
      reasons: ['title-match']
    }
  },
  ratings: []
};

type RecognizeWithSources = (
  context: YouTubeVideoContext,
  options?: { enabledSources?: readonly string[] }
) => Promise<RecognitionResult | null>;

describe('recognition source selection bridge', () => {
  it('sends enabled sources to the service worker and passes them into orchestration', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true as const, result }));
    const recognize = createContentRecognizer(sendMessage) as unknown as RecognizeWithSources;

    await recognize(context, { enabledSources: ['IMDb', 'Metacritic'] });
    expect(sendMessage).toHaveBeenCalledWith({
      type: RECOGNIZE_MESSAGE_TYPE,
      context,
      enabledSources: ['IMDb', 'Metacritic']
    });

    const workerRecognize = vi.fn(async (
      _context: YouTubeVideoContext,
      _options?: { enabledSources?: readonly string[] }
    ) => result);
    const handle = createRecognitionMessageHandler(workerRecognize);
    await expect(handle({
      type: RECOGNIZE_MESSAGE_TYPE,
      context,
      enabledSources: ['IMDb', 'Metacritic']
    })).resolves.toEqual({ ok: true, result });
    expect(workerRecognize).toHaveBeenCalledWith(context, {
      enabledSources: ['IMDb', 'Metacritic']
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { RecognitionResult, YouTubeVideoContext } from '../../src/core/types';
import {
  createContentRecognizer,
  createRecognitionMessageHandler,
  RECOGNIZE_MESSAGE_TYPE
} from '../../src/extension/message-bridge';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer 3 (2024)',
  description: 'Official trailer',
  channelName: 'Warner Bros. Pictures',
  hashtags: ['DunePartTwo'],
  url: 'https://www.youtube.com/watch?v=abc123'
};

const result: RecognitionResult = {
  decision: {
    state: 'high',
    score: {
      candidate: {
        providerId: '693134',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        releaseYear: 2024
      },
      confidence: 0.98,
      reasons: ['title-exact-match']
    }
  },
  ratings: [{ source: 'TMDB', value: 8.1, scale: 10 }]
};

describe('extension recognition message bridge', () => {
  it('passes a valid recognition request to the service-worker recognizer', async () => {
    const recognize = vi.fn(async () => result);
    const handle = createRecognitionMessageHandler(recognize);

    await expect(handle({ type: RECOGNIZE_MESSAGE_TYPE, context })).resolves.toEqual({
      ok: true,
      result
    });
    expect(recognize).toHaveBeenCalledWith(context);
  });

  it('ignores unknown messages instead of treating them as recognition requests', async () => {
    const recognize = vi.fn(async () => result);
    const handle = createRecognitionMessageHandler(recognize);

    await expect(handle({ type: 'other-message', context })).resolves.toBeUndefined();
    expect(recognize).not.toHaveBeenCalled();
  });

  it('normalizes service-worker recognition failures across the message boundary', async () => {
    const handle = createRecognitionMessageHandler(async () => {
      throw new Error('provider unavailable');
    });

    await expect(handle({ type: RECOGNIZE_MESSAGE_TYPE, context })).resolves.toEqual({
      ok: false,
      error: 'recognition_failed'
    });
  });

  it('content recognizer sends only the typed request and returns the result', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true as const, result }));
    const recognize = createContentRecognizer(sendMessage);

    await expect(recognize(context)).resolves.toEqual(result);
    expect(sendMessage).toHaveBeenCalledWith({
      type: RECOGNIZE_MESSAGE_TYPE,
      context
    });
  });

  it('content recognizer rejects a normalized service-worker failure', async () => {
    const recognize = createContentRecognizer(async () => ({
      ok: false as const,
      error: 'recognition_failed' as const
    }));

    await expect(recognize(context)).rejects.toThrow('recognition_failed');
  });
});

import type { RecognitionResult, YouTubeVideoContext } from '../core/types';

export const RECOGNIZE_MESSAGE_TYPE = 'tubescore:recognize' as const;

export interface RecognitionRequest {
  type: typeof RECOGNIZE_MESSAGE_TYPE;
  context: YouTubeVideoContext;
}

export type RecognitionResponse =
  | { ok: true; result: RecognitionResult | null }
  | { ok: false; error: 'invalid_request' | 'recognition_failed' };

export type Recognize = (context: YouTubeVideoContext) => Promise<RecognitionResult | null>;
export type SendMessage = (message: RecognitionRequest) => Promise<unknown>;

export interface RuntimeMessageApi {
  onMessage: {
    addListener(
      listener: (
        message: unknown,
        sender: unknown,
        sendResponse: (response: RecognitionResponse) => void
      ) => boolean | void
    ): void;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isYouTubeVideoContext(value: unknown): value is YouTubeVideoContext {
  if (!isRecord(value)) return false;
  return typeof value.videoId === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.channelName === 'string'
    && Array.isArray(value.hashtags)
    && value.hashtags.every((item) => typeof item === 'string')
    && typeof value.url === 'string';
}

function isRecognitionResponse(value: unknown): value is RecognitionResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) return 'result' in value;
  return value.error === 'invalid_request' || value.error === 'recognition_failed';
}

function isRecognitionEnvelope(value: unknown): value is { type: typeof RECOGNIZE_MESSAGE_TYPE; context?: unknown } {
  return isRecord(value) && value.type === RECOGNIZE_MESSAGE_TYPE;
}

export function createRecognitionMessageHandler(recognize: Recognize) {
  return async (message: unknown): Promise<RecognitionResponse | undefined> => {
    if (!isRecognitionEnvelope(message)) return undefined;
    if (!isYouTubeVideoContext(message.context)) {
      return { ok: false, error: 'invalid_request' };
    }

    try {
      return { ok: true, result: await recognize(message.context) };
    } catch {
      return { ok: false, error: 'recognition_failed' };
    }
  };
}

export function createContentRecognizer(sendMessage: SendMessage): Recognize {
  return async (context) => {
    const response = await sendMessage({
      type: RECOGNIZE_MESSAGE_TYPE,
      context
    });

    if (!isRecognitionResponse(response)) {
      throw new Error('invalid_response');
    }
    if (!response.ok) {
      throw new Error(response.error);
    }
    return response.result;
  };
}

export function registerRecognitionMessageBridge(
  runtime: RuntimeMessageApi,
  recognize: Recognize
): void {
  const handle = createRecognitionMessageHandler(recognize);

  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRecognitionEnvelope(message)) return false;

    void handle(message).then((response) => {
      sendResponse(response ?? { ok: false, error: 'invalid_request' });
    });
    return true;
  });
}

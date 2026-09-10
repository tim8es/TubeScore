import {
  DEFAULT_ENABLED_RATING_SOURCES,
  normalizeEnabledRatingSources
} from '../core/rating-sources';
import { createContentRecognizer, type RecognitionRequest } from './message-bridge';
import { YouTubeContentRuntime } from '../youtube/content-runtime';

const STORAGE_KEY = 'enabledRatingSources';

declare const chrome: {
  runtime: {
    sendMessage(message: RecognitionRequest): Promise<unknown>;
  };
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

const recognize = createContentRecognizer((message) => chrome.runtime.sendMessage(message));

async function loadEnabledSources(): Promise<string[]> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeEnabledRatingSources(stored[STORAGE_KEY]);
  } catch {
    return [...DEFAULT_ENABLED_RATING_SOURCES];
  }
}

async function saveEnabledSources(sources: string[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: normalizeEnabledRatingSources(sources)
    });
  } catch {
    // Preferences are non-critical. Keep the current session usable if storage is unavailable.
  }
}

async function start(): Promise<void> {
  const enabledSources = await loadEnabledSources();
  const runtime = new YouTubeContentRuntime({
    recognize,
    enabledSources,
    onEnabledSourcesChange: saveEnabledSources
  });
  runtime.start();
}

void start();

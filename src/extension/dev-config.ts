import {
  InvalidRuntimeConfigError,
  RUNTIME_CONFIG_KEY,
  type RuntimeConfigStorage
} from './recognition-orchestrator';

export interface MutableRuntimeConfigStorage extends RuntimeConfigStorage {
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export async function saveLocalTmdbToken(
  storage: MutableRuntimeConfigStorage,
  token: string
): Promise<void> {
  const normalized = token.trim();
  if (normalized === '') {
    throw new InvalidRuntimeConfigError();
  }

  await storage.set({
    [RUNTIME_CONFIG_KEY]: {
      tmdbAccessToken: normalized
    }
  });
}

export async function clearLocalTmdbToken(
  storage: MutableRuntimeConfigStorage
): Promise<void> {
  await storage.remove(RUNTIME_CONFIG_KEY);
}

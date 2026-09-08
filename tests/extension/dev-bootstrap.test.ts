import { describe, expect, it, vi } from 'vitest';
import { RUNTIME_CONFIG_KEY } from '../../src/extension/recognition-orchestrator';
import {
  clearLocalTmdbToken,
  saveLocalTmdbToken,
  type MutableRuntimeConfigStorage
} from '../../src/extension/dev-config';
import { runBrowserSmokePreflight } from '../../src/extension/smoke-preflight';

function createStorage(initial: Record<string, unknown> = {}): MutableRuntimeConfigStorage {
  const state: Record<string, unknown> = { ...initial };
  return {
    async get(key: string) {
      return key in state ? { [key]: state[key] } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(state, items);
    },
    async remove(key: string) {
      delete state[key];
    }
  };
}

describe('local developer runtime configuration', () => {
  it('stores a supplied token only in local runtime storage', async () => {
    const storage = createStorage();

    await saveLocalTmdbToken(storage, '  local-token  ');

    await expect(storage.get(RUNTIME_CONFIG_KEY)).resolves.toEqual({
      [RUNTIME_CONFIG_KEY]: { tmdbAccessToken: 'local-token' }
    });
  });

  it('rejects an empty token without writing storage', async () => {
    const set = vi.fn(async (_items: Record<string, unknown>) => undefined);
    const storage: MutableRuntimeConfigStorage = {
      get: async () => ({}),
      set,
      remove: async () => undefined
    };

    await expect(saveLocalTmdbToken(storage, '   ')).rejects.toThrow('invalid_runtime_config');
    expect(set).not.toHaveBeenCalled();
  });

  it('clears the local runtime token', async () => {
    const storage = createStorage({
      [RUNTIME_CONFIG_KEY]: { tmdbAccessToken: 'local-token' }
    });

    await clearLocalTmdbToken(storage);

    await expect(storage.get(RUNTIME_CONFIG_KEY)).resolves.toEqual({});
  });
});

describe('browser smoke preflight', () => {
  it('returns safe-unconfigured without any network attempt when token is missing', async () => {
    const fetchFn = vi.fn();

    await expect(runBrowserSmokePreflight({
      storage: createStorage(),
      fetchFn
    })).resolves.toEqual({
      status: 'safe-unconfigured',
      networkAttempted: false
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns invalid-config without network for malformed local config', async () => {
    const fetchFn = vi.fn();

    await expect(runBrowserSmokePreflight({
      storage: createStorage({ [RUNTIME_CONFIG_KEY]: { tmdbAccessToken: '   ' } }),
      fetchFn
    })).resolves.toEqual({
      status: 'invalid-config',
      networkAttempted: false
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports ready-for-browser-smoke for valid local config without probing TMDB', async () => {
    const fetchFn = vi.fn();

    await expect(runBrowserSmokePreflight({
      storage: createStorage({ [RUNTIME_CONFIG_KEY]: { tmdbAccessToken: 'local-token' } }),
      fetchFn
    })).resolves.toEqual({
      status: 'ready-for-browser-smoke',
      networkAttempted: false
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

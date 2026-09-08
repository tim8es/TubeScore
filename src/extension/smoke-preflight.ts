import {
  InvalidRuntimeConfigError,
  loadRuntimeConfig,
  type RuntimeConfigStorage
} from './recognition-orchestrator';

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BrowserSmokePreflightVerdict =
  | { status: 'safe-unconfigured'; networkAttempted: false }
  | { status: 'invalid-config'; networkAttempted: false }
  | { status: 'ready-for-browser-smoke'; networkAttempted: false };

export interface BrowserSmokePreflightOptions {
  storage: RuntimeConfigStorage;
  fetchFn?: FetchFn;
}

export async function runBrowserSmokePreflight(
  options: BrowserSmokePreflightOptions
): Promise<BrowserSmokePreflightVerdict> {
  try {
    const config = await loadRuntimeConfig(options.storage);
    if (!config) {
      return { status: 'safe-unconfigured', networkAttempted: false };
    }

    // Preflight intentionally validates only local configuration. It never probes
    // TMDB, so tokens cannot leak through requests or CI/browser preflight logs.
    return { status: 'ready-for-browser-smoke', networkAttempted: false };
  } catch (error) {
    if (error instanceof InvalidRuntimeConfigError) {
      return { status: 'invalid-config', networkAttempted: false };
    }
    throw error;
  }
}

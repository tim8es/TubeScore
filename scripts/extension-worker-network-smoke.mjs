import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST_DIR = resolve('dist');
const EVIDENCE_DIR = resolve('browser-smoke-artifacts');
const API_URL = 'https://www.wikidata.org/w/api.php';

await mkdir(EVIDENCE_DIR, { recursive: true });
const profileDir = await mkdtemp(join(tmpdir(), 'tubescore-worker-network-'));
let context;
let result = { status: 'running', userChromeTouched: false, secretsUsed: false };

try {
  context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-sync'
    ]
  });

  let worker = context.serviceWorkers().find((item) => item.url().startsWith('chrome-extension://'));
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', {
      predicate: (item) => item.url().startsWith('chrome-extension://'),
      timeout: 15000
    });
  }

  const diagnostic = await worker.evaluate(async (apiUrl) => {
    const url = new URL(apiUrl);
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', 'Dune Part Two 2024');
    url.searchParams.set('language', 'en');
    url.searchParams.set('uselang', 'en');
    url.searchParams.set('type', 'item');
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Api-User-Agent': 'TubeScore/0.1 (https://github.com/tim8es/TubeScore)'
      }
    });
    const payload = await response.json();
    const dune = Array.isArray(payload?.search)
      ? payload.search.find((item) => /Dune: Part Two/i.test(item?.label ?? '')) ?? null
      : null;

    return {
      workerUrl: self.location.href,
      status: response.status,
      ok: response.ok,
      dune,
      requestHost: url.host,
      authUsed: false
    };
  }, API_URL);

  const pass = diagnostic.status === 200
    && diagnostic.ok === true
    && diagnostic.dune?.id
    && diagnostic.requestHost === 'www.wikidata.org';

  result = {
    status: pass ? 'pass' : 'fail',
    userChromeTouched: false,
    secretsUsed: false,
    chromiumVersion: context.browser()?.version() ?? 'unknown',
    diagnostic
  };
  console.log(JSON.stringify(result));
  if (!pass) process.exitCode = 1;
} catch (error) {
  result = {
    status: 'blocked',
    userChromeTouched: false,
    secretsUsed: false,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  };
  console.error(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await writeFile(join(EVIDENCE_DIR, '00-extension-worker-network.json'), `${JSON.stringify(result, null, 2)}\n`);
  await context?.close().catch(() => undefined);
  await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
}

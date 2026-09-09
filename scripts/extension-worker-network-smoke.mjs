import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST_DIR = resolve('dist');
const EVIDENCE_DIR = resolve('browser-smoke-artifacts');
const SUGGESTION_URL = 'https://v3.sg.media-imdb.com/suggestion/x/dune%20part%20two.json';
const DATASET_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';

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

  const diagnostic = await worker.evaluate(async ({ suggestionUrl, datasetUrl }) => {
    async function fetchWithTimeout(url, init = {}, timeoutMs = 45000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    }

    const output = {
      workerUrl: self.location.href,
      decompressionStreamType: typeof DecompressionStream,
      suggestion: null,
      dataset: null
    };

    try {
      const response = await fetchWithTimeout(suggestionUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      const text = await response.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch {}
      output.suggestion = {
        status: response.status,
        ok: response.ok,
        type: response.type,
        contentType: response.headers.get('content-type'),
        bodyLength: text.length,
        dune: Array.isArray(payload?.d)
          ? payload.d.find((item) => item?.id === 'tt15239678') ?? null
          : null
      };
    } catch (error) {
      output.suggestion = { error: String(error) };
    }

    try {
      const response = await fetchWithTimeout(datasetUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/gzip, application/octet-stream, text/tab-separated-values' }
      }, 90000);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const gzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      const info = {
        status: response.status,
        ok: response.ok,
        type: response.type,
        contentType: response.headers.get('content-type'),
        contentEncoding: response.headers.get('content-encoding'),
        contentLengthHeader: response.headers.get('content-length'),
        byteLength: bytes.length,
        firstBytes: Array.from(bytes.slice(0, 12)),
        gzip,
        decompressedLength: null,
        duneRow: null,
        decodeError: null
      };

      try {
        let text;
        if (gzip) {
          const body = new Response(buffer).body;
          if (!body) throw new Error('missing_body');
          text = await new Response(body.pipeThrough(new DecompressionStream('gzip'))).text();
        } else {
          text = new TextDecoder().decode(bytes);
        }
        info.decompressedLength = text.length;
        info.duneRow = text.match(/^tt15239678\t[^\r\n]+$/m)?.[0] ?? null;
      } catch (error) {
        info.decodeError = String(error);
      }
      output.dataset = info;
    } catch (error) {
      output.dataset = { error: String(error) };
    }

    return output;
  }, { suggestionUrl: SUGGESTION_URL, datasetUrl: DATASET_URL });

  const pass = diagnostic.suggestion?.status === 200
    && diagnostic.suggestion?.dune?.id === 'tt15239678'
    && diagnostic.dataset?.status === 200
    && typeof diagnostic.dataset?.duneRow === 'string'
    && diagnostic.dataset.duneRow.startsWith('tt15239678\t');

  result = {
    status: pass ? 'pass' : 'fail',
    userChromeTouched: false,
    secretsUsed: false,
    chromiumVersion: context.browser()?.version() ?? 'unknown',
    diagnostic
  };
  console.log(JSON.stringify(result));
} catch (error) {
  result = {
    status: 'blocked',
    userChromeTouched: false,
    secretsUsed: false,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  };
  console.error(JSON.stringify(result));
} finally {
  await writeFile(join(EVIDENCE_DIR, '00-extension-worker-network.json'), `${JSON.stringify(result, null, 2)}\n`);
  await context?.close().catch(() => undefined);
  await rm(profileDir, { recursive: true, force: true }).catch(() => undefined);
}

// This diagnostic records evidence but does not short-circuit the broader browser smoke.
process.exitCode = 0;

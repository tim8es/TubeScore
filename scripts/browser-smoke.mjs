import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const FIRST_VIDEO_ID = 'Way9Dexny3w';
const SECOND_VIDEO_ID = '_YUzQa_1RCE';
const FIRST_VIDEO_URL = `https://www.youtube.com/watch?v=${FIRST_VIDEO_ID}&hl=en&gl=US`;
const SECOND_VIDEO_URL = `https://www.youtube.com/watch?v=${SECOND_VIDEO_ID}&hl=en&gl=US`;
const SUGGESTION_PREFIX = 'https://v3.sg.media-imdb.com/suggestion/';
const RATINGS_DATASET_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const EVIDENCE_DIR = resolve('browser-smoke-artifacts');
const DIST_DIR = resolve('dist');
const report = {
  startedAt: new Date().toISOString(),
  mode: 'isolated-playwright-chromium-unpacked-extension',
  userChromeTouched: false,
  secretsUsed: false,
  firstVideoUrl: FIRST_VIDEO_URL,
  secondVideoUrl: SECOND_VIDEO_URL,
  browser: null,
  extension: {},
  live: {},
  providerError: {},
  fallback: {},
  status: 'running'
};

const logLines = [];
function log(event, data = {}) {
  const record = { at: new Date().toISOString(), event, ...data };
  logLines.push(JSON.stringify(record));
  console.log(JSON.stringify(record));
}

async function saveEvidence() {
  report.finishedAt = new Date().toISOString();
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(join(EVIDENCE_DIR, 'browser-smoke-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(EVIDENCE_DIR, 'browser-smoke.log'), `${logLines.join('\n')}\n`);
}

async function dismissConsent(page) {
  const labels = [/Reject all/i, /Accept all/i, /I agree/i];
  for (const label of labels) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible({ timeout: 1200 }).catch(() => false)) {
      log('youtube_consent_detected', { label: String(label) });
      await button.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function waitForWatchMetadata(page, expectedVideoId) {
  await page.waitForFunction(
    (videoId) => {
      const url = new URL(location.href);
      if (url.pathname !== '/watch' || url.searchParams.get('v') !== videoId) return false;
      const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string');
      return Boolean(title?.textContent?.trim());
    },
    expectedVideoId,
    { timeout: 60000 }
  );
}

async function readOverlay(page, timeout = 150000) {
  const card = page.locator('.tubescore-card').first();
  await card.waitFor({ state: 'visible', timeout });
  return card.evaluate((element) => ({
    text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    state: element.getAttribute('data-tubescore-state'),
    count: document.querySelectorAll('.tubescore-card').length
  }));
}

function attachNetworkEvidence(context, name) {
  const entries = [];
  context.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(SUGGESTION_PREFIX) || url === RATINGS_DATASET_URL) {
      const entry = { phase: 'request', method: request.method(), url, resourceType: request.resourceType() };
      entries.push(entry);
      log(`${name}_network_request`, entry);
    }
  });
  context.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(SUGGESTION_PREFIX) || url === RATINGS_DATASET_URL) {
      const entry = { phase: 'response', status: response.status(), url };
      entries.push(entry);
      log(`${name}_network_response`, entry);
    }
  });
  return entries;
}

function attachWorkerEvidence(context, name) {
  const workers = [];
  const recordWorker = (worker) => {
    const url = worker.url();
    if (workers.some((item) => item.url === url)) return;
    const entry = { url, console: [] };
    workers.push(entry);
    log(`${name}_service_worker`, { url });
    worker.on('console', (message) => {
      const text = message.text();
      entry.console.push({ type: message.type(), text });
      log(`${name}_worker_console`, { type: message.type(), text });
    });
  };
  for (const worker of context.serviceWorkers()) recordWorker(worker);
  context.on('serviceworker', recordWorker);
  return workers;
}

async function launchExtensionContext(extensionDir, profileDir, name) {
  log(`${name}_launch_start`, { extensionDir, profileDir });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-features=Translate'
    ]
  });
  report.browser = { version: context.browser()?.version() ?? 'unknown' };
  return context;
}

async function navigateViaRealYouTubeSpa(page) {
  const marker = `tubescore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.evaluate((value) => { window.__tubeScoreSmokeDocumentMarker = value; }, marker);

  const direct = page.locator(`a[href*="watch?v=${SECOND_VIDEO_ID}"]`).first();
  if (await direct.isVisible({ timeout: 5000 }).catch(() => false)) {
    log('spa_navigation_strategy', { strategy: 'related-link' });
    await direct.click({ timeout: 10000 });
  } else {
    log('spa_navigation_strategy', { strategy: 'youtube-search' });
    const search = page.locator('input[name="search_query"], input#search').first();
    await search.waitFor({ state: 'visible', timeout: 20000 });
    await search.click();
    await search.fill('Dune Part Two Official Trailer 2 Warner Bros');
    await search.press('Enter');
    await page.waitForURL(/youtube\.com\/results\?/, { timeout: 30000 });
    const result = page.locator(`a#video-title[href*="${SECOND_VIDEO_ID}"], a[href*="watch?v=${SECOND_VIDEO_ID}"]`).first();
    await result.waitFor({ state: 'visible', timeout: 30000 });
    await result.click({ timeout: 10000 });
  }

  await page.waitForURL((url) => url.pathname === '/watch' && url.searchParams.get('v') === SECOND_VIDEO_ID, { timeout: 45000 });
  await waitForWatchMetadata(page, SECOND_VIDEO_ID);
  const markerPreserved = await page.evaluate((value) => window.__tubeScoreSmokeDocumentMarker === value, marker);
  return markerPreserved;
}

async function runLiveExtensionSmoke(tempRoot) {
  const profileDir = join(tempRoot, 'profile-success');
  const context = await launchExtensionContext(DIST_DIR, profileDir, 'success');
  const network = attachNetworkEvidence(context, 'success');
  const workers = attachWorkerEvidence(context, 'success');

  try {
    const page = context.pages()[0] ?? await context.newPage();
    page.on('console', (message) => {
      const text = message.text();
      if (/tubescore/i.test(text)) log('page_console', { type: message.type(), text });
    });

    await page.goto(FIRST_VIDEO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitForWatchMetadata(page, FIRST_VIDEO_ID);
    await page.screenshot({ path: join(EVIDENCE_DIR, '01-youtube-watch-loaded.png'), fullPage: false });

    const firstOverlay = await readOverlay(page);
    report.live.firstOverlay = firstOverlay;
    log('first_overlay', firstOverlay);
    if (!['high', 'likely'].includes(firstOverlay.state ?? '')) throw new Error(`unexpected_first_overlay_state:${firstOverlay.state}`);
    if (!/IMDb\s+\d+(?:\.\d+)?\/10/.test(firstOverlay.text)) throw new Error(`first_overlay_missing_imdb_rating:${firstOverlay.text}`);
    if (!/Dune: Part Two/i.test(firstOverlay.text)) throw new Error(`first_overlay_wrong_title:${firstOverlay.text}`);
    if (firstOverlay.count !== 1) throw new Error(`first_overlay_duplicate_count:${firstOverlay.count}`);
    await page.screenshot({ path: join(EVIDENCE_DIR, '02-overlay-success.png'), fullPage: false });

    const spaMarkerPreserved = await navigateViaRealYouTubeSpa(page);
    const secondOverlay = await readOverlay(page);
    report.live.spaMarkerPreserved = spaMarkerPreserved;
    report.live.secondOverlay = secondOverlay;
    report.live.secondUrl = page.url();
    log('spa_navigation_result', { spaMarkerPreserved, secondUrl: page.url(), ...secondOverlay });
    if (!spaMarkerPreserved) throw new Error('youtube_navigation_was_not_spa_document_preserving');
    if (secondOverlay.count !== 1) throw new Error(`second_overlay_duplicate_count:${secondOverlay.count}`);
    if (!/IMDb\s+\d+(?:\.\d+)?\/10/.test(secondOverlay.text)) throw new Error(`second_overlay_missing_imdb_rating:${secondOverlay.text}`);
    await page.screenshot({ path: join(EVIDENCE_DIR, '03-spa-navigation-overlay.png'), fullPage: false });

    report.extension.successWorkers = workers;
    report.live.network = network;
    report.live.autocompleteObserved = network.some((entry) => entry.url?.startsWith(SUGGESTION_PREFIX));
    report.live.ratingsDatasetObserved = network.some((entry) => entry.url === RATINGS_DATASET_URL);
  } finally {
    await context.close();
  }
}

async function makeFaultInjectedDist(tempRoot) {
  const faultDist = join(tempRoot, 'dist-provider-error');
  await cp(DIST_DIR, faultDist, { recursive: true });
  const workerPath = join(faultDist, 'service-worker.js');
  const original = await readFile(workerPath, 'utf8');
  const prelude = `const __tubeScoreSmokeFetch = globalThis.fetch.bind(globalThis);\nglobalThis.fetch = (input, init) => {\n  const url = String(input);\n  if (url.includes('datasets.imdbws.com/title.ratings.tsv.gz')) {\n    return Promise.reject(new Error('tubescore_smoke_injected_dataset_failure'));\n  }\n  return __tubeScoreSmokeFetch(input, init);\n};\n`;
  await writeFile(workerPath, `${prelude}${original}`);
  return faultDist;
}

async function runProviderErrorSmoke(tempRoot) {
  const faultDist = await makeFaultInjectedDist(tempRoot);
  const profileDir = join(tempRoot, 'profile-error');
  const context = await launchExtensionContext(faultDist, profileDir, 'provider_error');
  const network = attachNetworkEvidence(context, 'provider_error');
  const workers = attachWorkerEvidence(context, 'provider_error');

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(FIRST_VIDEO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitForWatchMetadata(page, FIRST_VIDEO_ID);
    const overlay = await readOverlay(page, 90000);
    report.providerError = { overlay, network, workers, fault: 'dataset-fetch-rejection-in-temporary-dist-copy' };
    log('provider_error_overlay', overlay);
    if (overlay.state !== 'error') throw new Error(`provider_error_wrong_state:${overlay.state}`);
    if (!/TubeScore\s*·\s*Unavailable/i.test(overlay.text)) throw new Error(`provider_error_missing_unavailable:${overlay.text}`);
    if (/tubescore_smoke_injected|dataset_failure/i.test(overlay.text)) throw new Error('provider_error_leaked_internal_error');
    await page.screenshot({ path: join(EVIDENCE_DIR, '04-provider-error-ux.png'), fullPage: false });
  } finally {
    await context.close();
  }
}

async function runNetworkBundleFallback() {
  const manifest = JSON.parse(await readFile(join(DIST_DIR, 'manifest.json'), 'utf8'));
  const worker = await readFile(join(DIST_DIR, 'service-worker.js'), 'utf8');
  const forbidden = ['tmdbAccessToken', 'tubescoreRuntimeConfig', 'api.themoviedb.org', 'chrome.storage'];
  const bundle = {
    manifestVersion: manifest.manifest_version,
    hostPermissions: manifest.host_permissions,
    contentScriptMatches: manifest.content_scripts?.flatMap((entry) => entry.matches ?? []) ?? [],
    forbiddenFound: forbidden.filter((value) => worker.includes(value)),
    hasAutocompleteHost: worker.includes('v3.sg.media-imdb.com'),
    hasRatingsDatasetHost: worker.includes('datasets.imdbws.com')
  };

  const suggestionUrl = 'https://v3.sg.media-imdb.com/suggestion/x/dune%20part%20two.json';
  const suggestionResponse = await fetch(suggestionUrl, { headers: { Accept: 'application/json' } });
  let suggestionId = null;
  if (suggestionResponse.ok) {
    const payload = await suggestionResponse.json();
    suggestionId = Array.isArray(payload?.d) ? payload.d.find((item) => item?.id === 'tt15239678')?.id ?? null : null;
  }

  let datasetResponse = await fetch(RATINGS_DATASET_URL, { method: 'HEAD' });
  if (!datasetResponse.ok && datasetResponse.status === 405) {
    datasetResponse = await fetch(RATINGS_DATASET_URL, { headers: { Range: 'bytes=0-31' } });
  }

  report.fallback = {
    bundle,
    autocomplete: { status: suggestionResponse.status, dunePartTwoId: suggestionId },
    ratingsDataset: {
      status: datasetResponse.status,
      contentType: datasetResponse.headers.get('content-type'),
      contentLength: datasetResponse.headers.get('content-length')
    }
  };
  log('network_bundle_fallback', report.fallback);
}

async function main() {
  await rm(EVIDENCE_DIR, { recursive: true, force: true });
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const tempRoot = await mkdtemp(join(tmpdir(), 'tubescore-browser-smoke-'));
  report.temporaryRoot = tempRoot;

  try {
    await runNetworkBundleFallback();
    await runLiveExtensionSmoke(tempRoot);
    await runProviderErrorSmoke(tempRoot);
    report.status = 'pass';
    log('smoke_pass');
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    report.status = 'blocked-or-failed';
    report.blocker = message;
    log('smoke_blocker', { message });
    await writeFile(join(EVIDENCE_DIR, 'fatal-error.txt'), `${message}\n`);
    process.exitCode = 1;
  } finally {
    await saveEvidence();
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

await main();

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('manual-regression-artifacts');
const CASES = [
  { id: 'Mzw2ttJD2qQ', expectedTitle: /The Odyssey/i, screenshot: '01-the-odyssey.png', forbidUnavailable: true },
  { id: 'AMLCbpM1fRQ', expectedTitle: /Onslaught/i, screenshot: '02-onslaught.png', forbidUnavailable: true },
  { id: 'Way9Dexny3w', expectedTitle: /Dune: Part Two/i, screenshot: '03-dune-regression.png', forbidUnavailable: false }
];
const report = { status: 'running', browser: null, cases: [], providerError: null, duneWorkerDiagnostic: null };
const logs = [];

function log(event, data = {}) {
  const line = { at: new Date().toISOString(), event, ...data };
  logs.push(line);
  console.log(JSON.stringify(line));
}

async function dismissConsent(page) {
  for (const name of [/Reject all/i, /Accept all/i, /I agree/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(500);
      break;
    }
  }
}

async function waitWatch(page, id) {
  await page.waitForFunction((videoId) => {
    const url = new URL(location.href);
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string');
    return url.pathname === '/watch' && url.searchParams.get('v') === videoId && Boolean(title?.textContent?.trim());
  }, id, { timeout: 70000 });
}

async function pageMetadata(page) {
  return page.evaluate(() => {
    const pick = (selectors) => {
      for (const selector of selectors) {
        const value = document.querySelector(selector)?.textContent?.trim();
        if (value) return value;
      }
      return '';
    };
    const description = pick(['#description-inline-expander', '#description', 'ytd-text-inline-expander']).slice(0, 600);
    const hashtags = [...new Set([
      ...Array.from(document.querySelectorAll('a[href^="/hashtag/"]')).map((node) => (node.textContent ?? '').replace(/^#/, '').trim()).filter(Boolean),
      ...Array.from(description.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((match) => match[1]).filter(Boolean)
    ])];
    return {
      title: pick(['h1.ytd-watch-metadata yt-formatted-string', 'h1 yt-formatted-string', 'meta[name="title"]']),
      description,
      channel: pick(['ytd-channel-name #text a', '#owner #channel-name a', '#channel-name a']),
      hashtags
    };
  });
}

async function overlay(page, timeout = 120000) {
  await page.waitForFunction(() => {
    const card = document.querySelector('.tubescore-card');
    const state = card?.getAttribute('data-tubescore-state');
    return Boolean(card && ['high', 'likely', 'error'].includes(state ?? ''));
  }, null, { timeout });
  return page.locator('.tubescore-card').first().evaluate((card) => ({
    state: card.getAttribute('data-tubescore-state'),
    text: card.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    count: document.querySelectorAll('.tubescore-card').length
  }));
}

async function launch(extensionDir, profile) {
  return chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-first-run', '--disable-default-apps', '--disable-sync', '--disable-features=Translate'
    ]
  });
}

async function workerDiagnostic(context, recognitionContext, titleQuery) {
  let worker = context.serviceWorkers().find((item) => item.url().startsWith('chrome-extension://'));
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', {
      predicate: (item) => item.url().startsWith('chrome-extension://'),
      timeout: 15000
    });
  }
  return worker.evaluate(async ({ recognitionContext, titleQuery }) => {
    const load = async (params) => {
      const url = new URL('https://www.wikidata.org/w/api.php');
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      url.searchParams.set('format', 'json');
      url.searchParams.set('origin', '*');
      const response = await fetch(url, { cache: 'no-store', headers: { 'Api-User-Agent': 'TubeScore/0.1 regression worker trace' } });
      return { status: response.status, payload: await response.json() };
    };
    const recognition = await Promise.race([
      chrome.runtime.sendMessage({ type: 'tubescore:recognize', context: recognitionContext })
        .then((value) => ({ status: 'resolved', value }))
        .catch((error) => ({ status: 'rejected', error: String(error) })),
      new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), 15000))
    ]);
    return {
      recognition,
      exact: await load({ action: 'query', list: 'search', srsearch: `haswbstatement:P1651=${recognitionContext.videoId}`, srlimit: '10' }),
      title: await load({ action: 'wbsearchentities', search: titleQuery, language: 'en', uselang: 'en', type: 'item', limit: '10' })
    };
  }, { recognitionContext, titleQuery });
}

async function runSuccessCases(root) {
  for (const [index, testCase] of CASES.entries()) {
    const context = await launch(DIST, join(root, `success-profile-${index}`));
    report.browser ??= context.browser()?.version() ?? 'unknown';
    try {
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(`https://www.youtube.com/watch?v=${testCase.id}&hl=en&gl=US`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissConsent(page);
      await waitWatch(page, testCase.id);
      const metadata = await pageMetadata(page);
      log('case_metadata', { id: testCase.id, metadata });
      if (testCase.id === 'Way9Dexny3w') {
        const recognitionContext = {
          videoId: testCase.id,
          title: metadata.title,
          description: metadata.description,
          channelName: metadata.channel,
          hashtags: metadata.hashtags,
          url: page.url()
        };
        report.duneWorkerDiagnostic = await workerDiagnostic(context, recognitionContext, 'dune part two');
        log('dune_worker_diagnostic', report.duneWorkerDiagnostic);
      }
      const card = await overlay(page, testCase.id === 'Way9Dexny3w' ? 30000 : 120000);
      const entry = { id: testCase.id, url: page.url(), metadata, ...card };
      report.cases.push(entry);
      log('case_overlay', entry);
      if (!['high', 'likely'].includes(card.state ?? '')) throw new Error(`unexpected_state:${testCase.id}:${card.state}:${card.text}`);
      if (!testCase.expectedTitle.test(card.text)) throw new Error(`wrong_title:${testCase.id}:${card.text}`);
      if (card.count !== 1) throw new Error(`wrong_card_count:${testCase.id}:${card.count}`);
      if (testCase.forbidUnavailable && /Unavailable|Ratings could not be loaded/i.test(card.text)) throw new Error(`unexpected_unavailable:${testCase.id}:${card.text}`);
      await page.screenshot({ path: join(OUT, testCase.screenshot), fullPage: false });
    } finally {
      await context.close();
    }
  }
}

async function makeFaultDist(root) {
  const dir = join(root, 'fault-dist');
  await cp(DIST, dir, { recursive: true });
  const workerPath = join(dir, 'service-worker.js');
  const worker = await readFile(workerPath, 'utf8');
  const prelude = `const __tsRealFetch = globalThis.fetch.bind(globalThis);\nglobalThis.fetch = (input, init) => {\n  const url = String(input);\n  if (url.includes('www.wikidata.org/w/api.php')) return Promise.reject(new Error('tubescore_manual_smoke_internal_failure'));\n  return __tsRealFetch(input, init);\n};\n`;
  await writeFile(workerPath, prelude + worker);
  return dir;
}

async function runProviderError(root) {
  const faultDist = await makeFaultDist(root);
  const context = await launch(faultDist, join(root, 'error-profile'));
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const id = 'Way9Dexny3w';
    await page.goto(`https://www.youtube.com/watch?v=${id}&hl=en&gl=US`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitWatch(page, id);
    const card = await overlay(page, 90000);
    report.providerError = card;
    log('provider_error_overlay', card);
    if (card.state !== 'error') throw new Error(`provider_error_state:${card.state}:${card.text}`);
    if (!/Unavailable|Ratings could not be loaded/i.test(card.text)) throw new Error(`provider_error_copy:${card.text}`);
    if (/tubescore_manual_smoke|internal_failure/i.test(card.text)) throw new Error(`provider_error_leak:${card.text}`);
    if (card.count !== 1) throw new Error(`provider_error_count:${card.count}`);
    await page.screenshot({ path: join(OUT, '04-provider-error.png'), fullPage: false });
  } finally {
    await context.close();
  }
}

await mkdir(OUT, { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'tubescore-manual-regression-'));
try {
  await runSuccessCases(root);
  await runProviderError(root);
  report.status = 'pass';
  log('manual_regression_gate_pass');
} catch (error) {
  report.status = 'fail';
  report.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  log('manual_regression_gate_fail', { error: report.error });
  process.exitCode = 1;
} finally {
  await writeFile(join(OUT, 'manual-regression.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(OUT, 'manual-regression.log'), `${logs.map((line) => JSON.stringify(line)).join('\n')}\n`);
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}

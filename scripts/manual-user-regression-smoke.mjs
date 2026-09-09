import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('manual-regression-artifacts');
const CASES = [
  { id: 'Mzw2ttJD2qQ', expectedTitle: /The Odyssey/i, screenshot: '01-the-odyssey.png' },
  { id: 'AMLCbpM1fRQ', expectedTitle: /Onslaught/i, screenshot: '02-onslaught.png' }
];
const report = { status: 'running', browser: null, cases: [], wikidataProbe: null };
const logs = [];

function log(event, data = {}) {
  const line = { at: new Date().toISOString(), event, ...data };
  logs.push(line);
  console.log(JSON.stringify(line));
}

async function wikidataSearch(params) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const response = await fetch(url, {
    headers: { 'Api-User-Agent': 'TubeScore/0.1 regression diagnostic' }
  });
  return { url: url.toString(), status: response.status, payload: await response.json() };
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
    const text = (selectors) => {
      for (const selector of selectors) {
        const value = document.querySelector(selector)?.textContent?.trim();
        if (value) return value;
      }
      return '';
    };
    return {
      title: text(['h1.ytd-watch-metadata yt-formatted-string', 'h1 yt-formatted-string', 'meta[name="title"]']),
      description: text(['#description-inline-expander', '#description', 'ytd-text-inline-expander']).slice(0, 1500),
      channel: text(['ytd-channel-name #text a', '#owner #channel-name a', '#channel-name a'])
    };
  });
}

async function overlay(page, timeout = 30000) {
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

async function launch(profile) {
  return chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--no-first-run', '--disable-default-apps', '--disable-sync', '--disable-features=Translate'
    ]
  });
}

await mkdir(OUT, { recursive: true });
report.wikidataProbe = {
  title: await wikidataSearch({ action: 'wbsearchentities', search: 'onslaught', language: 'en', uselang: 'en', type: 'item', limit: '10' }),
  titleYear: await wikidataSearch({ action: 'wbsearchentities', search: 'onslaught 2026', language: 'en', uselang: 'en', type: 'item', limit: '10' }),
  videoId: await wikidataSearch({ action: 'query', list: 'search', srsearch: 'haswbstatement:P1651=AMLCbpM1fRQ', srlimit: '10' })
};
log('wikidata_probe', report.wikidataProbe);

const root = await mkdtemp(join(tmpdir(), 'tubescore-manual-regression-'));
const context = await launch(join(root, 'profile'));
report.browser = context.browser()?.version() ?? 'unknown';
try {
  const page = context.pages()[0] ?? await context.newPage();
  for (const testCase of CASES) {
    const url = `https://www.youtube.com/watch?v=${testCase.id}&hl=en&gl=US`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitWatch(page, testCase.id);
    const metadata = await pageMetadata(page);
    log('page_metadata', { id: testCase.id, ...metadata });
    const card = await overlay(page);
    const entry = { id: testCase.id, url: page.url(), metadata, ...card };
    report.cases.push(entry);
    log('case_overlay', entry);
    if (!['high', 'likely'].includes(card.state ?? '')) throw new Error(`unexpected_state:${testCase.id}:${card.state}:${card.text}`);
    if (!testCase.expectedTitle.test(card.text)) throw new Error(`wrong_title:${testCase.id}:${card.text}`);
    if (card.count !== 1) throw new Error(`wrong_card_count:${testCase.id}:${card.count}`);
    await page.screenshot({ path: join(OUT, testCase.screenshot), fullPage: false });
  }
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
  await context.close();
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('browser-smoke-artifacts');
const FIRST_ID = 'Way9Dexny3w';
const SECOND_ID = '_YUzQa_1RCE';
const FIRST_URL = `https://www.youtube.com/watch?v=${FIRST_ID}&hl=en&gl=US`;
const report = {
  status: 'running',
  userChromeTouched: false,
  secretsUsed: false,
  browser: null,
  first: null,
  spa: null,
  providerError: null
};
const logs = [];

function log(event, data = {}) {
  const line = { at: new Date().toISOString(), event, ...data };
  logs.push(line);
  console.log(JSON.stringify(line));
}

async function save() {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'final-browser-gate.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(OUT, 'final-browser-gate.log'), `${logs.map((x) => JSON.stringify(x)).join('\n')}\n`);
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
    const u = new URL(location.href);
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string');
    return u.pathname === '/watch' && u.searchParams.get('v') === videoId && Boolean(title?.textContent?.trim());
  }, id, { timeout: 70000 });
}

async function overlay(page, timeout = 150000) {
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
      '--no-first-run',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-features=Translate'
    ]
  });
}

async function clickVisibleTarget(page) {
  const preferred = page.locator(`ytd-video-renderer a#video-title[href*="watch?v=${SECOND_ID}"]:visible, ytd-rich-item-renderer a#video-title[href*="watch?v=${SECOND_ID}"]:visible`).first();
  if (await preferred.isVisible({ timeout: 20000 }).catch(() => false)) {
    await preferred.click({ timeout: 10000 });
    return 'visible-renderer';
  }

  const clicked = await page.evaluate((videoId) => {
    const nodes = Array.from(document.querySelectorAll(`a[href*="watch?v=${videoId}"]`));
    const visible = nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (!(visible instanceof HTMLElement)) return false;
    visible.click();
    return true;
  }, SECOND_ID);
  if (!clicked) throw new Error('no_visible_second_video_link');
  return 'visible-dom-fallback';
}

async function runSuccess(root) {
  const profile = join(root, 'success-profile');
  const context = await launch(DIST, profile);
  report.browser = context.browser()?.version() ?? 'unknown';
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(FIRST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitWatch(page, FIRST_ID);
    const first = await overlay(page);
    report.first = first;
    log('first_overlay', first);
    if (!['high', 'likely'].includes(first.state ?? '')) throw new Error(`first_state:${first.state}`);
    if (!/Dune: Part Two/i.test(first.text) || !/IMDb\s+\d+(?:\.\d+)?\/10/.test(first.text)) {
      throw new Error(`first_overlay_content:${first.text}`);
    }
    if (first.count !== 1) throw new Error(`first_overlay_count:${first.count}`);
    await page.screenshot({ path: join(OUT, 'final-01-rating-overlay.png'), fullPage: false });

    const marker = `tubescore-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await page.evaluate((value) => { window.__tubeScoreFinalMarker = value; }, marker);

    const search = page.locator('input[name="search_query"], input#search').first();
    await search.waitFor({ state: 'visible', timeout: 20000 });
    await search.click();
    await search.fill('Dune Part Two Official Trailer 2 Warner Bros');
    await search.press('Enter');
    await page.waitForURL(/youtube\.com\/results\?/, { timeout: 30000 });
    const strategy = await clickVisibleTarget(page);
    await page.waitForURL((u) => u.pathname === '/watch' && u.searchParams.get('v') === SECOND_ID, { timeout: 45000 });
    await waitWatch(page, SECOND_ID);
    const markerPreserved = await page.evaluate((value) => window.__tubeScoreFinalMarker === value, marker);
    const second = await overlay(page);
    report.spa = { strategy, markerPreserved, url: page.url(), overlay: second };
    log('spa_overlay', report.spa);
    if (!markerPreserved) throw new Error('spa_document_replaced');
    if (!['high', 'likely'].includes(second.state ?? '')) throw new Error(`spa_state:${second.state}`);
    if (!/IMDb\s+\d+(?:\.\d+)?\/10/.test(second.text)) throw new Error(`spa_missing_rating:${second.text}`);
    if (second.count !== 1) throw new Error(`spa_overlay_count:${second.count}`);
    await page.screenshot({ path: join(OUT, 'final-02-spa-overlay.png'), fullPage: false });
  } finally {
    await context.close();
  }
}

async function faultDist(root) {
  const dir = join(root, 'fault-dist');
  await cp(DIST, dir, { recursive: true });
  const path = join(dir, 'service-worker.js');
  const worker = await readFile(path, 'utf8');
  const prelude = `const __tsRealFetch = globalThis.fetch.bind(globalThis);\nglobalThis.fetch = (input, init) => {\n  const url = String(input);\n  if (url.includes('datasets.imdbws.com/title.ratings.tsv.gz')) return Promise.reject(new Error('tubescore_smoke_dataset_failure'));\n  return __tsRealFetch(input, init);\n};\n`;
  await writeFile(path, prelude + worker);
  return dir;
}

async function runError(root) {
  const dir = await faultDist(root);
  const profile = join(root, 'error-profile');
  const context = await launch(dir, profile);
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(FIRST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await waitWatch(page, FIRST_ID);
    const card = await overlay(page, 90000);
    report.providerError = card;
    log('provider_error_overlay', card);
    if (card.state !== 'error') throw new Error(`provider_error_state:${card.state}`);
    if (!/TubeScore\s*·\s*Unavailable/i.test(card.text)) throw new Error(`provider_error_copy:${card.text}`);
    if (/tubescore_smoke|dataset_failure/i.test(card.text)) throw new Error('provider_error_leaked_internal_detail');
    if (card.count !== 1) throw new Error(`provider_error_count:${card.count}`);
    await page.screenshot({ path: join(OUT, 'final-03-provider-error.png'), fullPage: false });
  } finally {
    await context.close();
  }
}

await mkdir(OUT, { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'tubescore-final-browser-gate-'));
try {
  await runSuccess(root);
  await runError(root);
  report.status = 'pass';
  log('final_gate_pass');
} catch (error) {
  report.status = 'fail';
  report.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  log('final_gate_fail', { error: report.error });
  process.exitCode = 1;
} finally {
  await save();
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}

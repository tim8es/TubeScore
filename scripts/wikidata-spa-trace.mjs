import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('browser-smoke-artifacts');
const FIRST_ID = 'Way9Dexny3w';
const SECOND_ID = '_YUzQa_1RCE';
const FIRST_URL = `https://www.youtube.com/watch?v=${FIRST_ID}&hl=en&gl=US`;
await mkdir(OUT, { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'tubescore-wikidata-spa-trace-'));
const profile = join(root, 'profile');
const report = { userChromeTouched: false, secretsUsed: false, events: [], network: [], final: null };
let context;

function event(name, data = {}) {
  const record = { at: new Date().toISOString(), name, ...data };
  report.events.push(record);
  console.log('[WD_SPA]', JSON.stringify(record));
}

try {
  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-first-run', '--disable-default-apps', '--disable-sync']
  });
  context.on('request', (request) => {
    if (request.url().startsWith('https://www.wikidata.org/')) {
      const entry = { phase: 'request', url: request.url(), method: request.method() };
      report.network.push(entry);
      event('wikidata_request', entry);
    }
  });
  context.on('response', (response) => {
    if (response.url().startsWith('https://www.wikidata.org/')) {
      const entry = { phase: 'response', url: response.url(), status: response.status() };
      report.network.push(entry);
      event('wikidata_response', entry);
    }
  });

  const page = context.pages()[0] ?? await context.newPage();
  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[WD_PAGE]')) event('page_event', { text });
  });
  await page.goto(FIRST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string')?.textContent?.trim()), null, { timeout: 70000 });
  await page.evaluate(() => {
    for (const name of ['yt-navigate-start', 'yt-navigate-finish', 'popstate']) {
      window.addEventListener(name, () => console.log('[WD_PAGE]', name, location.href));
    }
  });
  await page.locator('.tubescore-card').first().waitFor({ state: 'visible', timeout: 150000 });
  event('first_overlay', { text: await page.locator('.tubescore-card').first().textContent(), url: page.url() });

  const search = page.locator('input[name="search_query"], input#search').first();
  await search.waitFor({ state: 'visible', timeout: 20000 });
  await search.fill('Dune Part Two Official Trailer 2 Warner Bros');
  await search.press('Enter');
  await page.waitForURL(/youtube\.com\/results\?/, { timeout: 30000 });
  event('results_page', { url: page.url() });

  const preferred = page.locator(`ytd-video-renderer a#video-title[href*="watch?v=${SECOND_ID}"]:visible, ytd-rich-item-renderer a#video-title[href*="watch?v=${SECOND_ID}"]:visible`).first();
  if (await preferred.isVisible({ timeout: 20000 }).catch(() => false)) {
    event('click_target', { strategy: 'visible-renderer', text: await preferred.textContent() });
    await preferred.click({ timeout: 10000 });
  } else {
    const clicked = await page.evaluate((videoId) => {
      const nodes = Array.from(document.querySelectorAll(`a[href*="watch?v=${videoId}"]`));
      const visible = nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      if (!(visible instanceof HTMLElement)) return null;
      const text = visible.textContent?.trim() ?? '';
      visible.click();
      return text;
    }, SECOND_ID);
    event('click_target', { strategy: 'visible-dom-fallback', text: clicked });
  }

  await page.waitForURL((u) => u.pathname === '/watch' && u.searchParams.get('v') === SECOND_ID, { timeout: 45000 });
  await page.waitForTimeout(20000);
  report.final = await page.evaluate(() => ({
    url: location.href,
    title: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string')?.textContent?.trim() ?? '',
    cards: Array.from(document.querySelectorAll('.tubescore-card')).map((card) => ({
      state: card.getAttribute('data-tubescore-state'),
      text: card.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    }))
  }));
  event('final_state', report.final);
  await page.screenshot({ path: join(OUT, 'wikidata-spa-trace.png'), fullPage: false });
} catch (error) {
  report.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  event('trace_error', { error: report.error });
} finally {
  await writeFile(join(OUT, 'wikidata-spa-trace.json'), JSON.stringify(report, null, 2) + '\n');
  await context?.close().catch(() => undefined);
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}
process.exitCode = 0;

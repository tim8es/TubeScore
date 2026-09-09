import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('browser-smoke-artifacts');
const WATCH = 'https://www.youtube.com/watch?v=Way9Dexny3w&hl=en&gl=US';
await mkdir(OUT, { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'tubescore-youtube-trace-'));
const tracedDist = join(root, 'dist');
const profile = join(root, 'profile');
let context;
const report = { status: 'running', userChromeTouched: false, secretsUsed: false, watchUrl: WATCH, context: null, workerLogs: [], overlay: null };

try {
  await cp(DIST, tracedDist, { recursive: true });
  const workerPath = join(tracedDist, 'service-worker.js');
  const worker = await readFile(workerPath, 'utf8');
  const prelude = `const __tsOriginalFetch = globalThis.fetch.bind(globalThis);\nglobalThis.fetch = async (input, init) => {\n  const url = String(input);\n  const relevant = url.includes('media-imdb.com') || url.includes('datasets.imdbws.com');\n  if (relevant) console.log('[TS_FETCH_START]', JSON.stringify({url, method:init?.method ?? 'GET', cache:init?.cache ?? null, accept:new Headers(init?.headers).get('accept')}));\n  try {\n    const response = await __tsOriginalFetch(input, init);\n    if (relevant) console.log('[TS_FETCH_RESPONSE]', JSON.stringify({url, status:response.status, ok:response.ok, type:response.type, contentType:response.headers.get('content-type'), contentLength:response.headers.get('content-length')}));\n    return response;\n  } catch (error) {\n    if (relevant) console.log('[TS_FETCH_ERROR]', JSON.stringify({url, error:String(error)}));\n    throw error;\n  }\n};\n`;
  await writeFile(workerPath, prelude + worker);

  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${tracedDist}`,
      `--load-extension=${tracedDist}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-features=Translate'
    ]
  });

  const attach = (sw) => {
    if (!sw.url().startsWith('chrome-extension://')) return;
    sw.on('console', (message) => {
      const text = message.text();
      if (text.startsWith('[TS_FETCH_')) {
        report.workerLogs.push(text);
        console.log(text);
      }
    });
  };
  for (const sw of context.serviceWorkers()) attach(sw);
  context.on('serviceworker', attach);

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(WATCH, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string');
    return Boolean(title?.textContent?.trim());
  }, null, { timeout: 70000 });

  report.context = await page.evaluate(() => ({
    href: location.href,
    title: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string')?.textContent?.trim() ?? '',
    description: document.querySelector('#description-inline-expander, #description, ytd-text-inline-expander')?.textContent?.trim().slice(0, 600) ?? '',
    channelName: document.querySelector('ytd-channel-name #text a, #owner #channel-name a, #channel-name a')?.textContent?.trim() ?? '',
    hashtags: Array.from(document.querySelectorAll('a[href*="/hashtag/"]')).map((a) => a.textContent?.trim() ?? '').filter(Boolean).slice(0, 10)
  }));
  console.log('[TS_PAGE_CONTEXT]', JSON.stringify(report.context));

  const card = page.locator('.tubescore-card').first();
  await card.waitFor({ state: 'visible', timeout: 150000 });
  report.overlay = await card.evaluate((node) => ({
    state: node.getAttribute('data-tubescore-state'),
    text: node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  }));
  await page.screenshot({ path: join(OUT, 'trace-youtube-overlay.png') });
  report.status = 'captured';
  console.log('[TS_OVERLAY]', JSON.stringify(report.overlay));
} catch (error) {
  report.status = 'blocked';
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('[TS_TRACE_BLOCKER]', report.error);
} finally {
  await writeFile(join(OUT, 'trace-youtube.json'), JSON.stringify(report, null, 2) + '\n');
  await context?.close().catch(() => undefined);
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}
process.exitCode = 0;

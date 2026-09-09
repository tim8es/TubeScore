import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('manual-regression-artifacts');
const DUNE_ID = 'Way9Dexny3w';
const logs = [];

function log(event, data = {}) {
  const line = { at: new Date().toISOString(), event, ...data };
  logs.push(line);
  console.log(JSON.stringify(line));
}

async function instrumentContentScript() {
  const path = join(DIST, 'content-script.js');
  const source = await readFile(path, 'utf8');
  const prelude = `
const __tsOriginalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
chrome.runtime.sendMessage = async (...args) => {
  try {
    const message = args[0];
    if (message && message.type === 'tubescore:recognize') {
      document.documentElement.setAttribute('data-tubescore-diag-request', JSON.stringify(message));
    }
    const response = await __tsOriginalSendMessage(...args);
    if (message && message.type === 'tubescore:recognize') {
      document.documentElement.setAttribute('data-tubescore-diag-response', JSON.stringify(response));
    }
    return response;
  } catch (error) {
    document.documentElement.setAttribute('data-tubescore-diag-error', String(error));
    throw error;
  }
};
`;
  await writeFile(path, prelude + source);
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

async function dismissConsent(page) {
  for (const name of [/Reject all/i, /Accept all/i, /I agree/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click().catch(() => undefined);
      break;
    }
  }
}

await mkdir(OUT, { recursive: true });
await instrumentContentScript();
const root = await mkdtemp(join(tmpdir(), 'tubescore-dune-bridge-'));
const context = await launch(join(root, 'profile'));
let report = { status: 'running', browser: context.browser()?.version() ?? 'unknown' };
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(`https://www.youtube.com/watch?v=${DUNE_ID}&hl=en&gl=US`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissConsent(page);
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('v') === id && Boolean(document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string')?.textContent?.trim()), DUNE_ID, { timeout: 70000 });
  await page.waitForTimeout(8000);
  const diagnostic = await page.evaluate(() => ({
    request: document.documentElement.getAttribute('data-tubescore-diag-request'),
    response: document.documentElement.getAttribute('data-tubescore-diag-response'),
    error: document.documentElement.getAttribute('data-tubescore-diag-error'),
    title: document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string')?.textContent?.trim() ?? '',
    card: document.querySelector('.tubescore-card')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    state: document.querySelector('.tubescore-card')?.getAttribute('data-tubescore-state') ?? ''
  }));
  log('dune_bridge_trace', diagnostic);
  report = { status: 'captured', browser: report.browser, diagnostic };
  if (!diagnostic.request) throw new Error('recognition_request_not_observed');
} catch (error) {
  report = { status: 'fail', browser: report.browser, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  log('dune_bridge_trace_fail', report);
  process.exitCode = 1;
} finally {
  await writeFile(join(OUT, 'dune-bridge-trace.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(OUT, 'dune-bridge-trace.log'), `${logs.map((line) => JSON.stringify(line)).join('\n')}\n`);
  await context.close();
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}

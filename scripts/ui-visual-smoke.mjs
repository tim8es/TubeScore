import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const DIST = resolve('dist');
const OUT = resolve('ui-visual-artifacts');
const CASES = [
  {
    id: 'Mzw2ttJD2qQ',
    name: 'odyssey',
    title: /The Odyssey/i,
    expected: {
      'Rotten Tomatoes': '94/100',
      Metacritic: '89/100'
    }
  },
  {
    id: '8yh9BPUBbbQ',
    name: 'f1',
    title: /^.*F1.*$/i,
    expected: {
      IMDb: '7.6/10',
      'Rotten Tomatoes': '82/100',
      Metacritic: '68/100'
    }
  }
];

const HOSTS = {
  IMDb: new Set(['imdb.com', 'www.imdb.com']),
  'Rotten Tomatoes': new Set(['rottentomatoes.com', 'www.rottentomatoes.com']),
  Metacritic: new Set(['metacritic.com', 'www.metacritic.com']),
  Kinopoisk: new Set(['kinopoisk.ru', 'www.kinopoisk.ru'])
};

const report = { status: 'running', chromium: null, cases: [] };

async function dismissConsent(page) {
  for (const name of [/Reject all/i, /Accept all/i, /I agree/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(400);
      break;
    }
  }
}

async function waitForCard(page) {
  await page.waitForFunction(() => {
    const card = document.querySelector('.tubescore-card');
    return card && ['high', 'likely'].includes(card.getAttribute('data-tubescore-state') ?? '');
  }, null, { timeout: 120000 });
}

async function launch(profile) {
  return chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-features=Translate'
    ]
  });
}

async function inspectCase(root, testCase, index) {
  const context = await launch(join(root, `profile-${index}`));
  report.chromium ??= context.browser()?.version() ?? 'unknown';
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`https://www.youtube.com/watch?v=${testCase.id}&hl=en&gl=US`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await dismissConsent(page);
    await waitForCard(page);
    await page.locator('.tubescore-card').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);

    const snapshot = await page.locator('.tubescore-card').evaluate((card) => {
      const computed = getComputedStyle(card);
      return {
        state: card.getAttribute('data-tubescore-state'),
        text: card.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        cardStyle: {
          backgroundColor: computed.backgroundColor,
          borderRadius: computed.borderRadius,
          borderTopWidth: computed.borderTopWidth
        },
        badges: Array.from(card.querySelectorAll('.tubescore-card__rating')).map((badge) => ({
          tag: badge.tagName,
          source: badge.querySelector('.tubescore-card__rating-source')?.textContent?.trim() ?? '',
          value: badge.querySelector('.tubescore-card__rating-value')?.textContent?.trim() ?? '',
          href: badge instanceof HTMLAnchorElement ? badge.href : null,
          target: badge instanceof HTMLAnchorElement ? badge.target : null,
          rel: badge instanceof HTMLAnchorElement ? badge.rel : null,
          ariaLabel: badge.getAttribute('aria-label'),
          hasBrandSvg: Boolean(badge.querySelector('.tubescore-card__rating-icon svg'))
        }))
      };
    });

    if (!testCase.title.test(snapshot.text)) throw new Error(`wrong_title:${snapshot.text}`);
    if (/via Wikidata|Fresh|Generally favorable|No score yet|Open page/i.test(snapshot.text)) {
      throw new Error(`forbidden_rating_copy:${snapshot.text}`);
    }
    if (snapshot.cardStyle.borderRadius === '0px' || snapshot.cardStyle.borderTopWidth === '0px') {
      throw new Error(`card_not_styled:${JSON.stringify(snapshot.cardStyle)}`);
    }

    for (const [source, value] of Object.entries(testCase.expected)) {
      const badge = snapshot.badges.find((candidate) => candidate.source === source);
      if (!badge) throw new Error(`missing_badge:${source}:${JSON.stringify(snapshot.badges)}`);
      if (badge.value !== value) throw new Error(`wrong_value:${source}:${badge.value}:${value}`);
      if (badge.tag !== 'A' || !badge.href) throw new Error(`badge_not_linked:${source}:${JSON.stringify(badge)}`);
      const hostname = new URL(badge.href).hostname.toLowerCase();
      if (!HOSTS[source]?.has(hostname)) throw new Error(`wrong_platform_href:${source}:${badge.href}`);
      if (badge.target !== '_blank' || !badge.rel?.includes('noopener') || !badge.rel?.includes('noreferrer')) {
        throw new Error(`unsafe_link:${source}:${JSON.stringify(badge)}`);
      }
      if (!badge.ariaLabel?.includes(`open on ${source}`)) throw new Error(`missing_aria:${source}:${badge.ariaLabel}`);
      if (!badge.hasBrandSvg) throw new Error(`missing_brand_svg:${source}`);
    }

    const first = page.locator('a.tubescore-card__rating').first();
    const beforeHover = await first.evaluate((node) => getComputedStyle(node).backgroundColor);
    await first.hover();
    await page.waitForTimeout(180);
    const afterHover = await first.evaluate((node) => getComputedStyle(node).backgroundColor);
    if (beforeHover === afterHover) throw new Error(`hover_style_missing:${beforeHover}`);

    await first.focus();
    const focusStyle = await first.evaluate((node) => {
      const style = getComputedStyle(node);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor };
    });
    if (focusStyle.outlineStyle === 'none' || focusStyle.outlineWidth === '0px') {
      throw new Error(`focus_visible_missing:${JSON.stringify(focusStyle)}`);
    }

    const leakedClicks = await page.locator('.tubescore-card').evaluate((card) => {
      const parent = card.parentElement;
      const badge = card.querySelector('a.tubescore-card__rating');
      if (!parent || !badge) return -1;
      let leaked = 0;
      const parentHandler = () => { leaked += 1; };
      const preventNavigation = (event) => event.preventDefault();
      parent.addEventListener('click', parentHandler);
      badge.addEventListener('click', preventNavigation, { once: true });
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      parent.removeEventListener('click', parentHandler);
      return leaked;
    });
    if (leakedClicks !== 0) throw new Error(`youtube_click_leak:${leakedClicks}`);

    await page.screenshot({ path: join(OUT, `${testCase.name}-page.png`), fullPage: false });
    await page.locator('.tubescore-card').screenshot({ path: join(OUT, `${testCase.name}-card.png`) });

    const entry = { id: testCase.id, name: testCase.name, ...snapshot, beforeHover, afterHover, focusStyle, leakedClicks };
    report.cases.push(entry);
    console.log(JSON.stringify({ event: 'ui_visual_case_pass', ...entry }));
  } finally {
    await context.close();
  }
}

await mkdir(OUT, { recursive: true });
const root = await mkdtemp(join(tmpdir(), 'tubescore-ui-visual-'));
try {
  for (const [index, testCase] of CASES.entries()) await inspectCase(root, testCase, index);
  report.status = 'pass';
  console.log(JSON.stringify({ event: 'ui_visual_pass', chromium: report.chromium }));
} catch (error) {
  report.status = 'fail';
  report.error = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await writeFile(join(OUT, 'ui-visual-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await rm(root, { recursive: true, force: true }).catch(() => undefined);
}

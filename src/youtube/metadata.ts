import type { YouTubeVideoContext } from '../core/types';

function textContent(root: ParentNode, selectors: string[]): string {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return '';
}

function extractPublishedYear(document: Document): number | undefined {
  for (const selector of ['meta[itemprop="datePublished"]', 'meta[itemprop="uploadDate"]']) {
    const value = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();
    const match = value?.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function extractHashtags(document: Document, description: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string): void => {
    const value = raw.replace(/^#/, '').trim();
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    values.push(value);
  };

  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/hashtag/"]'))) {
    add(link.textContent ?? '');
  }

  for (const match of description.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    add(match[1] ?? '');
  }

  return values;
}

export function extractYouTubeVideoContext(
  document: Document,
  location: Pick<Location, 'href' | 'pathname' | 'search'>
): YouTubeVideoContext | null {
  if (location.pathname !== '/watch') return null;

  const videoId = new URLSearchParams(location.search).get('v')?.trim();
  if (!videoId) return null;

  const title = textContent(document, [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1 yt-formatted-string',
    'meta[name="title"]'
  ]);
  if (!title) return null;

  const description = textContent(document, [
    '#description-inline-expander',
    '#description',
    'ytd-text-inline-expander'
  ]);

  const channelName = textContent(document, [
    'ytd-channel-name #text a',
    '#owner #channel-name a',
    '#channel-name a'
  ]);

  const publishedYear = extractPublishedYear(document);

  return {
    videoId,
    title,
    description,
    channelName,
    hashtags: extractHashtags(document, description),
    url: location.href,
    ...(publishedYear === undefined ? {} : { publishedYear })
  };
}

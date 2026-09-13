import { describe, expect, it } from 'vitest';
import { extractYouTubeVideoContext } from '../../src/youtube/metadata';

describe('YouTube publish-year metadata', () => {
  it('extracts the publish year from YouTube datePublished metadata', () => {
    document.head.innerHTML = '<meta itemprop="datePublished" content="2026-09-02">';
    document.body.innerHTML = `
      <h1 class="ytd-watch-metadata"><yt-formatted-string>Harry Potter and the Philosopher's Stone | Official Teaser Trailer | HBO Max</yt-formatted-string></h1>
      <div id="description">Welcome to a new year at Hogwarts.</div>
      <ytd-channel-name><div id="text"><a>Harry Potter</a></div></ytd-channel-name>
    `;

    const result = extractYouTubeVideoContext(document, {
      href: 'https://www.youtube.com/watch?v=SJVmeJaS44s',
      pathname: '/watch',
      search: '?v=SJVmeJaS44s'
    } as Pick<Location, 'href' | 'pathname' | 'search'>);

    expect(result).not.toBeNull();
    expect((result as typeof result & { publishedYear?: number })?.publishedYear).toBe(2026);
  });
});

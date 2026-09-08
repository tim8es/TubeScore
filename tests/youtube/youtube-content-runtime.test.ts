import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecognitionResult, YouTubeVideoContext } from '../../src/core/types';
import { extractYouTubeVideoContext } from '../../src/youtube/metadata';
import { YouTubeContentRuntime } from '../../src/youtube/content-runtime';

function setWatchPage(videoId: string, title: string): void {
  history.pushState({}, '', `https://www.youtube.com/watch?v=${videoId}`);
  document.body.innerHTML = `
    <main>
      <h1 class="ytd-watch-metadata"><yt-formatted-string>${title}</yt-formatted-string></h1>
      <div id="description-inline-expander">A new sci-fi trailer. #Dune #SciFi</div>
      <ytd-channel-name><div id="text"><a>Warner Bros. Pictures</a></div></ytd-channel-name>
      <a href="/hashtag/dune">#Dune</a>
      <div id="above-the-fold"></div>
    </main>
  `;
}

function resultFor(title: string): RecognitionResult {
  return {
    decision: {
      state: 'high',
      score: {
        candidate: {
          providerId: title,
          mediaType: 'movie',
          title,
          releaseYear: 2024
        },
        confidence: 0.96,
        reasons: ['title-match']
      }
    },
    ratings: [{ source: 'TMDB', value: 8.1, scale: 10 }]
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  history.replaceState({}, '', 'https://www.youtube.com/');
});

describe('extractYouTubeVideoContext', () => {
  it('extracts watch-page metadata into the existing recognition context shape', () => {
    setWatchPage('abc123', 'Dune: Part Two | Official Trailer 3 (2024)');

    expect(extractYouTubeVideoContext(document, location)).toEqual<YouTubeVideoContext>({
      videoId: 'abc123',
      title: 'Dune: Part Two | Official Trailer 3 (2024)',
      description: 'A new sci-fi trailer. #Dune #SciFi',
      channelName: 'Warner Bros. Pictures',
      hashtags: ['Dune', 'SciFi'],
      url: 'https://www.youtube.com/watch?v=abc123'
    });
  });

  it('returns null outside a YouTube watch page', () => {
    history.replaceState({}, '', 'https://www.youtube.com/results?search_query=dune');
    expect(extractYouTubeVideoContext(document, location)).toBeNull();
  });
});

describe('YouTubeContentRuntime', () => {
  it('recognizes the current video and mounts a rating card', async () => {
    setWatchPage('first', 'Dune: Part Two | Official Trailer');
    const recognize = vi.fn(async (context: YouTubeVideoContext) => resultFor(context.title));
    const runtime = new YouTubeContentRuntime({ recognize });

    runtime.start();
    await runtime.whenIdle();

    expect(recognize).toHaveBeenCalledOnce();
    expect(recognize.mock.calls[0]![0].videoId).toBe('first');
    expect(document.querySelector('#above-the-fold > .tubescore-card')).not.toBeNull();
    expect(document.querySelector('.tubescore-card__title')?.textContent).toContain('Dune: Part Two');

    runtime.stop();
  });

  it('detects YouTube SPA navigation and recognizes the new video metadata', async () => {
    setWatchPage('first', 'First Movie | Official Trailer');
    const recognize = vi.fn(async (context: YouTubeVideoContext) => resultFor(context.title));
    const runtime = new YouTubeContentRuntime({ recognize });

    runtime.start();
    await runtime.whenIdle();

    setWatchPage('second', 'Second Movie | Official Trailer');
    window.dispatchEvent(new Event('yt-navigate-finish'));
    await runtime.whenIdle();

    expect(recognize).toHaveBeenCalledTimes(2);
    expect(recognize.mock.calls[1]![0].videoId).toBe('second');
    expect(document.querySelector('.tubescore-card__title')?.textContent).toContain('Second Movie');

    runtime.stop();
  });

  it('drops a stale recognition response after a faster SPA navigation completes', async () => {
    setWatchPage('first', 'First Movie | Official Trailer');

    let resolveFirst!: (result: RecognitionResult) => void;
    const first = new Promise<RecognitionResult>((resolve) => {
      resolveFirst = resolve;
    });

    const recognize = vi.fn((context: YouTubeVideoContext) => {
      if (context.videoId === 'first') return first;
      return Promise.resolve(resultFor('Second Movie'));
    });

    const runtime = new YouTubeContentRuntime({ recognize });
    runtime.start();

    setWatchPage('second', 'Second Movie | Official Trailer');
    window.dispatchEvent(new Event('yt-navigate-finish'));
    await runtime.whenIdle();

    expect(document.querySelector('.tubescore-card__title')?.textContent).toContain('Second Movie');

    resolveFirst(resultFor('First Movie'));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('.tubescore-card__title')?.textContent).toContain('Second Movie');
    expect(document.body.textContent).not.toContain('First Movie (2024)');

    runtime.stop();
  });

  it('removes the previous card when navigating away from a watch page', async () => {
    setWatchPage('first', 'First Movie | Official Trailer');
    const runtime = new YouTubeContentRuntime({
      recognize: async () => resultFor('First Movie')
    });

    runtime.start();
    await runtime.whenIdle();
    expect(document.querySelector('.tubescore-card')).not.toBeNull();

    history.pushState({}, '', 'https://www.youtube.com/');
    document.body.innerHTML = '<main>Home</main>';
    window.dispatchEvent(new Event('yt-navigate-finish'));
    await runtime.whenIdle();

    expect(document.querySelector('.tubescore-card')).toBeNull();
    runtime.stop();
  });
});

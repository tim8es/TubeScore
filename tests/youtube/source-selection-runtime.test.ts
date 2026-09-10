import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecognitionResult, YouTubeVideoContext } from '../../src/core/types';
import { YouTubeContentRuntime } from '../../src/youtube/content-runtime';

function setWatchPage(): void {
  history.replaceState({}, '', 'https://www.youtube.com/watch?v=abc123');
  document.body.innerHTML = `
    <main>
      <h1 class="ytd-watch-metadata"><yt-formatted-string>Everything Everywhere All at Once | Official Trailer</yt-formatted-string></h1>
      <div id="description-inline-expander">Official trailer</div>
      <ytd-channel-name><div id="text"><a>A24</a></div></ytd-channel-name>
      <div id="above-the-fold"></div>
    </main>
  `;
}

const result: RecognitionResult = {
  decision: {
    state: 'high',
    score: {
      candidate: {
        providerId: 'Q48252',
        mediaType: 'movie',
        title: 'Everything Everywhere All at Once',
        releaseYear: 2022
      },
      confidence: 0.98,
      reasons: ['title-match']
    }
  },
  ratings: [
    { source: 'IMDb via Wikidata', value: 7.7, scale: 10 },
    { source: 'Rotten Tomatoes via Wikidata', value: 93, scale: 100 }
  ]
};

beforeEach(() => {
  document.body.innerHTML = '';
  history.replaceState({}, '', 'https://www.youtube.com/');
});

describe('YouTube runtime source selection', () => {
  it('passes the current source selection into recognition and refreshes after the user changes it', async () => {
    setWatchPage();
    const recognize = vi.fn(async (_context: YouTubeVideoContext, _options?: { enabledSources?: readonly string[] }) => result);
    const save = vi.fn(async (_sources: string[]) => undefined);

    const runtime = new YouTubeContentRuntime({
      recognize,
      enabledSources: ['IMDb'],
      onEnabledSourcesChange: save
    } as unknown as ConstructorParameters<typeof YouTubeContentRuntime>[0]);

    runtime.start();
    await runtime.whenIdle();

    expect(recognize).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'abc123' }), {
      enabledSources: ['IMDb']
    });
    expect(Array.from(document.querySelectorAll('.tubescore-card__rating-source')).map((item) => item.textContent)).toEqual(['IMDb']);

    document.querySelector<HTMLButtonElement>('.tubescore-card__settings-button')?.click();
    const rotten = document.querySelector<HTMLInputElement>('[data-source-name="Rotten Tomatoes"]');
    expect(rotten).not.toBeNull();
    if (!rotten) return;
    rotten.checked = true;
    rotten.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.tubescore-card__settings-done')?.click();

    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(['IMDb', 'Rotten Tomatoes']));
    await runtime.whenIdle();
    expect(recognize).toHaveBeenLastCalledWith(expect.objectContaining({ videoId: 'abc123' }), {
      enabledSources: ['IMDb', 'Rotten Tomatoes']
    });

    runtime.stop();
  });
});

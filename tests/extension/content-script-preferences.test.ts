import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecognitionResult } from '../../src/core/types';

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

afterEach(() => {
  delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
});

describe('content script source preferences', () => {
  it('loads the saved source selection before first recognition and persists changes from the drawer', async () => {
    history.replaceState({}, '', 'https://www.youtube.com/watch?v=abc123');
    document.body.innerHTML = `
      <main>
        <h1 class="ytd-watch-metadata"><yt-formatted-string>Everything Everywhere All at Once | Official Trailer</yt-formatted-string></h1>
        <div id="description-inline-expander">Official trailer</div>
        <ytd-channel-name><div id="text"><a>A24</a></div></ytd-channel-name>
        <div id="above-the-fold"></div>
      </main>
    `;

    const get = vi.fn(async () => ({ enabledRatingSources: ['IMDb'] }));
    const set = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => ({ ok: true as const, result }));
    (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
      runtime: { sendMessage },
      storage: { local: { get, set } }
    };

    vi.resetModules();
    await import('../../src/extension/content-script');

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(get).toHaveBeenCalledWith('enabledRatingSources');
    expect(Array.from(document.querySelectorAll('.tubescore-card__rating-source')).map((item) => item.textContent)).toEqual(['IMDb']);

    document.querySelector<HTMLButtonElement>('.tubescore-card__settings-button')?.click();
    const rotten = document.querySelector<HTMLInputElement>('[data-source-name="Rotten Tomatoes"]');
    expect(rotten).not.toBeNull();
    if (!rotten) return;
    rotten.checked = true;
    rotten.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.tubescore-card__settings-done')?.click();

    await vi.waitFor(() => expect(set).toHaveBeenCalledWith({
      enabledRatingSources: ['IMDb', 'Rotten Tomatoes']
    }));
  });
});

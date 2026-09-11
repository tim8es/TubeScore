import { describe, expect, it, vi } from 'vitest';
import type { RecognitionResult } from '../../src/core/types';
import { renderRatingCard } from '../../src/ui/rating-card';

const result: RecognitionResult = {
  decision: {
    state: 'high',
    score: {
      confidence: 0.98,
      reasons: ['title-match'],
      candidate: {
        providerId: 'Q48252',
        mediaType: 'movie',
        title: 'Everything Everywhere All at Once',
        releaseYear: 2022
      }
    }
  },
  ratings: [
    { source: 'Kinopoisk via Wikidata', value: 7.3, scale: 10, url: 'https://www.kinopoisk.ru/film/1322324/' },
    { source: 'IMDb via Wikidata', value: 7.7, scale: 10, url: 'https://www.imdb.com/title/tt6710474/' },
    { source: 'Rotten Tomatoes via Wikidata', value: 93, scale: 100, url: 'https://www.rottentomatoes.com/m/everything_everywhere_all_at_once' },
    { source: 'Metacritic via Wikidata', value: 81, scale: 100, url: 'https://www.metacritic.com/movie/everything-everywhere-all-at-once' },
    { source: 'AllMovie via Wikidata', value: 6.7, scale: 10, url: 'https://www.allmovie.com/movie/-v727042' },
    { source: 'Letterboxd via Wikidata', value: 4.4, scale: 5, url: 'https://letterboxd.com/film/everything-everywhere-all-at-once/' }
  ]
};

type RenderOptions = {
  enabledSources?: readonly string[];
  onEnabledSourcesChange?: (sources: string[]) => void | Promise<void>;
};

const renderWithOptions = renderRatingCard as unknown as (
  value: RecognitionResult,
  options?: RenderOptions
) => HTMLElement;

function visibleSources(card: HTMLElement): string[] {
  return Array.from(card.querySelectorAll('.tubescore-card__rating-source'))
    .map((item) => item.textContent ?? '');
}

describe('TubeScore source settings UI', () => {
  it('uses the compact three-line design and enables only the recommended four services by default', () => {
    const card = renderWithOptions(result);

    expect(visibleSources(card)).toEqual([
      'Kinopoisk',
      'IMDb',
      'Rotten Tomatoes',
      'Metacritic'
    ]);
    expect(card.querySelector('.tubescore-card__settings-button')).not.toBeNull();
    expect(card.querySelector('.tubescore-card__title')?.textContent).toBe('Everything Everywhere All at Once');

    const style = document.querySelector('style[data-tubescore-styles]')?.textContent ?? '';
    expect(style).toContain('-webkit-line-clamp: 3');
    expect(style).toContain('.tubescore-card__settings-button');
  });

  it('opens an icon-only settings drawer, updates visible services, and reports the selection on Done', () => {
    const onEnabledSourcesChange = vi.fn();
    const card = renderWithOptions(result, { onEnabledSourcesChange });
    const gear = card.querySelector<HTMLButtonElement>('.tubescore-card__settings-button');
    expect(gear?.textContent?.trim()).toBe('');

    gear?.click();
    const panel = card.querySelector<HTMLElement>('.tubescore-card__settings-panel');
    expect(panel?.hidden).toBe(false);

    const checkedByName = () => Object.fromEntries(
      Array.from(card.querySelectorAll<HTMLInputElement>('.tubescore-card__source-checkbox'))
        .map((checkbox) => [checkbox.dataset.sourceName ?? '', checkbox.checked])
    );
    expect(checkedByName()).toMatchObject({
      Kinopoisk: true,
      IMDb: true,
      'Rotten Tomatoes': true,
      Metacritic: true,
      AllMovie: false,
      Letterboxd: false
    });

    const imdb = card.querySelector<HTMLInputElement>('[data-source-name="IMDb"]');
    const allMovie = card.querySelector<HTMLInputElement>('[data-source-name="AllMovie"]');
    expect(imdb).not.toBeNull();
    expect(allMovie).not.toBeNull();
    if (!imdb || !allMovie) return;

    imdb.checked = false;
    imdb.dispatchEvent(new Event('change', { bubbles: true }));
    allMovie.checked = true;
    allMovie.dispatchEvent(new Event('change', { bubbles: true }));

    expect(visibleSources(card)).toEqual([
      'Kinopoisk',
      'Rotten Tomatoes',
      'Metacritic',
      'AllMovie'
    ]);

    card.querySelector<HTMLButtonElement>('.tubescore-card__settings-done')?.click();
    expect(onEnabledSourcesChange).toHaveBeenCalledWith([
      'Kinopoisk',
      'Rotten Tomatoes',
      'Metacritic',
      'AllMovie'
    ]);
    expect(panel?.hidden).toBe(true);
  });

  it('keeps the gear in the metadata row and renders readable source rows with branded vectors', () => {
    const card = renderWithOptions(result);
    const metaRow = card.querySelector('.tubescore-card__meta-row');
    const gear = card.querySelector('.tubescore-card__settings-button');
    expect(metaRow).not.toBeNull();
    expect(metaRow?.contains(gear)).toBe(true);

    gear?.dispatchEvent(new Event('click', { bubbles: true }));
    const rows = Array.from(card.querySelectorAll<HTMLElement>('.tubescore-card__source-row'));
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      expect(row.children[0]?.classList.contains('tubescore-card__source-checkbox')).toBe(true);
      expect(row.children[1]?.classList.contains('tubescore-card__rating-icon')).toBe(true);
      expect(row.children[2]?.classList.contains('tubescore-card__source-name')).toBe(true);
    }

    for (const name of ['Kinopoisk', 'IMDb', 'Rotten Tomatoes', 'Metacritic']) {
      const icon = card.querySelector<HTMLElement>(`.tubescore-card__rating-icon[data-brand-source="${name}"]`);
      expect(icon).not.toBeNull();
      expect(icon?.querySelector('path')).not.toBeNull();
      expect(icon?.querySelector('text')).toBeNull();
    }

    const style = document.querySelector('style[data-tubescore-styles]')?.textContent ?? '';
    expect(style).toContain('grid-template-columns: 20px 28px minmax(0, 1fr)');
    expect(style).toContain('.tubescore-card__source-row .tubescore-card__rating-icon { grid-area: auto;');
    expect(style).toContain('top: calc(100% + 8px)');
    expect(style).toContain('left: 0');
    expect(style).toContain('.tubescore-card__source-name { overflow: visible;');
  });
});

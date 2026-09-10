import { describe, expect, it } from 'vitest';
import { renderRatingCard } from '../src/ui/rating-card';
import type { RecognitionResult } from '../src/core/types';

const base: RecognitionResult = {
  decision: {
    state: 'high',
    score: {
      confidence: 0.96,
      reasons: ['title-match', 'year-match'],
      candidate: {
        providerId: '693134',
        mediaType: 'movie',
        title: 'Dune: Part Two',
        releaseYear: 2024
      }
    }
  },
  ratings: [{ source: 'TMDB', value: 8.1, scale: 10, voteCount: 6000 }]
};

describe('renderRatingCard', () => {
  it('renders title, year, media type and rating for a high-confidence match', () => {
    const card = renderRatingCard(base);
    expect(card.dataset.tubescoreState).toBe('high');
    expect(card.querySelector('.tubescore-card__title')?.textContent).toBe('Dune: Part Two (2024)');
    expect(card.querySelector('.tubescore-card__meta')?.textContent).toBe('Movie');
    expect(card.querySelector('.tubescore-rating__source')?.textContent).toBe('TMDB');
    expect(card.querySelector('.tubescore-rating__value')?.textContent).toBe('8.1/10');
  });

  it('renders accessible source buttons with only brand and score, without leaking clicks to YouTube', () => {
    const card = renderRatingCard({
      ...base,
      ratings: [
        { source: 'IMDb via Wikidata', value: 8.4, scale: 10, url: 'https://www.imdb.com/title/tt15239678/' },
        { source: 'Rotten Tomatoes via Wikidata', value: 92, scale: 100, url: 'https://www.rottentomatoes.com/m/dune_part_two' },
        { source: 'Metacritic via Wikidata', value: 79, scale: 100, url: 'https://www.metacritic.com/movie/dune-part-two' }
      ]
    });

    const buttons = Array.from(card.querySelectorAll<HTMLAnchorElement>('.tubescore-rating'));
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.querySelector('.tubescore-rating__source')?.textContent)).toEqual([
      'IMDb',
      'Rotten Tomatoes',
      'Metacritic'
    ]);
    expect(buttons.map((button) => button.querySelector('.tubescore-rating__value')?.textContent)).toEqual([
      '8.4/10',
      '92/100',
      '79/100'
    ]);
    expect(buttons.map((button) => button.href)).toEqual([
      'https://www.imdb.com/title/tt15239678/',
      'https://www.rottentomatoes.com/m/dune_part_two',
      'https://www.metacritic.com/movie/dune-part-two'
    ]);

    for (const button of buttons) {
      expect(button.target).toBe('_blank');
      expect(button.rel).toContain('noopener');
      expect(button.rel).toContain('noreferrer');
      expect(button.getAttribute('aria-label')).toMatch(/^Open .+ rating for Dune: Part Two \(2024\) in a new tab$/);
      expect(button.querySelector('.tubescore-rating__icon svg')).not.toBeNull();
    }

    expect(card.textContent).not.toContain('via Wikidata');
    expect(card.textContent).not.toContain('Fresh');
    expect(card.textContent).not.toContain('Generally favorable');
    expect(card.textContent).not.toContain('No score yet');
    expect(card.textContent).not.toContain('Open page');

    const host = document.createElement('div');
    let bubbledClicks = 0;
    host.addEventListener('click', () => { bubbledClicks += 1; });
    host.append(card);
    buttons[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(bubbledClicks).toBe(0);

    const style = document.querySelector<HTMLStyleElement>('#tubescore-card-styles');
    expect(style?.textContent).toContain('.tubescore-rating:hover');
    expect(style?.textContent).toContain('.tubescore-rating:focus-visible');
  });

  it('labels likely matches instead of presenting them as certain', () => {
    const card = renderRatingCard({
      ...base,
      decision: { ...base.decision, state: 'likely' }
    });
    expect(card.textContent).toContain('Likely');
  });
});

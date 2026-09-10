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
    expect(card.textContent).toContain('Dune: Part Two');
    expect(card.textContent).toContain('2024');
    expect(card.textContent).toContain('Movie');
    expect(card.textContent).toContain('TMDB 8.1/10');
  });

  it('renders multiple rating sources in the supplied priority order', () => {
    const card = renderRatingCard({
      ...base,
      ratings: [
        { source: 'IMDb via Wikidata', value: 8.4, scale: 10 },
        { source: 'Rotten Tomatoes via Wikidata', value: 92, scale: 100 },
        { source: 'Metacritic via Wikidata', value: 79, scale: 100 }
      ]
    });

    expect(Array.from(card.querySelectorAll('.tubescore-card__rating')).map((item) => item.textContent)).toEqual([
      'IMDb via Wikidata 8.4/10',
      'Rotten Tomatoes via Wikidata 92/100',
      'Metacritic via Wikidata 79/100'
    ]);
  });

  it('labels likely matches instead of presenting them as certain', () => {
    const card = renderRatingCard({
      ...base,
      decision: { ...base.decision, state: 'likely' }
    });
    expect(card.textContent).toContain('Likely');
  });
});

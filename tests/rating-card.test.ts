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
    const card = renderRatingCard(base, { enabledSources: ['TMDB'] });
    expect(card.dataset.tubescoreState).toBe('high');
    expect(card.textContent).toContain('Dune: Part Two');
    expect(card.textContent).toContain('2024');
    expect(card.textContent).toContain('Movie');
    expect(card.querySelector('.tubescore-card__rating-source')?.textContent).toBe('TMDB');
    expect(card.querySelector('.tubescore-card__rating-value')?.textContent).toBe('8.1/10');
  });

  it('renders multiple rating sources in the supplied priority order without provenance copy', () => {
    const card = renderRatingCard({
      ...base,
      ratings: [
        { source: 'IMDb via Wikidata', value: 8.4, scale: 10 },
        { source: 'Rotten Tomatoes via Wikidata', value: 92, scale: 100 },
        { source: 'Metacritic via Wikidata', value: 79, scale: 100 }
      ]
    });

    expect(Array.from(card.querySelectorAll('.tubescore-card__rating-source')).map((item) => item.textContent)).toEqual([
      'IMDb',
      'Rotten Tomatoes',
      'Metacritic'
    ]);
    expect(Array.from(card.querySelectorAll('.tubescore-card__rating-value')).map((item) => item.textContent)).toEqual([
      '8.4/10',
      '92/100',
      '79/100'
    ]);
    expect(card.textContent).not.toContain('via Wikidata');
  });

  it('labels likely matches instead of presenting them as certain', () => {
    const card = renderRatingCard({
      ...base,
      decision: { ...base.decision, state: 'likely' }
    });
    expect(card.textContent).toContain('Likely');
  });

  it('renders a platform rating as an accessible native-style link without leaking interaction', () => {
    const card = renderRatingCard({
      ...base,
      ratings: [{
        source: 'IMDb via Wikidata',
        value: 8.4,
        scale: 10,
        url: 'https://www.imdb.com/title/tt15239678/'
      }]
    });
    const badge = card.querySelector<HTMLAnchorElement>('.tubescore-card__rating');
    expect(badge?.tagName).toBe('A');
    expect(badge?.href).toBe('https://www.imdb.com/title/tt15239678/');
    expect(badge?.target).toBe('_blank');
    expect(badge?.rel).toContain('noopener');
    expect(badge?.rel).toContain('noreferrer');
    expect(badge?.getAttribute('aria-label')).toBe('IMDb 8.4 out of 10 — open on IMDb');
    expect(badge?.querySelector('.tubescore-card__rating-source')?.textContent).toBe('IMDb');
    expect(badge?.querySelector('.tubescore-card__rating-value')?.textContent).toBe('8.4/10');
    expect(badge?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(card.textContent).not.toContain('via Wikidata');
    expect(card.textContent).not.toContain('Fresh');
    expect(card.textContent).not.toContain('Open page');
    expect(card.textContent).not.toContain('No score yet');

    const host = document.createElement('div');
    let leakedClicks = 0;
    let leakedKeys = 0;
    host.addEventListener('click', () => { leakedClicks += 1; });
    host.addEventListener('keydown', () => { leakedKeys += 1; });
    host.append(card);
    badge?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    badge?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(leakedClicks).toBe(0);
    expect(leakedKeys).toBe(0);

    const style = document.querySelector('style[data-tubescore-styles]')?.textContent ?? '';
    expect(style).toContain('a.tubescore-card__rating:hover');
    expect(style).toContain('a.tubescore-card__rating:focus-visible');
    expect(style).toContain('--tubescore-surface: #f2f2f2');
    expect(style).toContain('html[dark] .tubescore-card');
  });

  it('does not turn a Wikidata provenance URL into a fake platform link', () => {
    const card = renderRatingCard({
      ...base,
      ratings: [{
        source: 'IMDb via Wikidata',
        value: 8.4,
        scale: 10,
        url: 'https://www.wikidata.org/wiki/Q109228991'
      }]
    });
    expect(card.querySelector('.tubescore-card__rating')?.tagName).toBe('SPAN');
    expect(card.querySelector('.tubescore-card__rating-arrow')).toBeNull();
  });
});

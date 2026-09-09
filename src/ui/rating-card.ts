import type { RecognitionResult } from '../core/types';

function mediaTypeLabel(mediaType: 'movie' | 'tv'): string {
  return mediaType === 'movie' ? 'Movie' : 'TV';
}

function formatRating(source: string, value: number, scale: number): string {
  return `${source} ${value}/${scale}`;
}

export function renderUnavailableCard(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = 'error';

  const header = document.createElement('div');
  header.className = 'tubescore-card__brand';
  header.textContent = 'TubeScore · Unavailable';

  const message = document.createElement('span');
  message.className = 'tubescore-card__meta';
  message.textContent = 'Ratings could not be loaded.';

  card.append(header, message);
  return card;
}

export function renderRatingCard(result: RecognitionResult): HTMLElement {
  const card = document.createElement('section');
  card.className = 'tubescore-card';
  card.dataset.tubescoreState = result.decision.state;

  if (result.decision.state === 'hidden') {
    card.hidden = true;
    return card;
  }

  const { candidate } = result.decision.score;

  const header = document.createElement('div');
  header.className = 'tubescore-card__brand';
  header.textContent = result.decision.state === 'likely' ? 'TubeScore · Likely' : 'TubeScore';

  const title = document.createElement('strong');
  title.className = 'tubescore-card__title';
  title.textContent = candidate.releaseYear
    ? `${candidate.title} (${candidate.releaseYear})`
    : candidate.title;

  const meta = document.createElement('span');
  meta.className = 'tubescore-card__meta';
  meta.textContent = mediaTypeLabel(candidate.mediaType);

  const ratings = document.createElement('div');
  ratings.className = 'tubescore-card__ratings';

  if (result.ratings.length === 0) {
    const item = document.createElement('span');
    item.className = 'tubescore-card__rating';
    item.textContent = 'No rating available';
    ratings.append(item);
  } else {
    for (const rating of result.ratings) {
      const item = document.createElement('span');
      item.className = 'tubescore-card__rating';
      item.textContent = formatRating(rating.source, rating.value, rating.scale);
      ratings.append(item);
    }
  }

  card.append(header, title, meta, ratings);
  return card;
}

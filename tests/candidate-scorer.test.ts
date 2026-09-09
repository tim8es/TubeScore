import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '../src/core/candidate-scorer';
import type { CatalogCandidate, YouTubeVideoContext } from '../src/core/types';

const context: YouTubeVideoContext = {
  videoId: 'abc123',
  title: 'Dune: Part Two | Official Trailer 3 (2024) 4K',
  description: 'Warner Bros. Pictures presents Dune: Part Two.',
  channelName: 'Warner Bros. Pictures',
  hashtags: ['DunePartTwo'],
  url: 'https://www.youtube.com/watch?v=abc123'
};

const correct: CatalogCandidate = {
  providerId: '693134',
  mediaType: 'movie',
  title: 'Dune: Part Two',
  releaseYear: 2024
};

const wrongYear: CatalogCandidate = {
  providerId: '841',
  mediaType: 'movie',
  title: 'Dune',
  releaseYear: 1984
};

describe('scoreCandidate', () => {
  it('scores a near-exact title with matching year as high confidence', () => {
    const score = scoreCandidate(context, correct);
    expect(score.confidence).toBeGreaterThanOrEqual(0.9);
    expect(score.reasons).toContain('title-match');
    expect(score.reasons).toContain('year-match');
  });

  it('penalizes a title/year collision enough to keep it below likely threshold', () => {
    const score = scoreCandidate(context, wrongYear);
    expect(score.confidence).toBeLessThan(0.75);
    expect(score.reasons).toContain('year-mismatch');
  });
});

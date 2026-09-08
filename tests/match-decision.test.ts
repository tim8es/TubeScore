import { describe, expect, it } from 'vitest';
import { decideMatch } from '../src/core/match-decision';
import type { CatalogCandidate, MatchScore } from '../src/core/types';

const candidate: CatalogCandidate = {
  providerId: '693134',
  mediaType: 'movie',
  title: 'Dune: Part Two',
  releaseYear: 2024
};

const score = (confidence: number): MatchScore => ({ candidate, confidence, reasons: [] });

describe('decideMatch', () => {
  it('classifies confidence at 0.90 as high', () => {
    expect(decideMatch(score(0.9)).state).toBe('high');
  });

  it('classifies confidence at 0.75 as likely', () => {
    expect(decideMatch(score(0.75)).state).toBe('likely');
  });

  it('hides confidence below 0.75', () => {
    expect(decideMatch(score(0.749)).state).toBe('hidden');
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeYouTubeTitle } from '../src/core/normalize';

 describe('normalizeYouTubeTitle', () => {
  it('removes common trailer noise while preserving identifying title tokens', () => {
    expect(normalizeYouTubeTitle('Dune: Part Two | Official Trailer 3 (2024) 4K')).toBe('dune part two 2024');
  });

  it('removes review boilerplate without deleting the media title', () => {
    expect(normalizeYouTubeTitle('Severance Season 2 Review - Ending Explained')).toBe('severance season 2');
  });
});

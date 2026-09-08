import type { MatchDecision, MatchScore } from './types';

export const HIGH_CONFIDENCE_THRESHOLD = 0.9;
export const LIKELY_CONFIDENCE_THRESHOLD = 0.75;

export function decideMatch(score: MatchScore): MatchDecision {
  if (score.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return { state: 'high', score };
  }

  if (score.confidence >= LIKELY_CONFIDENCE_THRESHOLD) {
    return { state: 'likely', score };
  }

  return { state: 'hidden', score };
}

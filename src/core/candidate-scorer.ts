import {
  extractFourDigitYear,
  normalizeYouTubeTitle,
  primaryYouTubeTitle
} from './normalize';
import type { CatalogCandidate, MatchScore, YouTubeVideoContext } from './types';

function withoutYear(value: string): string {
  return value.replace(/\b(19\d{2}|20\d{2}|21\d{2})\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractFourDigitYears(value: string): number[] {
  return [...value.matchAll(/\b(19\d{2}|20\d{2}|21\d{2})\b/g)]
    .map((match) => Number(match[1]));
}

function tokenSet(value: string): Set<string> {
  return new Set(value.split(' ').filter(Boolean));
}

function titleSimilarity(contextTitle: string, candidateTitle: string): number {
  if (!contextTitle || !candidateTitle) return 0;
  if (contextTitle === candidateTitle) return 1;

  const contextTokens = tokenSet(contextTitle);
  const candidateTokens = tokenSet(candidateTitle);
  const intersection = [...candidateTokens].filter((token) => contextTokens.has(token)).length;
  const candidateCoverage = candidateTokens.size === 0 ? 0 : intersection / candidateTokens.size;
  const contextCoverage = contextTokens.size === 0 ? 0 : intersection / contextTokens.size;

  return (candidateCoverage * 0.65) + (contextCoverage * 0.35);
}

export function scoreCandidate(
  context: YouTubeVideoContext,
  candidate: CatalogCandidate
): MatchScore {
  const normalizedContext = primaryYouTubeTitle(context.title);
  const titleYear = extractFourDigitYear(context.title);
  const descriptionYears = titleYear === undefined ? extractFourDigitYears(context.description) : [];
  const contextTitle = withoutYear(normalizedContext);
  const candidateTitle = withoutYear(normalizeYouTubeTitle(candidate.title));
  const originalTitle = candidate.originalTitle
    ? withoutYear(normalizeYouTubeTitle(candidate.originalTitle))
    : '';

  const similarity = Math.max(
    titleSimilarity(contextTitle, candidateTitle),
    originalTitle ? titleSimilarity(contextTitle, originalTitle) : 0
  );

  const reasons: string[] = [];
  let confidence = similarity * 0.82;

  if (similarity >= 0.95) reasons.push('title-match');
  else if (similarity >= 0.7) reasons.push('title-near-match');
  else reasons.push('title-weak-match');

  if (candidate.releaseYear !== undefined) {
    if (titleYear !== undefined) {
      if (titleYear === candidate.releaseYear) {
        confidence += 0.18;
        reasons.push('year-match');
      } else {
        confidence -= 0.25;
        reasons.push('year-mismatch');
      }
    } else if (descriptionYears.includes(candidate.releaseYear)) {
      confidence += 0.18;
      reasons.push('year-match');
    } else if (descriptionYears.length === 1) {
      confidence -= 0.25;
      reasons.push('year-mismatch');
    }
  }

  if (contextTitle.length <= 4 && similarity < 1) {
    confidence -= 0.12;
    reasons.push('short-title-collision');
  }

  return {
    candidate,
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(3)))),
    reasons
  };
}

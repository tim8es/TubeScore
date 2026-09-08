const NOISE_PATTERNS = [
  /\bofficial\s+(?:trailer|teaser)\b/gi,
  /\b(?:trailer|teaser)\s*\d*\b/gi,
  /\b4k\b/gi,
  /\buhd\b/gi,
  /\bhd\b/gi,
  /\breview\b/gi,
  /\bending\s+explained\b/gi,
  /\breaction\b/gi
];

export function normalizeYouTubeTitle(input: string): string {
  let value = input.normalize('NFKD');

  for (const pattern of NOISE_PATTERNS) {
    value = value.replace(pattern, ' ');
  }

  return value
    .replace(/[|•·–—:()[\]{}]/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/['-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

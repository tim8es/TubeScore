const NOISE_PATTERNS = [
  /\bofficial\s+(?:trailer|teaser)\s*\d*\b/gi,
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

export function primaryYouTubeTitle(input: string): string {
  const [primary = input] = input.split(/\s[|•·–—]\s/, 1);
  return normalizeYouTubeTitle(primary);
}

export function extractFourDigitYear(input: string): number | undefined {
  const match = input.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

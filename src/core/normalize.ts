const NOISE_PATTERNS = [
  /(?:официальный\s+)?(?:русский\s+)?(?:трейлер|тизер)\s*\d*/giu,
  /(?:офіційний\s+)?(?:український\s+)?(?:трейлер|тизер)\s*\d*/giu,
  /(?:tráiler|trailer)\s+oficial\s*\d*/giu,
  /avance\s+oficial\s*\d*/giu,
  /offizieller\s+(?:trailer|teaser)\s*\d*/giu,
  /bande[-\s]?annonce\s*(?:officielle?)?\s*\d*/giu,
  /(?:trailer|teaser)\s+ufficiale\s*\d*/giu,
  /(?:trailer|teaser)\s+oficial\s*\d*/giu,
  /(?:oficjalny\s+)?zwiastun\s*\d*/giu,
  /(?:resmi\s+)?fragman\s*\d*/giu,
  /(?:公式\s*)?(?:予告編|予告)/gu,
  /(?:공식\s*)?예고편/gu,
  /(?:官方\s*)?(?:预告片|預告片|预告|預告)/gu,
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
  let value = input.normalize('NFKC');

  for (const pattern of NOISE_PATTERNS) {
    value = value.replace(pattern, ' ');
  }

  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
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

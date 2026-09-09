export interface ProductionProxyRuntimeConfig {
  tmdbAccessToken?: string;
  allowedOrigins: string[];
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

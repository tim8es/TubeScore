import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ManifestShape {
  manifest_version?: number;
  background?: { service_worker?: string };
  content_scripts?: Array<{ matches?: string[]; js?: string[] }>;
  host_permissions?: string[];
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as ManifestShape;

describe('Chrome extension manifest', () => {
  it('declares Manifest V3 with the bundled service worker and YouTube content script', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBe('service-worker.js');
    expect(manifest.content_scripts).toEqual([
      {
        matches: ['https://www.youtube.com/*'],
        js: ['content-script.js']
      }
    ]);
  });

  it('limits network host access to TMDB for background orchestration', () => {
    expect(manifest.host_permissions).toEqual(['https://api.themoviedb.org/*']);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ManifestShape {
  manifest_version?: number;
  background?: { service_worker?: string };
  content_scripts?: Array<{ matches?: string[]; js?: string[] }>;
  permissions?: string[];
  host_permissions?: string[];
  options_page?: string;
  web_accessible_resources?: unknown[];
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

  it('uses only local storage permission and TMDB host access', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual(['https://api.themoviedb.org/*']);
  });

  it('does not expose developer bootstrap or web-accessible resources in the source manifest', () => {
    expect(manifest.options_page).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});

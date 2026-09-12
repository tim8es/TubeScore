import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ManifestShape {
  manifest_version?: number;
  name?: string;
  version?: string;
  description?: string;
  icons?: Record<string, string>;
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

  it('uses only local storage plus the zero-token Wikidata host', () => {
    expect(manifest.permissions ?? []).toEqual(['storage']);
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest.permissions).not.toContain('history');
    expect(manifest.permissions).not.toContain('cookies');
    expect(manifest.host_permissions).toEqual(['https://www.wikidata.org/*']);
    expect(JSON.stringify(manifest)).not.toContain('imdb.com');
  });

  it('declares the Chrome Web Store icon set and release metadata', () => {
    expect(manifest.name).toBe('TubeScore');
    expect(manifest.version).toBe('0.2.3');
    expect(manifest.description).toBe('Movie and TV ratings directly on YouTube videos and trailers.');
    expect(manifest.icons).toEqual({
      '16': 'assets/icon16.png',
      '32': 'assets/icon32.png',
      '48': 'assets/icon48.png',
      '128': 'assets/icon128.png'
    });
  });

  it('does not expose developer bootstrap or web-accessible resources in the source manifest', () => {
    expect(manifest.options_page).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});

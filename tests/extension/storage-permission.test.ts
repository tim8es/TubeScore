import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('source preferences manifest permission', () => {
  it('uses only local extension storage in addition to the existing zero-token Wikidata host', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
      permissions?: string[];
      host_permissions?: string[];
    };

    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual(['https://www.wikidata.org/*']);
  });
});

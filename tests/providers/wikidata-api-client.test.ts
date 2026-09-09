import { describe, expect, it, vi } from 'vitest';
import { WikidataApiClient } from '../../src/providers/wikidata/wikidata-public-provider';

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('WikidataApiClient', () => {
  it('caches successful GET payloads by URL', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ ok: true }));
    const client = new WikidataApiClient({ fetchFn, cacheTtlMs: 60_000 });
    const url = new URL('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Dune');

    await expect(client.getJson(url)).resolves.toEqual({ ok: true });
    await expect(client.getJson(url)).resolves.toEqual({ ok: true });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same URL', async () => {
    const pending = deferredResponse();
    const fetchFn = vi.fn(async () => pending.promise);
    const client = new WikidataApiClient({ fetchFn });
    const url = new URL('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1');

    const first = client.getJson(url);
    const second = client.getJson(url);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    pending.resolve(jsonResponse({ entities: { Q1: {} } }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { entities: { Q1: {} } },
      { entities: { Q1: {} } }
    ]);
  });

  it('bounds concurrent network requests', async () => {
    const pending = [deferredResponse(), deferredResponse(), deferredResponse()];
    let started = 0;
    const fetchFn = vi.fn(async () => pending[started++]!.promise);
    const client = new WikidataApiClient({ fetchFn, maxConcurrent: 2 });

    const requests = [1, 2, 3].map((id) =>
      client.getJson(new URL(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q${id}`))
    );

    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    pending[0]!.resolve(jsonResponse({ id: 1 }));
    await requests[0];
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(3);

    pending[1]!.resolve(jsonResponse({ id: 2 }));
    pending[2]!.resolve(jsonResponse({ id: 3 }));
    await expect(Promise.all(requests)).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('retries 429 using Retry-After seconds without leaking credentials', async () => {
    const sleepFn = vi.fn(async (_ms: number) => undefined);
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new WikidataApiClient({ fetchFn, sleepFn, max429Retries: 1 });

    await expect(client.getJson(new URL('https://www.wikidata.org/w/api.php?action=query')))
      .resolves.toEqual({ ok: true });
    expect(sleepFn).toHaveBeenCalledWith(2000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    for (const [, init] of fetchFn.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('Api-User-Agent')).toContain('TubeScore/');
      expect(headers.has('authorization')).toBe(false);
    }
  });

  it('caps Retry-After and surfaces 429 after retry budget is exhausted', async () => {
    const sleepFn = vi.fn(async (_ms: number) => undefined);
    const fetchFn = vi.fn(async () => jsonResponse({}, 429, { 'Retry-After': '9999' }));
    const client = new WikidataApiClient({
      fetchFn,
      sleepFn,
      max429Retries: 1,
      maxRetryAfterMs: 5000
    });

    await expect(client.getJson(new URL('https://www.wikidata.org/w/api.php?action=query')))
      .rejects.toMatchObject({ code: 'http_error', status: 429 });
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).toHaveBeenCalledWith(5000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

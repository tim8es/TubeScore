import { access, readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if ('options_page' in manifest) throw new Error('standard_build_contains_options_page');
if (await exists('dist/dev-bootstrap.js')) throw new Error('standard_build_contains_dev_bootstrap_js');
if (await exists('dist/dev-bootstrap.html')) throw new Error('standard_build_contains_dev_bootstrap_html');

for (const size of [16, 32, 48, 128]) {
  const path = `dist/assets/icon${size}.png`;
  if (!(await exists(path))) throw new Error(`standard_build_missing_icon:${path}`);
}

const worker = await readFile('dist/service-worker.js', 'utf8');
for (const forbidden of [
  'tubescoreRuntimeConfig',
  'tmdbAccessToken',
  'api.themoviedb.org',
  'chrome.storage',
  'v3.sg.media-imdb.com',
  'datasets.imdbws.com'
]) {
  if (worker.includes(forbidden)) {
    throw new Error(`standard_worker_contains_forbidden_runtime_dependency:${forbidden}`);
  }
}

for (const required of [
  'www.wikidata.org/w/api.php',
  'wbsearchentities',
  'wbgetentities',
  'Api-User-Agent'
]) {
  if (!worker.includes(required)) {
    throw new Error(`standard_worker_missing_public_provider:${required}`);
  }
}

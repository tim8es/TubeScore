import { access, readFile } from 'node:fs/promises';

const mode = process.argv[2];
if (mode !== 'standard' && mode !== 'dev') {
  throw new Error('usage: node scripts/verify-build.mjs <standard|dev>');
}

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (mode === 'standard') {
  if ('options_page' in manifest) throw new Error('standard_build_contains_options_page');
  if (await exists('dist/dev-bootstrap.js')) throw new Error('standard_build_contains_dev_bootstrap_js');
  if (await exists('dist/dev-bootstrap.html')) throw new Error('standard_build_contains_dev_bootstrap_html');

  const worker = await readFile('dist/service-worker.js', 'utf8');
  for (const forbidden of [
    'tubescoreRuntimeConfig',
    'tmdbAccessToken',
    'api.themoviedb.org',
    'chrome.storage'
  ]) {
    if (worker.includes(forbidden)) {
      throw new Error(`standard_worker_contains_forbidden_runtime_dependency:${forbidden}`);
    }
  }
  for (const required of ['v3.sg.media-imdb.com', 'www.imdb.com/title']) {
    if (!worker.includes(required)) {
      throw new Error(`standard_worker_missing_public_provider:${required}`);
    }
  }
} else {
  if (manifest.options_page !== 'dev-bootstrap.html') throw new Error('dev_build_missing_options_page');
  if (!(await exists('dist/dev-bootstrap.js'))) throw new Error('dev_build_missing_bootstrap_js');
  if (!(await exists('dist/dev-bootstrap.html'))) throw new Error('dev_build_missing_bootstrap_html');
}

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const devBootstrap = process.argv.includes('--dev-bootstrap');

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const entryPoints = {
  'content-script': 'src/extension/content-script.ts',
  'service-worker': 'src/extension/service-worker.ts',
  ...(devBootstrap ? { 'dev-bootstrap': 'src/extension/dev-bootstrap.ts' } : {})
};

await build({
  entryPoints,
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: false,
  minify: false
});

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
if (devBootstrap) {
  manifest.options_page = 'dev-bootstrap.html';
  await copyFile('dev-bootstrap.html', 'dist/dev-bootstrap.html');
}
await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

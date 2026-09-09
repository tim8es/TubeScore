import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await build({
  entryPoints: {
    'content-script': 'src/extension/content-script.ts',
    'service-worker': 'src/extension/service-worker.ts'
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: false,
  minify: false
});

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

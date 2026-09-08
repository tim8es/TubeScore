import { copyFile, mkdir, rm } from 'node:fs/promises';
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

await copyFile('manifest.json', 'dist/manifest.json');

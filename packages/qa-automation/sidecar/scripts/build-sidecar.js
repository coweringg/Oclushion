import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'dist');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

async function build() {
  console.log('Building Oclushion QA Sidecar...');

  const result = await esbuild.build({
    entryPoints: [resolve(root, 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: resolve(outDir, 'index.js'),
    sourcemap: false,
    minify: true,
    external: [
      '@browserbasehq/stagehand',
      'playwright-core',
      'pixelmatch',
      'pngjs',
    ],
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },
  });

  if (result.errors.length > 0) {
    console.error('Build failed:');
    for (const err of result.errors) {
      console.error(`  ${err.text}`);
    }
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('Build warnings:');
    for (const warn of result.warnings) {
      console.warn(`  ${warn.text}`);
    }
  }

  console.log(`Build complete: ${resolve(outDir, 'index.js')}`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});

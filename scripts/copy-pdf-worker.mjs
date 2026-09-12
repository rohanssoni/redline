/**
 * Puts the pdf.js worker where the browser can fetch it.
 *
 * pdf.js parses in a worker, and the worker has to be served as its own file.
 * Copying it out of the package at install and build time keeps a megabyte of
 * vendor build output out of the repository while keeping the parser working on
 * a clean checkout and on Vercel.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  const source = join(
    dirname(require.resolve('pdfjs-dist/package.json')),
    'build',
    'pdf.worker.min.mjs',
  );
  const destination = join(root, 'public', 'pdf.worker.min.mjs');
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  console.log('pdf.js worker copied to public/pdf.worker.min.mjs');
} catch (error) {
  console.error('Could not copy the pdf.js worker:', error.message);
  process.exitCode = 1;
}

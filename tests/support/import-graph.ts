import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * What a file of this repo can actually run, by walking its imports.
 *
 * A behavioural assertion says a model was not called on the run the test made.
 * This says a model cannot be called on any run, because there is no path from
 * the seed file to `lib/model/` for one to be called through. The two together
 * are what "this path makes no model call" means.
 */

const ROOT = process.cwd();

/**
 * Every file of this repo's own source that the seed file reaches, directly or
 * through another of its imports. Packages are left alone: what is being
 * checked is which of Redline's own modules a file can run.
 */
export function importsReachedFrom(seed: string): string[] {
  const seen = new Set<string>();
  const queue = [resolve(ROOT, seed)];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    // Type-only imports are erased before anything runs, so they are not a way
    // to reach anything. What is being traced here is what the file can call.
    const specifiers = [
      ...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+([^;]*?)from\s+'([^']+)'/g),
    ]
      .filter((match) => !/^type\b/.test(match[1].trim()))
      .map((match) => match[2]);
    for (const specifier of specifiers) {
      const target = resolveImport(file, specifier);
      if (target) queue.push(target);
    }
  }

  seen.delete(resolve(ROOT, seed));
  return [...seen];
}

/** Where an import specifier lands in this repo, or null if it leaves it. */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? resolve(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

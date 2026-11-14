// Tests of the architecture itself. They read the source files, not the behaviour.
// They make the boundaries of the design a fact that fails loudly, not an agreement that people forget.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['shared', 'server', 'web/src', 'scripts', 'tests', 'fixtures'];

type Entry = { level: number; modified?: number[]; role: string };
const levels = JSON.parse(readFileSync(join(ROOT, 'levels.json'), 'utf8')) as { files: Record<string, Entry> };

function walk(dir: string): string[] {
  let found: string[] = [];
  let names: string[];
  try {
    names = readdirSync(join(ROOT, dir));
  } catch {
    return found; // a folder of a later level
  }
  for (const name of names) {
    const path = dir + '/' + name;
    if (statSync(join(ROOT, path)).isDirectory()) found = found.concat(walk(path));
    else if (/\.(ts|tsx|sql|md|css|csv)$/.test(name) && !name.endsWith('.d.ts')) found.push(path);
  }
  return found;
}
const files = SOURCE_DIRS.flatMap(walk).sort();

/** The files that a file imports, as paths from the root with "/" (the same on Windows). */
function importsOf(file: string): { local: string[]; packages: string[] } {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const local: string[] = [];
  const packages: string[] = [];
  // Static imports (on a line that starts with import or export), dynamic imports and require,
  // with single or double quotes. A sentence in a comment that has the word "from" is not an import.
  const found = [
    ...text.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/gm),
    ...text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
    ...text.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];
  for (const m of found) {
    const target = m[1]!;
    if (target.startsWith('.')) local.push(posix.normalize(posix.join(posix.dirname(file), target)));
    else packages.push(target);
  }
  return { local, packages };
}
const isCode = (file: string) => /\.tsx?$/.test(file);
const isTest = (file: string) => file.endsWith('.test.ts') || file.startsWith('tests/');
const reachedLevel = (file: string) => Math.max(levels.files[file]!.level, ...(levels.files[file]!.modified ?? []));

test('levels.json names each source file, and each file that it names exists', () => {
  expect(Object.keys(levels.files).filter((f) => SOURCE_DIRS.some((d) => f.startsWith(d + '/'))).sort()).toEqual(files);
});

test('shared/ imports only shared/ and zod: the contracts depend on nothing of the server or the web', () => {
  for (const file of files.filter((f) => f.startsWith('shared/') && isCode(f) && !isTest(f))) {
    const { local, packages } = importsOf(file);
    expect(local.filter((t) => !t.startsWith('shared/')), file).toEqual([]);
    expect(packages.filter((p) => p !== 'zod'), file).toEqual([]);
  }
});

test('the web application imports only web/ and shared/: it reaches the server only through HTTP', () => {
  for (const file of files.filter((f) => f.startsWith('web/') && isCode(f))) {
    expect(importsOf(file).local.filter((t) => !t.startsWith('web/') && !t.startsWith('shared/')), file).toEqual([]);
  }
});

test('the server does not import the web application', () => {
  for (const file of files.filter((f) => f.startsWith('server/') && isCode(f))) {
    expect(importsOf(file).local.filter((t) => t.startsWith('web/')), file).toEqual([]);
  }
});

test('the domain is pure: it imports only the domain and shared/, and no package', () => {
  for (const file of files.filter((f) => f.startsWith('server/domain/') && !isTest(f))) {
    const { local, packages } = importsOf(file);
    expect(local.filter((t) => !t.startsWith('server/domain/') && !t.startsWith('shared/')), file).toEqual([]);
    expect(packages, file).toEqual([]);
  }
});

test('only server/config.ts reads the environment', () => {
  const readers = files.filter((f) => isCode(f) && !isTest(f) && f.startsWith('server/') && /process\s*(\.|\[\s*['"])\s*env|\benv\b[^;]*=\s*process\b/.test(readFileSync(join(ROOT, f), 'utf8')));
  expect(readers).toEqual(['server/config.ts']);
});

test('only the adapter of the real model imports the SDK of the model', () => {
  const users = files.filter((f) => isCode(f) && !isTest(f) && importsOf(f).packages.some((p) => p.startsWith('@anthropic-ai/')));
  expect(users.filter((f) => f !== 'server/intelligence/claude-suggester.ts')).toEqual([]);
});

test('a file does not import a file of a later level', () => {
  const broken: string[] = [];
  for (const file of files.filter((f) => isCode(f) && !isTest(f))) {
    for (const target of importsOf(file).local) {
      const entry = levels.files[target];
      if (entry && entry.level > reachedLevel(file)) broken.push(file + ' (level ' + reachedLevel(file) + ') imports ' + target + ' (level ' + entry.level + ')');
    }
  }
  expect(broken).toEqual([]);
});

test('no source file contains a path of this computer', () => {
  const here = relative(ROOT, ROOT) === '' ? ROOT.split(/[\\/]/).slice(0, 3).join('/') : '';
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), 'utf8').replace(/\\/g, '/');
    expect(text.includes(here), file).toBe(false);
  }
});

// The recordings that the course page shows must be what the code does now.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { record } from './record-runs.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'recordings', 'runs.json');

test('recordings/runs.json is current, and a second recording is the same as the first', async () => {
  const first = await record();
  const second = await record();
  expect(second).toBe(first); // no time, no random value
  expect(readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')).toBe(first);
});

test('a recording contains no path of a computer and no stack of an error', async () => {
  const text = await record();
  expect(text).not.toMatch(/[A-Z]:\\\\|\/Users\/|\/home\/|\bat .+:\d+:\d+/);
});

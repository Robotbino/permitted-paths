// Stage 1 of the import pipeline: inspect. Raw text goes in; a header and rows of cells come out.
// Bank exports are not standard, thus this stage finds the delimiter and the quoting by itself.
// It does not know what a column means. That is the task of the mapping (profiles.ts).
// Bad input is never an exception here: it becomes a problem in the result.
// Limit: one record is one line. A line break inside a quoted cell is not supported.
import type { Problem } from '../contracts.ts';

export const DELIMITERS = [',', ';', '\t'] as const;
export type Delimiter = (typeof DELIMITERS)[number];

export type InspectedRow = { line_no: number; raw: string; cells: string[] };

export type Inspected = {
  delimiter: Delimiter;
  quoted: boolean;
  header: string[];
  rows: InspectedRow[];
  problems: Problem[];
};

/** The same text for each operating system: no byte order mark, and each line end is "\n". */
export function normaliseText(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

type SplitLine = { cells: string[]; quoted: boolean; open: boolean };

/** One line to cells. A quoted cell can contain the delimiter, and "" inside it is one quote mark. */
function splitLine(line: string, delimiter: string): SplitLine {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cellQuoted = false;
  let anyQuoted = false;
  const push = (): void => {
    cells.push(cellQuoted ? cell : cell.trim());
    cell = '';
    cellQuoted = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch !== '"') cell += ch;
      else if (line.charAt(i + 1) === '"') {
        cell += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === delimiter) push();
    else if (ch === '"' && !cellQuoted && cell.trim() === '') {
      inQuotes = true;
      cellQuoted = true;
      anyQuoted = true;
      cell = '';
    } else if (!(cellQuoted && /\s/.test(ch))) cell += ch;
  }
  push();
  return { cells, quoted: anyQuoted, open: inQuotes };
}

/** The delimiter that gives the most cells in the header line. With equal counts, the first of , ; tab. */
function detectDelimiter(headerLine: string): Delimiter {
  let best: Delimiter = ',';
  let most = 0;
  for (const delimiter of DELIMITERS) {
    const count = splitLine(headerLine, delimiter).cells.length;
    if (count > most) {
      most = count;
      best = delimiter;
    }
  }
  return best;
}

/** The largest number of lines before the header, and the largest number of INSPECT-CELLS problems in one result. */
export const MAX_PREAMBLE_LINES = 10;
export const MAX_CELL_PROBLEMS = 20;

/**
 * The line of the header. Some banks write lines before it ("Account: ...", "Period: ..."). Such a line has one column.
 * The header is the first line with two or more columns in the first lines of the file. If none has, it is the first line.
 */
function findHeader(lines: string[], firstAt: number): number {
  let seen = 0;
  for (let i = firstAt; i >= 0 && i < lines.length && seen <= MAX_PREAMBLE_LINES; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    seen += 1;
    if (splitLine(line, detectDelimiter(line)).cells.length >= 2) return i;
  }
  return firstAt;
}

/** Raw text to a header and rows. line_no is the line in the file, from 1; blank lines are counted and left out. */
export function inspect(text: string): Inspected {
  const lines = normaliseText(text).split('\n');
  const problems: Problem[] = [];
  const firstAt = lines.findIndex((line) => line.trim() !== '');
  const headerAt = findHeader(lines, firstAt);
  const headerLine = headerAt === -1 ? undefined : lines[headerAt];
  if (headerLine === undefined) {
    problems.push({ rule: 'INSPECT-EMPTY', text: 'The file has no text.' });
    return { delimiter: ',', quoted: false, header: [], rows: [], problems };
  }
  if (headerAt > firstAt) {
    problems.push({ rule: 'INSPECT-PREAMBLE', text: 'The header is on line ' + (headerAt + 1) + '. The lines before it have one column and were not read.' });
  }
  const delimiter = detectDelimiter(headerLine);
  const head = splitLine(headerLine, delimiter);
  let quoted = head.quoted;
  if (head.open) problems.push({ rule: 'INSPECT-QUOTE', text: 'Line ' + (headerAt + 1) + ': a quote mark opens and does not close.' });
  if (head.cells.length < 2) {
    problems.push({ rule: 'INSPECT-ONE-COLUMN', text: 'The first line has one column only. The file needs columns with a comma, a semicolon or a tab between them.' });
  }
  const rows: InspectedRow[] = [];
  let unequal = 0;
  for (let i = headerAt + 1; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (raw.trim() === '') continue;
    const split = splitLine(raw, delimiter);
    if (split.quoted) quoted = true;
    if (split.open) problems.push({ rule: 'INSPECT-QUOTE', text: 'Line ' + (i + 1) + ': a quote mark opens and does not close.' });
    if (split.cells.length !== head.cells.length && ++unequal <= MAX_CELL_PROBLEMS) {
      problems.push({ rule: 'INSPECT-CELLS', text: 'Line ' + (i + 1) + ' has ' + split.cells.length + ' cells. The header has ' + head.cells.length + '.' });
    }
    rows.push({ line_no: i + 1, raw, cells: split.cells });
  }
  if (unequal > MAX_CELL_PROBLEMS) {
    problems.push({ rule: 'INSPECT-CELLS-MORE', text: (unequal - MAX_CELL_PROBLEMS) + ' more lines have a number of cells that is different from the header.' });
  }
  if (rows.length === 0) problems.push({ rule: 'INSPECT-NO-ROWS', text: 'The file has a header and no rows.' });
  return { delimiter, quoted, header: head.cells, rows, problems };
}

/**
 * A small hash of the normalised text (cyrb53, 53 bits, as 14 hex characters).
 * It finds identical files: the same text gives the same hash on each device.
 * It is NOT a security hash. A person can make two different files with the same hash.
 */
export function textHash(text: string): string {
  const clean = normaliseText(text).trimEnd();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const high = (h2 >>> 0) & 0x1fffff;
  const low = h1 >>> 0;
  return high.toString(16).padStart(6, '0') + low.toString(16).padStart(8, '0');
}

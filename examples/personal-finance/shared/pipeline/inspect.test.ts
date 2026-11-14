import { describe, expect, test } from 'vitest';
import { inspect, textHash } from './inspect.ts';
import { HARBOUR_SAMPLE, NORTHBANK_SAMPLE, UNKNOWN_SAMPLE } from './samples.ts';

describe('inspect', () => {
  test('the delimiter comes from the header line', () => {
    expect(inspect(NORTHBANK_SAMPLE).delimiter).toBe(';');
    expect(inspect(HARBOUR_SAMPLE).delimiter).toBe(',');
    expect(inspect(UNKNOWN_SAMPLE).delimiter).toBe('\t');
  });

  test('the samples give a header, the rows and no problem', () => {
    const north = inspect(NORTHBANK_SAMPLE);
    expect(north.header).toEqual(['Posting Date', 'Details', 'Debit', 'Credit', 'Balance']);
    expect(north.rows).toHaveLength(14);
    expect(north.quoted).toBe(false);
    expect(north.problems).toEqual([]);
    const harbour = inspect(HARBOUR_SAMPLE);
    expect(harbour.header).toEqual(['Date', 'Time', 'Type', 'Description', 'Amount']);
    expect(harbour.rows).toHaveLength(10);
    expect(harbour.quoted).toBe(true);
    expect(harbour.problems).toEqual([]);
  });

  test('a quoted cell keeps a delimiter, and a doubled quote becomes one quote mark', () => {
    const harbour = inspect(HARBOUR_SAMPLE);
    expect(harbour.rows[1]?.cells[3]).toBe('Sunrise Pharmacy, Main Road');
    expect(harbour.rows[8]?.cells[3]).toBe('Kite "Express" Couriers');
    expect(harbour.rows[8]?.cells).toHaveLength(5);
  });

  test('an empty cell at the end of a line is a cell', () => {
    expect(inspect(UNKNOWN_SAMPLE).rows[0]?.cells).toEqual(['03/02/2026', 'Garden centre', '310.00', '']);
  });

  test('a byte order mark and Windows line ends change nothing', () => {
    const plain = inspect(NORTHBANK_SAMPLE);
    const windows = inspect('﻿' + NORTHBANK_SAMPLE.replace(/\n/g, '\r\n'));
    expect(windows.header).toEqual(plain.header);
    expect(windows.rows).toEqual(plain.rows);
    expect(windows.problems).toEqual([]);
  });

  test('old Mac line ends (CR only) give the same cells', () => {
    const mac = inspect('a;b\r1;2\r3;4\r');
    expect(mac.rows.map((row) => row.cells)).toEqual([['1', '2'], ['3', '4']]);
  });

  test('blank lines are left out and the line numbers stay those of the file', () => {
    const result = inspect('\n\na,b\n\n1,2\n   \n3,4\n');
    expect(result.header).toEqual(['a', 'b']);
    expect(result.rows.map((row) => row.line_no)).toEqual([5, 7]);
    expect(result.rows[0]?.raw).toBe('1,2');
  });

  test('a file with no text is a problem, not an exception', () => {
    const result = inspect('');
    expect(result.rows).toEqual([]);
    expect(result.problems.map((p) => p.rule)).toEqual(['INSPECT-EMPTY']);
    expect(inspect(' \r\n \n').problems.map((p) => p.rule)).toEqual(['INSPECT-EMPTY']);
  });

  test('a header with no rows is a problem', () => {
    expect(inspect('Date,Amount\n').problems.map((p) => p.rule)).toEqual(['INSPECT-NO-ROWS']);
  });

  test('a file with one column is a problem', () => {
    const result = inspect('just some words\nmore words\n');
    expect(result.header).toHaveLength(1);
    expect(result.problems.map((p) => p.rule)).toContain('INSPECT-ONE-COLUMN');
  });

  test('a row with a different number of cells is a problem with its line number', () => {
    const result = inspect('a,b,c\n1,2\n1,2,3\n');
    expect(result.rows).toHaveLength(2);
    expect(result.problems).toEqual([{ rule: 'INSPECT-CELLS', text: 'Line 2 has 2 cells. The header has 3.' }]);
  });

  test('a quote mark that does not close is a problem', () => {
    const result = inspect('a,b\n"open,2\n');
    expect(result.problems.map((p) => p.rule)).toContain('INSPECT-QUOTE');
  });
});

describe('textHash', () => {
  test('identical text gives an identical hash of 14 hex characters', () => {
    expect(textHash(NORTHBANK_SAMPLE)).toBe(textHash(NORTHBANK_SAMPLE));
    expect(textHash(NORTHBANK_SAMPLE)).toMatch(/^[0-9a-f]{14}$/);
  });

  test('the line ends and the byte order mark do not change the hash', () => {
    expect(textHash('﻿' + NORTHBANK_SAMPLE.replace(/\n/g, '\r\n'))).toBe(textHash(NORTHBANK_SAMPLE));
  });

  test('one different character changes the hash', () => {
    expect(textHash(NORTHBANK_SAMPLE.replace('68,00', '68,01'))).not.toBe(textHash(NORTHBANK_SAMPLE));
    expect(textHash('')).not.toBe(textHash('a'));
  });
});

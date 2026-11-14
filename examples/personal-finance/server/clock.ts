// Time and identifiers come into the program through these two small ports.
// A test gives a fixed clock and sequential identifiers, thus each test gives the same result each time.

export type Clock = {
  /** The local date of today, YYYY-MM-DD. */
  today(): string;
  /** The time now, UTC, ISO 8601. Only for the audit. */
  now(): string;
};

export type IdGen = (prefix: string) => string;

const two = (n: number) => String(n).padStart(2, '0');

export const systemClock: Clock = {
  today() {
    const d = new Date();
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  },
  now: () => new Date().toISOString(),
};

export function fixedClock(today: string, now = today + 'T10:00:00.000Z'): Clock {
  return { today: () => today, now: () => now };
}

export const randomIds: IdGen = (prefix) => prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export function sequentialIds(): IdGen {
  const next: Record<string, number> = {};
  return (prefix) => {
    next[prefix] = (next[prefix] ?? 0) + 1;
    return prefix + '_' + String(next[prefix]).padStart(4, '0');
  };
}

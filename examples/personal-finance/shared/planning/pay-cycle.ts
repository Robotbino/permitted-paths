// The pay cycle. A person who is paid one time each month plans from payday to the day before the next payday.
// The calendar month is the wrong period: the money arrives on the payday, not on day 1.
// All functions here are pure. A date is a local 'YYYY-MM-DD' string; the arithmetic uses Date.UTC only,
// thus a time zone or a clock change cannot move a day.

/** One pay cycle. The id is the start date. The end is the last day, inclusive. */
export type PayCycle = { id: string; start: string; end: string; days: number };

/** One block of a cycle. The index starts at 1. The last block has the days that are left (1 to 7). */
export type WeekBlock = { index: number; start: string; end: string; days: number };

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError('The date must have the form YYYY-MM-DD: ' + date);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date.UTC moves an impossible day (February 30) into the next month, and a year below 100 into 19xx.
  // The date is correct only if it comes back as the same text.
  if (fromUtc(ms) !== date) throw new RangeError('The date is not a day of the calendar (years 0100 to 9999): ' + date);
  return ms;
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  // A year with 5 digits breaks the comparison of dates as strings.
  if (!(year >= 0 && year <= 9999)) throw new RangeError('The date is outside the years 0000 to 9999.');
  const y = String(year).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + mo + '-' + day;
}

/** PASS (true) if the text is a real day of the calendar in the form YYYY-MM-DD. */
export function isDate(text: string): boolean {
  try {
    toUtc(text);
    return true;
  } catch {
    return false;
  }
}

/** The date n days after the given date. n can be negative. */
export function addDays(date: string, n: number): string {
  if (!Number.isSafeInteger(n)) throw new RangeError('The number of days must be a whole number.');
  return fromUtc(toUtc(date) + n * DAY_MS);
}

/** The number of days from a to b. It is negative if b is before a. The same date gives 0. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

function checkPayday(payday: number): void {
  // 28 is the largest payday, because each month has a day 28. A payday 31 does not exist in February.
  if (!Number.isInteger(payday) || payday < 1 || payday > 28) {
    throw new RangeError('The payday must be a day of the month from 1 to 28.');
  }
}

/** The cycle that starts on the payday of the given month. */
function cycleFrom(year: number, monthIndex: number, payday: number): PayCycle {
  // Date.UTC accepts month 12 and month -1: it moves into the next or the previous year.
  const start = fromUtc(Date.UTC(year, monthIndex, payday));
  const end = fromUtc(Date.UTC(year, monthIndex + 1, payday) - DAY_MS);
  return { id: start, start, end, days: daysBetween(start, end) + 1 };
}

/** The pay cycle that contains the date. A cycle starts on the payday. */
export function cycleContaining(date: string, payday: number): PayCycle {
  checkPayday(payday);
  const d = new Date(toUtc(date));
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  // Before the payday of this month, the date is in the cycle that started in the previous month.
  return d.getUTCDate() >= payday ? cycleFrom(year, month, payday) : cycleFrom(year, month - 1, payday);
}

// The cycle must start on the payday. With a different payday, the result would overlap the given cycle.
function checkStartsOn(cycle: PayCycle, payday: number): void {
  checkPayday(payday);
  if (new Date(toUtc(cycle.start)).getUTCDate() !== payday) {
    throw new RangeError('The cycle ' + cycle.start + ' does not start on the payday ' + payday + '. After a change of payday, start again from cycleContaining.');
  }
}

/** The cycle after the given cycle. The cycle must start on the payday. */
export function nextCycle(cycle: PayCycle, payday: number): PayCycle {
  checkStartsOn(cycle, payday);
  return cycleContaining(addDays(cycle.end, 1), payday);
}

/** The cycle before the given cycle. The cycle must start on the payday. */
export function previousCycle(cycle: PayCycle, payday: number): PayCycle {
  checkStartsOn(cycle, payday);
  return cycleContaining(addDays(cycle.start, -1), payday);
}

/** 7-day blocks counted from the start of the cycle. They are not calendar weeks. */
export function weekBlocks(cycle: PayCycle): WeekBlock[] {
  const blocks: WeekBlock[] = [];
  for (let offset = 0; offset < cycle.days; offset += 7) {
    const days = Math.min(7, cycle.days - offset);
    blocks.push({
      index: blocks.length + 1,
      start: addDays(cycle.start, offset),
      end: addDays(cycle.start, offset + days - 1),
      days,
    });
  }
  return blocks;
}

// The parser of a statement. Pure: text in, lines out. A line that it cannot read is not an
// exception; it is a line with a problem, and the other lines continue.
// The format is a simple CSV with the header "Date,Description,Amount". Money out is a negative amount.
// This is a file that the person exports and gives to the application. It is not a connection to a bank.
import { isRealDate } from '../../shared/contracts.ts';
import type { StatementLine } from '../../shared/contracts.import.ts';
import { parseAmount } from '../../shared/money.ts';

export const HEADER = 'date,description,amount';

/** Splits one CSV line. A field in double quotes can contain a comma. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { fields.push(field.trim()); field = ''; }
    else field += ch;
  }
  fields.push(field.trim());
  return fields;
}

const bad = (line_no: number, raw: string, text: string): StatementLine => ({ line_no, raw, occurred_on: null, merchant_name: null, amount_cents: null, problem: { rule: 'R14', text } });

/** Returns null if the text is not a statement (the header is not there). */
export function parseStatement(csv: string): StatementLine[] | null {
  const rows = csv.replace(/\r\n?/g, '\n').split('\n').map((r) => r.trim()).filter((r) => r !== '');
  if (rows.length === 0 || rows[0]!.toLowerCase().replace(/\s/g, '') !== HEADER) return null;
  return rows.slice(1).map((raw, index) => {
    const line_no = index + 1;
    const fields = splitCsvLine(raw);
    if (fields.length !== 3) return bad(line_no, raw, 'The line has ' + fields.length + ' fields. It must have 3.');
    const [date, description, amount] = fields as [string, string, string];
    if (!isRealDate(date)) return bad(line_no, raw, 'The date "' + date + '" is not a real date in the form YYYY-MM-DD.');
    if (description === '' || description.length > 80) return bad(line_no, raw, 'The description must have 1 to 80 characters.');
    if (!amount.startsWith('-')) return bad(line_no, raw, 'This line is money in. The application records only expenses.');
    const cents = parseAmount(amount.slice(1));
    if (cents === null || cents === 0) return bad(line_no, raw, 'The amount "' + amount + '" is not an amount.');
    return { line_no, raw, occurred_on: date, merchant_name: description, amount_cents: cents, problem: null };
  });
}

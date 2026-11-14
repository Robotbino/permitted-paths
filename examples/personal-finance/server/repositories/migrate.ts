// Migrations. Each change of the database schema is one numbered .sql file.
// The database remembers the number of the last file that it applied (PRAGMA user_version).
// Migrations go forward only. To change a table, add a new file; do not edit an old one.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrate(db: DatabaseSync): number {
  db.exec('PRAGMA foreign_keys = ON');
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  let applied = 0;
  for (const file of files) {
    const number = Number(file.slice(0, 3));
    if (number <= row.user_version) continue;
    // One transaction for one file: the schema is fully at version N or fully at version N + 1.
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      db.exec('PRAGMA user_version = ' + number);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    applied += 1;
  }
  return applied;
}

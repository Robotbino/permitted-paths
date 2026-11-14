// The composition root. This is the only file that knows all the parts.
// It reads the settings, opens the database, makes the stores and starts the server.
// Each other file gets its dependencies as arguments, thus a test can give different ones.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomIds, systemClock } from './clock.ts';
import { readConfig } from './config.ts';
import { periodOf } from './domain/expense.ts';
import { sqliteTrace } from './graph/trace.ts';
import { sqliteLedgerReader } from './graph/verifier.ts';
import type { App } from './http/handlers.ts';
import { claudeSuggester } from './intelligence/claude-suggester.ts';
import { sqliteMerchantMemory } from './intelligence/merchant-memory.ts';
import { createHttpServer } from './http/server.ts';
import { seed } from './repositories/seed.ts';
import { openDatabase, sqliteStores } from './repositories/sqlite.ts';

const config = readConfig();
const db = openDatabase(config.dbFile);
const stores = sqliteStores(db);
seed(stores, periodOf(systemClock.today()));

// Level 2: the trace store, and the read-only view of the ledger that the verifier uses.
const app: App = {
  stores, clock: systemClock, ids: randomIds, trace: sqliteTrace(db), ledger: sqliteLedgerReader(db),
  // Level 3: the memory is always there. The model is there only if the environment has a key.
  memory: sqliteMerchantMemory(db),
  suggester: config.ai ? claudeSuggester(config.ai) : undefined,
  dailyCap: config.ai?.dailyCap,
};

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const server = createHttpServer(app, { webDir });

server.listen(config.port, config.host, () => {
  console.log('Personal finance: http://' + config.host + ':' + config.port + '  (data: ' + config.dbFile + ')');
  console.log(config.ai ? 'AI suggestions: on, model ' + config.ai.model + ', at most ' + config.ai.dailyCap + ' calls a day.' : 'AI suggestions: off (no ANTHROPIC_API_KEY). The merchant memory still gives suggestions.');
});

process.on('SIGINT', () => {
  server.close();
  db.close();
  process.exit(0);
});

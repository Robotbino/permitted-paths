/* studio.js: the data of the Practical Architecture Studio (part S).
   Added by this edition. It is not from the GE notes. Research date: 2026-11-14.
   The person of the case study and each figure are fictional.

   The drawings are here. The text of each component and each connection (responsibility, data
   contract, file, test) is in the tables of index.html: the page shows the tables when there
   is no JavaScript, and the instrument reads the same tables, thus the text exists one time.

   A node has `level`: the level of the reference application that introduced it (1 to 3).
   The lens of a drawing makes the parts of a later level faint. In the drawing "deploy", `level` is the stage.
   The source code and the recorded runs are in studio-files.js and studio-runs.js (generated).
   The planning, pipeline and export functions of the application are in studio-domain.js (generated). */
(function (GE) {
  'use strict';
  var S = GE.data.studio = {};
  S.researched = '2026-11-14';
  S.repo = 'https://github.com/Robotbino/permitted-paths/blob/main/examples/personal-finance/';

  S.levels = [
    { n: 1, name: 'An ordinary application', short: 'Rules as code' },
    { n: 2, name: 'Structured workflows', short: 'Explicit stages' },
    { n: 3, name: 'A model inside permitted paths', short: 'A model proposes' }
  ];

  var n = function (id, x, y, label, level, extra) { return Object.assign({ id: id, x: x, y: y, label: label, level: level }, extra || {}); };
  var e = function (from, to, level, extra) { return Object.assign({ from: from, to: to, level: level }, extra || {}); };
  var D = S.drawings = {};

  /* The system: the parts and the direction of each call. */
  D.system = {
    title: 'The parts of the application', lens: 'Level', w: 1040, h: 520, label: 'The parts of the personal finance application and the calls between them.',
    nodes: [
      n('you', 90, 205, 'Sam\nbrowser', 1, { type: 'person' }),
      n('web', 260, 205, 'Web application\nReact, reducer', 1, { type: 'code' }),
      n('contracts', 370, 70, 'Shared contracts\nZod schemas', 1),
      n('http', 450, 205, 'HTTP server\nhandlers', 1, { type: 'code' }),
      n('svc', 660, 205, 'Services\nuse cases', 1, { type: 'code' }),
      n('dom', 900, 90, 'Domain and planning\npure functions', 1, { type: 'code' }),
      n('repo', 900, 205, 'Repositories\nports', 1, { type: 'code' }),
      n('db', 900, 320, 'SQLite file', 1, { shape: 'pill', w: 120 }),
      n('flows', 660, 330, 'Workflows\nrecord, import', 2, { type: 'code' }),
      n('trace', 660, 450, 'Trace\neach run, each step', 2, { type: 'code' }),
      n('sheet', 900, 450, 'Spreadsheet\npaste-ready rows', 2, { type: 'person' }),
      n('gate', 450, 330, 'Permitted-action gate\nallowlist, checks', 3, { type: 'code', shape: 'gate' }),
      n('model', 230, 330, 'Model\noptional', 3, { type: 'model' })
    ],
    edges: [
      e('you', 'web', 1),
      e('web', 'http', 1, { label: 'JSON' }),
      e('contracts', 'web', 1, { kind: 'ref', toSide: 't' }), e('contracts', 'http', 1, { kind: 'ref', toSide: 't' }),
      e('http', 'svc', 1, { label: 'calls' }),
      e('svc', 'dom', 1, { fromSide: 't', toSide: 'l', via: [[660, 90]], label: 'facts in, plan out', lx: 760, ly: 81 }),
      e('svc', 'repo', 1),
      e('repo', 'db', 1, { label: 'SQL' }),
      e('svc', 'flows', 2, { label: 'runs' }),
      e('flows', 'repo', 2, { fromSide: 'r', toSide: 'b', via: [[820, 330], [820, 262], [900, 262]] }),
      e('flows', 'trace', 2, { label: 'each step' }),
      e('flows', 'sheet', 2, { label: 'text to paste', fromSide: 'r', toSide: 'l', via: [[790, 360], [790, 450]], fo: 20, lx: 790, ly: 405 }),
      e('http', 'gate', 3, { label: 'a sentence' }),
      e('gate', 'model', 3, { kind: 'ref', label: 'text, names', fo: -14, to_: -14, lx: 340, ly: 300 }),
      e('model', 'gate', 3, { label: 'a request', fo: 14, to_: 14, lx: 340, ly: 362 }),
      e('gate', 'svc', 3, { label: 'after approval', fromSide: 't', toSide: 'b', via: [[480, 268], [630, 268]], fo: 30, to_: -30, lx: 555, ly: 259 })
    ]
  };

  /* The domain model: what the application knows about money. The three pills are calculated, not stored. */
  D.model = {
    title: 'The domain model', lens: 'Level', w: 1040, h: 440, label: 'The things that the application knows, the relations between them, and the three figures that it calculates.',
    nodes: [
      n('cycle', 95, 80, 'Pay cycle\npayday to payday', 1),
      n('income', 290, 80, 'Income', 1, { w: 90 }),
      n('commitment', 475, 80, 'Commitment\namount, day', 1),
      n('pot', 665, 80, 'Savings pot\ntarget, priority', 1),
      n('headroom', 885, 80, 'Headroom\ncalculated', 1, { shape: 'pill', w: 140 }),
      n('account', 95, 220, 'Account', 1),
      n('txn', 380, 220, 'Transaction\ndate, cents, merchant', 1),
      n('category', 650, 220, 'Category\nkind, class', 1),
      n('spent', 885, 220, 'Spent this week\ncalculated', 1, { shape: 'pill', w: 160 }),
      n('batch', 380, 360, 'Import batch\nfile hash, mapping, rows', 2),
      n('cap', 885, 360, 'Weekly cap\ncalculated', 1, { shape: 'pill', w: 140 })
    ],
    edges: [
      e('income', 'cycle', 1, { label: 'arrives in' }),
      e('commitment', 'income', 1, { kind: 'ref', label: 'paid from' }),
      e('txn', 'account', 1, { label: 'belongs to' }),
      e('txn', 'cycle', 1, { label: 'falls in', fromSide: 't', toSide: 'b', via: [[380, 150], [95, 150]], lx: 240, ly: 141 }),
      e('txn', 'category', 1, { label: 'is in' }),
      e('batch', 'txn', 2, { label: 'gives, after a decision' }),
      e('pot', 'headroom', 1, { kind: 'ref', label: 'funded from' }),
      e('category', 'spent', 1, { label: 'free only' }),
      e('headroom', 'cap', 1, { label: 'by days', fromSide: 'r', toSide: 'r', via: [[1005, 80], [1005, 360]], lx: 1005, ly: 150 }),
      e('spent', 'cap', 1, { kind: 'ref', label: 'compared with' })
    ]
  };

  /* The six layers of level 3: from a sentence to a change. */
  D.layers = {
    title: 'From a sentence to a change', lens: 'Level', w: 1040, h: 430, label: 'The six layers between a sentence of a person and a change of stored data.',
    nodes: [
      n('say', 85, 120, '1 Interaction\na sentence', 3, { type: 'person' }),
      n('interpret', 270, 120, '2 Interpretation\nthe model', 3, { type: 'model' }),
      n('gate', 465, 120, '3 Gate\nfour checks', 3, { type: 'code', shape: 'gate' }),
      n('approve', 655, 120, 'The person\napproves', 3, { type: 'person' }),
      n('service', 840, 120, '4 Service\nexecutes', 1, { type: 'code' }),
      n('store', 960, 250, '5 Persistence', 1, { shape: 'pill', w: 130 }),
      n('show', 840, 360, '6 Presentation\nfigures from code', 1, { type: 'code' }),
      n('clarify', 270, 290, 'A question\n2 to 4 answers', 3, { shape: 'pill', w: 150 }),
      n('rejected', 465, 290, 'Refused\nby name, recorded', 3, { shape: 'pill', w: 170 })
    ],
    edges: [
      e('say', 'interpret', 3, { label: 'text' }),
      e('interpret', 'gate', 3, { label: 'request' }),
      e('interpret', 'clarify', 3, { label: 'not clear' }),
      e('clarify', 'say', 3, { kind: 'ref', label: 'the person answers', fromSide: 'l', toSide: 'b', via: [[85, 290]], lx: 110, ly: 230 }),
      e('gate', 'rejected', 3, { label: 'FAIL' }),
      e('gate', 'approve', 3, { label: 'change' }),
      e('gate', 'service', 3, { label: 'reads only', fromSide: 't', toSide: 't', via: [[465, 40], [840, 40]], lx: 650, ly: 31 }),
      e('approve', 'service', 3, { label: 'yes' }),
      e('service', 'store', 1, { fromSide: 'r', toSide: 't', via: [[960, 120]] }),
      e('service', 'show', 1, { label: 'figures' }),
      e('show', 'say', 1, { kind: 'ref', label: 'the person reads', fromSide: 'l', toSide: 'b', via: [[40, 360], [40, 200], [65, 200]], to_: -20, lx: 420, ly: 351 })
    ]
  };

  /* B. The execution graph "record an expense". The ids are the ids of the real graph
     (server/graph/record-expense.graph.ts); tests.html compares them with the recording. */
  // `also`: the drawing shows the record graph of level 2 and of level 3. The edge verify>respond is only in the first.
  D.record = {
    title: 'Record an expense', lens: 'Level', graph: 'record-expense+memory', also: 'record-expense', w: 1040, h: 430, label: 'The execution graph that records one expense.',
    nodes: [
      n('gate1', 80, 150, 'Gate 1\nshape', 2, { type: 'code', shape: 'gate' }),
      n('dedupe', 225, 150, 'dedupe\nseen before?', 2, { type: 'code' }),
      n('load_facts', 375, 150, 'load_facts\nread the store', 2, { type: 'code' }),
      n('gate2', 525, 150, 'Gate 2\nsense', 2, { type: 'code', shape: 'gate' }),
      n('commit', 670, 150, 'commit\nthe only write', 2, { type: 'code' }),
      n('backoff', 670, 45, 'backoff\nwait', 2, { type: 'code' }),
      n('project', 815, 150, 'project\nbudget after', 2, { type: 'code' }),
      n('verify', 955, 150, 'verify\nread again', 2, { type: 'code', shape: 'gate' }),
      n('remember', 955, 265, 'remember\nmerchant', 3, { type: 'code' }),
      n('respond', 955, 375, 'respond', 2, { shape: 'pill', w: 110 }),
      n('reject', 300, 330, 'reject\nnothing saved', 2, { shape: 'pill', w: 150 }),
      n('escalate', 670, 330, 'escalate\na person must look', 2, { shape: 'pill', w: 190 })
    ],
    edges: [
      e('gate1', 'reject', 2, { label: 'FAIL', fromSide: 'b', toSide: 'l', via: [[80, 330]] }),
      e('gate1', 'dedupe', 2, { label: 'PASS' }),
      e('dedupe', 'respond', 2, { label: 'replay', fromSide: 'b', toSide: 'l', via: [[225, 395], [860, 395], [860, 375]], lx: 500, ly: 386 }),
      e('dedupe', 'reject', 2, { label: 'conflict', fromSide: 'b', toSide: 't', fo: 30, via: [[255, 250], [300, 250]], lx: 300, ly: 242 }),
      e('dedupe', 'escalate', 2, { fromSide: 'b', toSide: 'l', fo: -30, via: [[195, 290], [480, 290], [480, 330]], lx: 400, ly: 281, label: 'store down' }),
      e('dedupe', 'load_facts', 2, { label: 'new' }),
      e('load_facts', 'escalate', 2, { fromSide: 'b', toSide: 't', via: [[375, 250], [620, 250]], to_: -50, label: 'store down', lx: 470, ly: 241 }),
      e('load_facts', 'gate2', 2),
      e('gate2', 'reject', 2, { label: 'FAIL', fromSide: 'b', toSide: 'r', via: [[525, 330]], lx: 525, ly: 215 }),
      e('gate2', 'commit', 2, { label: 'PASS' }),
      e('commit', 'project', 2, { label: 'saved', lx: 742, ly: 108 }),
      e('commit', 'backoff', 2, { fromSide: 't', toSide: 'b', fo: -22, to_: -22, label: 'again', lx: 620, ly: 98 }),
      e('commit', 'escalate', 2, { fromSide: 'b', toSide: 't', label: 'attempts used', lx: 728, ly: 240 }),
      e('backoff', 'commit', 2, { fromSide: 'b', toSide: 't', fo: 22, to_: 22 }),
      e('project', 'verify', 2),
      e('verify', 'respond', 2, { fromSide: 'l', toSide: 'l', via: [[880, 195], [880, 345]], fo: 14, to_: -10, label: 'agrees', lx: 852, ly: 270 }),
      e('verify', 'remember', 3, { label: 'agrees', fromSide: 'b', toSide: 't', lx: 992, ly: 208 }),
      e('remember', 'respond', 3, { fromSide: 'b', toSide: 't' }),
      e('verify', 'escalate', 2, { fromSide: 'b', toSide: 'r', fo: -30, via: [[925, 230], [800, 230], [800, 330]], label: 'does not agree', lx: 800, ly: 221 })
    ]
  };

  /* The suggest graph (level 3). The person and the record graph are outside the recorded graph. */
  D.suggest = {
    title: 'Suggest a category', lens: 'Level', graph: 'suggest-category', w: 1040, h: 360, label: 'The execution graph that suggests a category. It cannot write.',
    nodes: [
      n('gate1', 80, 120, 'Gate 1\nshape', 3, { type: 'code', shape: 'gate' }),
      n('recall', 225, 120, 'recall\nmemory', 3, { type: 'code' }),
      n('allow', 375, 120, 'allow\ncost control', 3, { type: 'code', shape: 'gate' }),
      n('ask_model', 530, 120, 'ask_model\nClaude API', 3, { type: 'model' }),
      n('suggestion_gate', 700, 120, 'Suggestion gate\npermitted?', 3, { type: 'code', shape: 'gate' }),
      n('respond', 870, 120, 'respond', 3, { shape: 'pill', w: 110 }),
      n('reject', 80, 290, 'reject', 3, { shape: 'pill', w: 100 }),
      n('you', 870, 230, 'You\naccept or change', 3, { type: 'person', outside: true }),
      n('record', 870, 320, 'Record graph', 2, { shape: 'pill', w: 150, outside: true })
    ],
    edges: [
      e('gate1', 'reject', 3, { label: 'FAIL' }),
      e('gate1', 'recall', 3, { label: 'PASS' }),
      e('recall', 'suggestion_gate', 3, { label: 'memory hit', fromSide: 't', toSide: 't', via: [[225, 40], [700, 40]], lx: 460, ly: 31 }),
      e('recall', 'allow', 3, { label: 'miss', lx: 300, ly: 80 }),
      e('allow', 'respond', 3, { label: 'AI off, or limit used', fromSide: 'b', toSide: 'b', via: [[375, 215], [770, 215], [770, 165], [840, 165]], to_: -30, lx: 560, ly: 206 }),
      e('allow', 'ask_model', 3, { label: 'allowed', lx: 452, ly: 80 }),
      e('ask_model', 'respond', 3, { label: 'no answer', fromSide: 'b', toSide: 'b', via: [[530, 185], [790, 185], [790, 150], [855, 150]], to_: -15, lx: 640, ly: 176 }),
      e('ask_model', 'suggestion_gate', 3, { label: 'answer', lx: 612, ly: 80 }),
      e('suggestion_gate', 'respond', 3),
      e('respond', 'you', 3, { kind: 'ref', outside: true }),
      e('you', 'record', 3, { label: 'POST /api/expenses', outside: true, lx: 965, ly: 276 })
    ]
  };

  /* The import graph (level 2). The ids are the ids of the real graph (server/import/import.graph.ts). */
  D.importer = {
    title: 'Import a file', lens: 'Level', graph: 'import-statement', w: 1040, h: 410, label: 'The workflow that imports a bank file.',
    nodes: [
      n('inspect', 75, 110, 'inspect\nthe text', 2, { type: 'code', w: 110 }),
      n('map', 210, 110, 'map\na layout', 2, { type: 'code', shape: 'gate', w: 116 }),
      n('await_mapping', 210, 250, 'await_mapping\ncheckpoint', 2, { type: 'person', w: 124 }),
      n('stage', 350, 110, 'stage\nrow states', 2, { type: 'code', w: 110 }),
      n('classify', 490, 110, 'classify\none budget', 3, { type: 'code', w: 110 }),
      n('await_person', 635, 110, 'await_person\ncheckpoint', 2, { type: 'person', w: 124 }),
      n('apply', 780, 110, 'apply\nrow by row', 2, { type: 'code', w: 110 }),
      n('reconcile', 925, 110, 'reconcile\none end each', 2, { type: 'code', shape: 'gate', w: 126 }),
      n('export', 925, 240, 'export\ntext to paste', 2, { type: 'code', w: 116 }),
      n('respond', 925, 350, 'respond', 2, { shape: 'pill', w: 110 }),
      n('reject', 75, 350, 'reject', 2, { shape: 'pill', w: 100 })
    ],
    edges: [
      e('inspect', 'reject', 2, { label: 'not a table', ly: 215 }),
      e('inspect', 'map', 2),
      e('map', 'reject', 2, { label: 'FAIL', fromSide: 'b', toSide: 'r', fo: -34, via: [[176, 170], [138, 170], [138, 342]], to_: -8, lx: 138, ly: 215 }),
      e('map', 'await_mapping', 2, { label: 'no layout' }),
      e('map', 'stage', 2, { label: 'PASS' }),
      e('await_mapping', 'respond', 2, { label: 'wait for a mapping', fromSide: 'b', toSide: 'b', fo: 22, via: [[232, 392], [925, 392]], lx: 560, ly: 383 }),
      e('await_mapping', 'reject', 2, { label: 'mapping FAIL', fromSide: 'b', toSide: 'r', fo: -22, via: [[188, 358]], to_: 8, lx: 188, ly: 300 }),
      e('await_mapping', 'stage', 2, { label: 'mapping PASS', fromSide: 'r', toSide: 'b', via: [[350, 250]], lx: 312, ly: 241 }),
      e('stage', 'classify', 2),
      e('classify', 'await_person', 2),
      e('await_person', 'respond', 2, { label: 'wait for the person', fromSide: 'b', toSide: 'l', fo: 22, via: [[657, 300], [820, 300], [820, 342]], to_: -8, lx: 738, ly: 291 }),
      e('await_person', 'reject', 2, { label: 'decisions FAIL', fromSide: 'b', toSide: 'r', fo: -22, via: [[613, 200], [420, 200], [420, 374], [150, 374], [150, 366]], to_: 16, lx: 516, ly: 191 }),
      e('await_person', 'apply', 2, { label: 'PASS' }),
      e('apply', 'reconcile', 2),
      e('reconcile', 'export', 2),
      e('export', 'respond', 2)
    ]
  };

  /* Deployment. Here `level` is the stage: 1 the PC only, 2 a private path to the PC, 3 a small host. */
  D.deploy = {
    title: 'Where it runs', lens: 'Stage', w: 1040, h: 420, label: 'Where the application runs on a PC and on an iPhone, in three stages.',
    stages: ['1 · PC only', '2 · Private path to the PC', '3 · A small host'],
    nodes: [
      n('pcb', 110, 90, 'PC browser\nor installed web app', 1, { type: 'person' }),
      n('server', 420, 90, 'Server on the PC\n127.0.0.1:8787', 1, { type: 'code' }),
      n('file', 690, 90, 'SQLite file\non the PC', 1, { shape: 'pill', w: 150 }),
      n('claude', 930, 90, 'Claude API\noptional', 1, { type: 'model' }),
      n('local', 110, 210, 'Storage of a browser\nonly on that device', 1),
      n('phone', 110, 330, 'iPhone\nHome Screen web app', 2, { type: 'person' }),
      n('path', 420, 210, 'Private HTTPS path\nand a sign-in', 2, { type: 'code' }),
      n('host', 420, 330, 'Small host\nHTTPS, sign-in, backups', 3, { type: 'code' }),
      n('hostdb', 690, 330, 'Database\non the host', 3, { shape: 'pill', w: 150 })
    ],
    edges: [
      e('pcb', 'server', 1, { label: 'http, this computer only', lx: 265, ly: 52 }),
      e('server', 'file', 1, { label: 'the truth' }),
      e('server', 'claude', 1, { label: 'key from .env', fromSide: 't', toSide: 't', via: [[420, 30], [930, 30]], lx: 675, ly: 21 }),
      e('pcb', 'local', 1, { kind: 'ref', label: 'not your data' }),
      e('phone', 'path', 2, { label: 'https', fromSide: 'r', toSide: 'l', via: [[260, 330], [260, 210]] }),
      e('path', 'server', 2, { label: 'to the PC' }),
      e('phone', 'host', 3, { label: 'https' }),
      e('host', 'hostdb', 3, { label: 'the truth' })
    ]
  };

  // Each drawing is also in GE.data.graphs, thus tests.html checks its nodes and edges.
  Object.keys(D).forEach(function (key) { GE.data.graphs['studio_' + key] = D[key]; });

  /* The replay instruments: which recorded scenarios, and the prediction that the learner makes first. */
  S.replays = {
    record: {
      drawing: 'record', scenarios: ['valid', 'bad_shape', 'inactive_category', 'over_budget', 'duplicate_submit', 'similar_expense', 'save_fails_once', 'store_down', 'ledger_mismatch', 'record_with_memory'],
      ask: 'Where does this run end?',
      options: [{ value: 'respond', label: 'respond: an answer with the expense' }, { value: 'reject', label: 'reject: refused, nothing saved' }, { value: 'escalate', label: 'escalate: a person must look' }],
      answer: function (sc) { return sc.run.path[sc.run.path.length - 1]; }
    },
    suggest: {
      drawing: 'suggest', scenarios: ['suggest_from_model', 'suggest_from_memory', 'suggest_ai_off', 'suggest_model_down', 'suggest_not_permitted', 'suggest_unknown', 'suggest_daily_cap', 'suggest_memory_inactive'],
      ask: 'Does the person see a suggestion?',
      options: [{ value: 'yes', label: 'Yes, a suggestion is shown' }, { value: 'no', label: 'No suggestion; the form works as before' }],
      answer: function (sc) { return sc.http.body.suggestion ? 'yes' : 'no'; }
    },
    importer: { drawing: 'importer', scenarios: ['import_northbank', 'import_harbour_after', 'import_same_file_twice', 'import_unknown_layout', 'import_bad_mapping'], manySteps: true }
  };

  /* The decision questions of the part. Each is one question with a cause for each answer. */
  S.checks = {
    ba_scope: {
      q: 'Sam says: "Can it also give me a financial health score?" What does the analyst do first?',
      options: [
        { text: 'Add it to the list. The person asked for it, thus it is a requirement.', why: 'A sentence of a person is evidence, not a requirement. A feature with no problem behind it costs work and can mislead.' },
        { text: 'Ask which decision the score would change, and what it would be calculated from.', correct: true, why: 'If no decision changes, the feature has no job. If a decision does change, the job is that decision, and it probably needs a fact and not a score.' },
        { text: 'Refuse it. A score is a game element, and game elements are out of scope.', why: 'A refusal with no question loses the need that is behind the request. First find the need; then decide.' }
      ]
    },
    open_decision: {
      q: 'The evidence does not decide a question that changes the architecture: is the truth in the application or in the spreadsheet? What does the engineer do?',
      options: [
        { text: 'Select the option that is easier to build, and continue.', why: 'It can be the correct option. With no record, nobody knows later that it was a choice, or what would change it.' },
        { text: 'Build the two, and let a setting select.', why: 'Two sources of truth with a switch are two systems to test, and a third problem: what happens to the data when the setting changes.' },
        { text: 'Write the two options with their costs, recommend the one that can be reversed, build the part that the two share, and leave the decision to the person.', correct: true, why: 'An open decision that is written down is a known risk. The decision stays with Sam. The code supports the export path, which keeps the second option possible.' }
      ]
    },
    principle_asset: {
      q: 'Sam asks: "Mark my car as a liability, like the book says." What does the application do?',
      options: [
        { text: 'It adds a list of assets and liabilities, with the definition of the book.', why: 'The definition of the book is one way to think. An accounting standard defines an asset in a different way. An application that classifies the property of a person gives an opinion that it is not qualified to give.' },
        { text: 'It shows what the car costs in each pay cycle: the commitment, the fuel, the repairs.', correct: true, why: 'That is information from the ledger. What Sam does with it is Sam\'s decision.' },
        { text: 'It lets a model decide, because the question is about meaning.', why: 'A model can sound certain about a question that has no single answer. The words are not the problem here; the authority is.' }
      ]
    },
    behaviour_kind: {
      q: '"You overspent on takeaways because you did not plan your meals." What kind of statement is this?',
      options: [
        { text: 'An observation.', why: 'The observation is only the first part: the amount in one category was more than in the cycle before. Code can calculate that.' },
        { text: 'An interpretation that is presented as a fact.', correct: true, why: 'The cause is a guess. The application can give the observation and offer the cause as one of some possibilities. The person knows which one is true.' },
        { text: 'A recommendation.', why: 'It recommends nothing. It gives a cause, and it gives it with a judgement of the person.' }
      ]
    },
    l1_model_calc: {
      q: 'Sam asks: "How much of this week\'s cap is left?" Which part gives the answer?',
      options: [
        { text: 'A model, with the transactions of the week in its prompt.', why: 'A model can subtract wrong, and it gives no sign when it does. The same question can get a different figure tomorrow.' },
        { text: 'A pure function with a test: the cap minus the sum of the free spending of the block.', correct: true, why: 'It is arithmetic with one correct answer. At level 3 a model can select this question for the person. It still does not calculate the answer.' },
        { text: 'The person, in the spreadsheet.', why: 'This is how the earlier tool worked. A figure that a person must copy goes out of date.' }
      ]
    },
    l1_state: {
      q: 'The week view shows "R212.40 of R553.42". Which part of the application stores the number R212.40?',
      options: [
        { text: 'The web application. It adds each amount that the form sends.', why: 'The web application does not calculate money. A second device would have a different number.' },
        { text: 'A column "spent" in a table of weeks. The import adds to it.', why: 'No table has that column. A stored total can disagree with the transactions; then one of the two is wrong and you do not know which.' },
        { text: 'No part stores it. It is the sum of the transactions of the block, each time.', correct: true, why: 'The transactions are the truth, and "spent" is a question to them. Thus no code can make the two disagree.' }
      ]
    },
    l2_unknown_csv: {
      q: 'A file arrives in a layout that the application does not know. What is the correct path?',
      options: [
        { text: 'An error: "this file is not supported".', why: 'Each new bank, and each change of a bank, is then a change of the code before the person can continue.' },
        { text: 'Guess the columns from their content: a column with dates is the date.', why: 'A guess is correct most of the time. When it is wrong, each row has a wrong date or a wrong sign, and nothing says so.' },
        { text: 'Stop, store the state, and ask for a mapping. Check the mapping with a dry run before a row is staged.', correct: true, why: 'An unknown layout is a question to the person. At level 3 a model can propose the mapping, and the same dry run checks it.' }
      ]
    },
    l2_twice: {
      q: 'Sam imports the same file two times. What makes the ledger correct?',
      options: [
        { text: 'The application remembers the name of each file.', why: 'A file can have a new name, and two different files can have the same name. The name says nothing about the rows.' },
        { text: 'The request key of each row comes from its fingerprint, thus the ledger refuses a second row.', correct: true, why: 'The fingerprint is made from the account, the date, the amount, the description, and the position among equal rows. The same file gives the same keys.' },
        { text: 'The person sees the duplicates in the list and removes them.', why: 'A person can do it for ten rows. The pipeline shows the duplicates, but the protection must not depend on attention.' }
      ]
    },
    l3_reject: {
      q: 'A model answers with the capability "delete_transaction" and a correct transaction id. What stops it?',
      options: [
        { text: 'The prompt, which tells the model not to request it.', why: 'The model already did not obey the prompt. A prompt is a help, not a protection.' },
        { text: 'Check 2 of the gate: the name is not in the allowlist. The request is refused by name and recorded.', correct: true, why: 'Rule R15. There is also no service for that name, thus there is no code path to protect.' },
        { text: 'The person, who must approve each change.', why: 'The request never gets to the person. A person who must refuse dangerous requests each day will approve one by mistake.' }
      ]
    },
    l3_amount: {
      q: 'Why does the capability "recommend_allowance" take a percentage, and not the new cap in cents?',
      options: [
        { text: 'A percentage needs fewer tokens.', why: 'The difference in cost is nothing. The reason is authority.' },
        { text: 'The application then calculates each amount from its own records, and the person approves a figure of the application.', correct: true, why: 'A model that gives cents can give wrong cents. A percentage in a small range is an opinion that the application can check and convert.' },
        { text: 'Models cannot write large numbers.', why: 'They can. They can also write them wrong, and that is the reason.' }
      ]
    },
    l3_authority: {
      q: 'The model answers "groceries" for a merchant. What changed in the database at that moment?',
      options: [
        { text: 'Nothing in the ledger and nothing in the memory. Only the record of runs has one more line.', correct: true, why: 'The suggest graph gets a function that lists categories, the memory to read, and the suggester. It gets no store that can write. The memory changes only when the person records an expense (R13).' },
        { text: 'The merchant memory has a new row, thus the next request is faster.', why: 'If the model could teach the memory, a wrong answer would become "what the person usually selects".' },
        { text: 'The expense has a draft row with the suggested category.', why: 'There is no draft. Until the person pushes Record, the server knows nothing about the expense.' }
      ]
    },
    l3_needs: {
      q: 'A new requirement: "Show how much I spent on transport in this pay cycle." Which part does this work?',
      options: [
        { text: 'The model, with the transactions of the cycle in its prompt.', why: 'A model can add a column of numbers wrong, and you cannot see when it does. This question has one exact answer and SQL gives it.' },
        { text: 'Code: one query with SUM, through the repository.', correct: true, why: 'It is arithmetic on data that the application owns. A model can select the question for the person (the capability analyse_spending). It adds no ability to the answer.' },
        { text: 'A new agent with a tool that reads the ledger.', why: 'An agent decides which steps to do. Here the steps are known before the request arrives: one query.' }
      ]
    },
    orch_budget: {
      q: 'A design where each worker counts for itself: three suggest workers start at the same moment, and each one reads "0 model calls today, the limit is 2". How many model calls happen?',
      options: [
        { text: 'Two. The third worker sees that the limit is used.', why: 'Each worker read the count before any of them wrote its run. No worker can see the other two.' },
        { text: 'Three. Thus a call is reserved in one step before it is made, and the orchestrator reserves for the whole import.', correct: true, why: 'An earlier version of this application had this defect, and a review found it: ten requests together made ten calls with a limit of two.' },
        { text: 'None. The engine refuses parallel runs.', why: 'The engine runs one graph. The pool starts three runs of the suggest graph, and each is independent.' }
      ]
    },
    orch_justified: {
      q: 'A new requirement: "Tell me why I am over my cap this week." Does it need orchestration?',
      options: [
        { text: 'Yes. One worker for each category, then an evaluator agent that checks the answer.', why: 'The queries take milliseconds, thus parallel workers gain nothing. An evaluator that checks figures is a deterministic gate.' },
        { text: 'No. Code gets the figures and the observations. A model can select the question; it writes no figure.', correct: true, why: 'If code puts each figure into the answer, there is no figure of the model to check.' },
        { text: 'Yes, because the question has the word "why".', why: 'The form of a question does not decide the architecture. The decision comes from a limit that you can name: many items, parallel calls, one budget.' }
      ]
    },
    deploy_sync: {
      q: 'You import a file on the PC. The iPhone shows the rows one minute later. Where are the rows stored?',
      options: [
        { text: 'In the storage of the two browsers, which the browsers keep the same.', why: 'A browser does not share its storage with a different device.' },
        { text: 'In the one database of the server. The two devices ask the same server.', correct: true, why: 'There is one copy of the truth, thus there is nothing to merge. The cost: no server, no data.' },
        { text: 'In iCloud, because the iPhone installed the application.', why: 'A Home Screen web app is a web page with its own window. It has no connection to iCloud storage.' }
      ]
    }
  };

  /* The gate of the part. */
  GE.data.gates.studio = {
    title: 'Gate of the studio: can you place each responsibility?',
    questions: [
      { kind: 'assign', source: 'Studio, the evidence register', at: 'ps-evidence',
        prompt: 'A person wants a tool for the bookings of a small sports club. You have notes of what the person said and did. Select the kind of evidence of each line.',
        hint: 'Explicit: the person said it, in those words. Inference: nobody said it, but the facts show it. Open: the evidence does not decide it. Challenged: it was said, and the facts do not support it.',
        bins: ['Explicit', 'Strong inference', 'Open question', 'Challenged'],
        why: 'A requirement comes from evidence. The four kinds differ in how much the evidence supports the sentence.',
        items: [
          { text: '"Members must book a court no more than seven days before."', bin: 'Explicit', why: 'The person said it as a rule.' },
          { text: 'The paper list of the last month has three double bookings, all on Saturday morning.', bin: 'Strong inference', why: 'Nobody said "prevent double bookings". The list shows that it is the problem.' },
          { text: '"We need an app with a chat assistant." The same person answers each booking by telephone and likes it.', bin: 'Challenged', why: 'It was said, but the behaviour does not support it. Ask what the assistant would do.' },
          { text: 'Can a member book for a guest?', bin: 'Open question', why: 'Nothing in the notes decides it, and it changes the data model.' },
          { text: '"It must work on my phone."', bin: 'Explicit', why: 'A direct statement.' },
          { text: '"Any payment method must work", said one time, in answer to "what if a member has no card?"', bin: 'Challenged', why: 'An answer to a "what if" question is not a requirement. It has no case behind it.' }
        ] },
      { kind: 'choice', source: 'Studio, level 1', at: 'ps-level-1',
        prompt: 'A parking application stores prices as numbers such as 12.5 (rand). After a year, the monthly report is 3 cents different from the bank. What is the cause, and the repair?',
        hint: 'Read how the pipeline changes "1 250,50" into cents.',
        options: [
          { text: 'Binary floats cannot hold most decimal fractions. Store integer cents.', correct: true, why: 'Each sum adds a very small error. Integer cents are exact, and text becomes cents by string operations.' },
          { text: 'The report rounds each line. Round only the total, to two decimals, at the end.', why: 'The error is in the stored values and in each addition, before a report rounds anything.' },
          { text: 'The database has too little precision. Use a column type with more digits.', why: 'More digits of a binary float are still a binary float.' },
          { text: 'Two requests changed the total at the same time. Add a lock around the update.', why: 'A race gives a difference of a full price, not of 3 cents.' }
        ] },
      { kind: 'assign', source: 'Studio, level 2', at: 'ps-level-2',
        prompt: 'A shop imports the delivery lists of its suppliers as CSV files. Each line is a problem. Select the stage of the pipeline that owns it.',
        hint: 'Inspect reads the text. Map says what each column means. Normalise changes one value into the form of the application. Reconcile compares rows with each other and with what is stored.',
        bins: ['Inspect', 'Map', 'Normalise', 'Reconcile'],
        why: 'Each stage has one question. A problem that is solved in the wrong stage is solved again, in a different way, in a different stage.',
        items: [
          { text: 'One supplier uses a semicolon between the cells, a different one uses a tab.', bin: 'Inspect', why: 'It is about the text of the file, before any meaning.' },
          { text: 'In a new file, the quantity is in a column named "Qty ord." and no known layout has that name.', bin: 'Map', why: 'Which column has which meaning is the mapping. A person gives it, or approves it.' },
          { text: '"1.250,5" must become 1250.5 kilograms.', bin: 'Normalise', why: 'One value, changed by the decimal sign that the mapping names.' },
          { text: 'The same delivery list arrives two times.', bin: 'Reconcile', why: 'It needs what is stored: the fingerprints of the rows that the application has.' },
          { text: 'A delivery and its cancellation are in the same file.', bin: 'Reconcile', why: 'Two rows that cancel each other. Only a stage that sees more than one row can know.' },
          { text: 'The date 04/05/2026: the fourth of May, or the fifth of April?', bin: 'Map', why: 'The format is part of the mapping. Normalise uses the format; it does not guess it.' }
        ] },
      { kind: 'choice', source: 'Studio, level 2', at: 'ps-level-2',
        prompt: 'A phone sends "pay the invoice" and loses the connection before the answer. The person pushes the button again. Which design makes sure that one payment is recorded?',
        hint: 'What is the same in the two requests, and who makes it?',
        options: [
          { text: 'The server refuses a second request with the same amount in the same minute.', why: 'Two real payments of the same amount exist. The server cannot know which case it sees.' },
          { text: 'The client sends one key for the action with each try. The store refuses a second row.', correct: true, why: 'The key is the identity of the intention. A replay gets the stored result. In the studio: the request key, and for an imported row the fingerprint.' },
          { text: 'The button is disabled after the first push.', why: 'It helps the person and it protects nothing: the first request possibly never arrived, and a different page can send again.' },
          { text: 'The server waits for a confirmation of the client before it saves.', why: 'The confirmation can be lost in the same way. The problem moves; it does not go away.' }
        ] },
      { kind: 'assign', source: 'Studio, level 3', at: 'ps-level-3',
        prompt: 'An application manages the stock of a small shop, and a person can type a sentence. For each step, select the verb.',
        hint: 'The model recommends. The application validates. The person approves. The application executes.',
        bins: ['Recommend', 'Validate', 'Approve', 'Execute'],
        why: 'Four verbs, three actors. A design that joins two verbs gives one actor an authority that it must not have.',
        items: [
          { text: 'From "we are low on the chocolate biscuits", a request: reorder product 1182, quantity up by 20 percent.', bin: 'Recommend', why: 'A request in a fixed form. It is an opinion.' },
          { text: 'Is "reorder" in the list of permitted capabilities?', bin: 'Validate', why: 'The allowlist. Code answers.' },
          { text: 'Does product 1182 exist, and what does 20 percent more cost?', bin: 'Validate', why: 'The facts of the application, and a figure that the application calculates.' },
          { text: '"Yes, order 24 boxes for R1 920."', bin: 'Approve', why: 'It spends money. A person says yes to the figure of the application.' },
          { text: 'The order service writes the order row.', bin: 'Execute', why: 'The same service that the order form calls.' },
          { text: 'The answer "product 9999" for a product that does not exist is refused.', bin: 'Validate', why: 'A value that the application cannot verify is not accepted.' }
        ] },
      { kind: 'choice', source: 'Studio, level 3', at: 'ps-key',
        prompt: 'A developer has a Max plan for the Claude apps. The developer wants the web application of a small product to call Claude for its users. What is correct?',
        hint: 'Read the table of the four ways to use Claude, and where the key lives.',
        options: [
          { text: 'Put the sign-in of the plan into the server, because the server is private.', why: 'The documents do not permit a product to use the sign-in of a plan for its users. A plan is for the person who has it.' },
          { text: 'Call the API from the browser with a key, and hide the key in the built JavaScript.', why: 'All that a browser gets, a person can read. A key in a page is public.' },
          { text: 'Use an API key from the Console, on the server only, with a spend limit.', correct: true, why: 'The API is the product for applications. The key stays in the environment of the server, and a workspace with a low limit is the last cost control.' },
          { text: 'Start Remote Control on the server and send the user requests to it.', why: 'Remote Control connects your own devices to your own Claude Code session. It is not an API.' }
        ] },
      { kind: 'choice', source: 'Studio, orchestration', at: 'ps-orchestration',
        prompt: 'A team wants "a planner agent, three worker agents and a judge agent" for a tool that renames 5 files by a fixed rule. What is the best answer?',
        hint: 'Which limit of a simpler level did the team name?',
        options: [
          { text: 'Build it, and measure if the judge agent finds errors.', why: 'The measurement comes after the cost. First name the limit that a simpler design has.' },
          { text: 'Use one agent, because three workers cost too much.', why: 'The rule is fixed, thus no model needs to decide anything.' },
          { text: 'A script. A fixed rule is code.', correct: true, why: 'Level 1 is sufficient. Orchestration answers many items, parallel calls, or one budget. None is here.' },
          { text: 'A graph with gates, because renames can fail.', why: 'A try and a clear error is enough for 5 files. Structure has a cost too.' }
        ] }
    ]
  };
})(window.GE);

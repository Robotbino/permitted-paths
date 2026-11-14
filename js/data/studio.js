/* studio.js: the data of the Practical Architecture Studio (part S).
   Added by this edition. It is not from the GE notes. Research date: 2026-11-14.

   The drawings are here. The text of each component and each connection (responsibility, data
   contract, file, test) is in the tables of index.html: the page shows the tables when there
   is no JavaScript, and the instrument reads the same tables, thus the text exists one time.

   A node has `level`: the level of the reference application that introduced it (1 to 4).
   The lens of a drawing makes the parts of a later level faint. In drawing F, `level` is the stage.
   The source code and the recorded runs are in studio-files.js and studio-runs.js (generated). */
(function (GE) {
  'use strict';
  var S = GE.data.studio = {};
  S.researched = '2026-11-14';
  S.repo = 'https://github.com/Robotbino/permitted-paths/blob/main/examples/personal-finance/';

  S.levels = [
    { n: 1, name: 'Ordinary software', short: 'An application' },
    { n: 2, name: 'Graph structure', short: 'An explicit graph' },
    { n: 3, name: 'Intelligence layer', short: 'An optional model' },
    { n: 4, name: 'Orchestration', short: 'Many runs' }
  ];

  var n = function (id, x, y, label, level, extra) { return Object.assign({ id: id, x: x, y: y, label: label, level: level }, extra || {}); };
  var e = function (from, to, level, extra) { return Object.assign({ from: from, to: to, level: level }, extra || {}); };
  var D = S.drawings = {};

  /* A. The system: the parts and the direction of each call. */
  D.system = {
    title: 'The system', lens: 'Level', w: 1040, h: 500, label: 'The parts of the personal finance application and the calls between them.',
    nodes: [
      n('pc', 100, 150, 'You, on the PC\nbrowser', 1, { type: 'person' }),
      n('phone', 100, 260, 'You, on the iPhone\nHome Screen', 1, { type: 'person' }),
      n('web', 300, 205, 'Web application\nReact, reducer', 1, { type: 'code' }),
      n('contracts', 410, 70, 'Shared contracts\nZod schemas', 1),
      n('http', 520, 205, 'HTTP server\nhandlers', 1, { type: 'code' }),
      n('svc', 740, 205, 'Services\nuse cases', 1, { type: 'code' }),
      n('dom', 930, 100, 'Domain\npure rules', 1, { type: 'code' }),
      n('repo', 930, 205, 'Repositories\nports', 1, { type: 'code' }),
      n('db', 930, 320, 'SQLite file', 1, { shape: 'pill', w: 120 }),
      n('graph', 740, 320, 'Execution graphs\nengine, gates, verifier', 2, { type: 'code' }),
      n('trace', 740, 430, 'Trace\ncontext graph', 2, { type: 'code' }),
      n('intel', 520, 320, 'Intelligence layer\nmemory, gate, prompt', 3, { type: 'code' }),
      n('model', 300, 320, 'Claude API\noptional', 3, { type: 'model' }),
      n('imp', 520, 430, 'Import orchestrator\nworkers, reconciler', 4, { type: 'code' })
    ],
    edges: [
      e('pc', 'web', 1), e('phone', 'web', 1),
      e('web', 'http', 1, { label: 'HTTP + JSON' }),
      e('contracts', 'web', 1, { kind: 'ref', toSide: 't' }), e('contracts', 'http', 1, { kind: 'ref', toSide: 't' }),
      e('http', 'svc', 1, { label: 'calls' }),
      e('svc', 'dom', 1, { fromSide: 't', toSide: 'l', via: [[740, 100]] }),
      e('svc', 'repo', 1),
      e('repo', 'db', 1, { label: 'SQL' }),
      e('svc', 'graph', 2, { label: 'runs' }),
      e('graph', 'repo', 2, { fromSide: 'r', toSide: 'b', via: [[870, 320], [870, 262], [930, 262]] }),
      e('graph', 'trace', 2, { label: 'each step' }),
      e('http', 'intel', 3),
      e('intel', 'model', 3, { label: 'merchant text' }),
      e('intel', 'graph', 3, { label: 'same engine' }),
      e('http', 'imp', 4, { fromSide: 'l', toSide: 'l', via: [[420, 205], [420, 430]] }),
      e('imp', 'intel', 4, { label: 'suggest runs' }),
      e('imp', 'graph', 4, { label: 'record runs', fromSide: 'r', toSide: 'b', via: [[640, 430], [640, 375], [700, 375]], to_: -40 })
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

  /* The import graph (level 4). The two worker nodes are outside the recorded graph: they are sub-runs. */
  D.importer = {
    title: 'Import a statement', lens: 'Level', graph: 'import-statement', w: 1040, h: 380, label: 'The orchestrator graph that imports a statement.',
    nodes: [
      n('parse', 90, 110, 'parse\nthe statement', 4, { type: 'code' }),
      n('classify', 260, 110, 'classify\none budget', 4, { type: 'code' }),
      n('await_person', 450, 110, 'await_person\ncheckpoint', 4, { type: 'person' }),
      n('apply', 640, 110, 'apply\nline by line', 4, { type: 'code' }),
      n('reconcile', 810, 110, 'reconcile\none end each', 4, { type: 'code', shape: 'gate' }),
      n('respond', 960, 110, 'respond', 4, { shape: 'pill', w: 110 }),
      n('reject', 90, 310, 'reject', 4, { shape: 'pill', w: 100 }),
      n('w_suggest', 260, 250, 'Suggest graph\nfor each merchant, 3 at a time', 3, { type: 'model', outside: true }),
      n('w_record', 640, 250, 'Record graph\nfor each decided line', 2, { type: 'code', outside: true })
    ],
    edges: [
      e('parse', 'reject', 4, { label: 'not a statement' }),
      e('parse', 'classify', 4),
      e('classify', 'await_person', 4),
      e('classify', 'w_suggest', 4, { kind: 'ref', label: 'workers', outside: true }),
      e('await_person', 'respond', 4, { label: 'wait for the person', fromSide: 't', toSide: 't', via: [[450, 30], [960, 30]], lx: 705, ly: 21 }),
      e('await_person', 'reject', 4, { label: 'decisions FAIL', fromSide: 'b', toSide: 'r', via: [[450, 310]], lx: 340, ly: 301 }),
      e('await_person', 'apply', 4, { label: 'decisions PASS', lx: 545, ly: 68 }),
      e('apply', 'w_record', 4, { kind: 'ref', label: 'workers', outside: true }),
      e('apply', 'reconcile', 4),
      e('reconcile', 'respond', 4)
    ]
  };

  /* C. The knowledge graph: the classes of the ontology and their relations. level 9: in the ontology, not built. */
  D.knowledge = {
    title: 'What the application knows', lens: 'Level', w: 1040, h: 420, label: 'The classes of the ontology and the relations between them.',
    nodes: [
      n('Expense', 420, 200, 'Expense', 1),
      n('Category', 700, 200, 'Category', 1),
      n('Budget', 700, 70, 'Budget', 1),
      n('Month', 930, 70, 'Month\nYYYY-MM', 1),
      n('Merchant', 420, 340, 'Merchant', 3),
      n('Rule', 930, 200, 'Rules R1 to R14', 2),
      n('Person', 110, 70, 'Person', 9),
      n('Account', 110, 200, 'Account', 9),
      n('Recurring', 110, 340, 'RecurringExpense', 9),
      n('Goal', 250, 70, 'SavingsGoal', 9),
      n('Income', 250, 340, 'Income', 9)
    ],
    edges: [
      e('Expense', 'Category', 1, { label: 'is in' }),
      e('Budget', 'Category', 1, { label: 'limits' }),
      e('Budget', 'Month', 1, { label: 'covers' }),
      e('Expense', 'Merchant', 1, { label: 'is paid to' }),
      e('Merchant', 'Category', 3, { label: 'is usually in', fromSide: 'r', toSide: 'b', via: [[700, 340]] }),
      e('Rule', 'Category', 2, { kind: 'ref', label: 'constrain' }),
      e('Person', 'Account', 9, { kind: 'ref', label: 'owns' }),
      e('Expense', 'Account', 9, { kind: 'ref', label: 'is paid from' }),
      e('Recurring', 'Expense', 9, { kind: 'ref', label: 'makes', fromSide: 't', toSide: 'l', via: [[110, 270], [300, 270], [300, 212]], to_: 12, lx: 205, ly: 261 }),
      e('Goal', 'Account', 9, { kind: 'ref', label: 'is funded from' }),
      e('Income', 'Account', 9, { kind: 'ref', label: 'is paid into', fromSide: 't', toSide: 'b', via: [[250, 285], [140, 285]], to_: 30, lx: 250, ly: 300 })
    ]
  };

  /* D. The context graph: the history of one expense, from the test "the learning loop". */
  D.context = {
    title: 'The history of one expense', lens: 'Level', w: 1040, h: 400, label: 'What the trace knows about one expense: two runs, their steps, and what they made.',
    nodes: [
      n('ask', 100, 90, 'You type\nEngen Garage', 3, { type: 'person' }),
      n('run1', 330, 90, 'Run run_0001\nsuggest-category, PASS', 3, { type: 'code' }),
      n('ev1', 330, 230, '6 trace events\nask_model: transport', 3, { type: 'model' }),
      n('decide', 560, 90, 'You select\nEating out', 3, { type: 'person' }),
      n('run2', 790, 90, 'Run run_0002\nrecord-expense, PASS', 2, { type: 'code' }),
      n('ev2', 790, 230, '9 trace events\na checkpoint after each', 2, { type: 'code' }),
      n('exp', 960, 340, 'Expense\nexp_0001', 1, { w: 110 }),
      n('mem', 620, 340, 'Memory row\nengen garage: eating-out', 3)
    ],
    edges: [
      e('ask', 'run1', 3, { label: 'starts' }),
      e('run1', 'ev1', 3, { label: 'has' }),
      e('run1', 'decide', 3, { label: 'offers "Transport"', lx: 445, ly: 56 }),
      e('decide', 'run2', 3, { label: 'starts' }),
      e('run2', 'run1', 3, { kind: 'ref', label: 'parent_run_id', fromSide: 't', toSide: 't', via: [[790, 25], [330, 25]], lx: 560, ly: 16 }),
      e('run2', 'ev2', 2, { label: 'has' }),
      e('run2', 'exp', 2, { label: 'subject_id', fromSide: 'r', toSide: 't', via: [[960, 90]], lx: 990, ly: 215 }),
      e('mem', 'run2', 3, { kind: 'ref', label: 'source_run_id', fromSide: 't', toSide: 'b', via: [[620, 180], [740, 180]], to_: -50, lx: 620, ly: 215 })
    ]
  };

  /* E. The intelligence plane: what the system knows, as files and tables, and what uses each item. */
  D.plane = {
    title: 'The intelligence plane', lens: 'Level', w: 1040, h: 440, label: 'The knowledge of the system, and the part of the execution that uses each item.',
    groups: [{ x: 14, y: 16, w: 1012, h: 180, label: 'INTELLIGENCE PLANE: WHAT THE SYSTEM KNOWS (FILES AND TABLES THAT A PERSON CAN READ)' }, { x: 14, y: 250, w: 1012, h: 176, label: 'EXECUTION: WHAT RUNS' }],
    nodes: [
      n('k_contracts', 110, 85, 'Contracts\nshared/contracts.ts', 1),
      n('k_onto', 290, 85, 'Ontology\nrules R1 to R14', 2),
      n('k_proc', 470, 85, 'Procedures\nthe three graphs', 2),
      n('k_prompt', 640, 85, 'Prompt\nsuggest-category.md', 3),
      n('k_memory', 800, 85, 'Merchant memory\na table', 3),
      n('k_trace', 950, 85, 'Trace\nruns, events', 2),
      n('k_cases', 575, 166, 'Scenarios and recordings', 2, { w: 210 }),
      n('x_web', 110, 340, 'Web form\nHTTP server', 1, { type: 'code' }),
      n('x_gates', 290, 340, 'Gates\nverifier', 2, { type: 'code' }),
      n('x_engine', 470, 340, 'Graph engine', 2, { type: 'code' }),
      n('x_model', 640, 340, 'Model call', 3, { type: 'model' }),
      n('x_suggest', 800, 340, 'Suggest graph', 3, { type: 'code' }),
      n('x_you', 950, 340, 'You', 1, { type: 'person' })
    ],
    edges: [
      e('k_contracts', 'x_web', 1, { label: 'types, checks' }),
      e('k_onto', 'x_gates', 2, { label: 'rule ids' }),
      e('k_proc', 'x_engine', 2, { fromSide: 'l', toSide: 't', via: [[380, 85], [380, 250], [440, 250]], to_: -30, label: 'nodes, edges', lx: 380, ly: 225 }),
      e('k_cases', 'x_engine', 2, { label: 'tests', fromSide: 'b', toSide: 't', via: [[575, 290], [500, 290]], to_: 30, lx: 540, ly: 281 }),
      e('k_prompt', 'x_model', 3, { label: 'system prompt' }),
      e('k_memory', 'x_suggest', 3, { label: 'asked first' }),
      e('x_engine', 'k_trace', 2, { kind: 'ref', label: 'writes', fromSide: 'r', toSide: 'b', via: [[560, 340], [560, 222], [900, 222]], to_: -50, lx: 730, ly: 213 }),
      e('k_trace', 'x_you', 2, { label: 'what happened' }),
      e('x_you', 'k_memory', 3, { kind: 'ref', label: 'each recorded expense', fromSide: 'l', toSide: 'b', via: [[880, 340], [880, 265], [830, 265]], to_: 30, lx: 880, ly: 285 })
    ]
  };

  /* F. Deployment. Here `level` is the stage: 1 the PC only, 2 a private path to the PC, 3 a small host. */
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
    importer: { drawing: 'importer', scenarios: ['import_statement'], twoSteps: true }
  };

  /* The checks at the end of each level, and the exercises. Each is one question with a cause for each answer. */
  S.checks = {
    l1_state: {
      q: 'The budget panel shows "R185.00 of R4 500.00". Which part of the application owns the number R185.00?',
      options: [
        { text: 'The reducer of the web application. It adds each amount that the form sends.', why: 'The web application does not calculate money. After each record it asks the server again. A second device would have a different number.' },
        { text: 'A column "spent" in the budgets table. The service adds to it on each save.', why: 'No table has that column. A stored total can disagree with the expenses; then one of the two is wrong and you do not know which.' },
        { text: 'No part stores it. The store adds the expenses of the category and the month each time.', correct: true, why: 'Rule R10. The expenses are the truth, and "spent" is a question to them. Thus no code can make the two disagree.' }
      ]
    },
    l1_layers: {
      q: 'You must add the rule "an expense is not more than R50 000". Which one file gets the rule?',
      options: [
        { text: 'web/src/ExpenseForm.tsx, because the person must see the problem immediately.', why: 'A rule only in the form is not a rule: a request can come from a script, from the import, or from an old page. The form can show it, but it cannot own it.' },
        { text: 'shared/money.ts and shared/contracts.ts: it is a limit on the value of one field.', correct: true, why: 'It reads only the request, thus it is a rule of shape (R1 has this form already). The web application and the server import the same file.' },
        { text: 'server/domain/expense-rules.ts, because it is a business rule.', why: 'That file holds the rules that need facts from the store: today, the category, similar expenses. This rule needs no fact.' },
        { text: 'server/repositories/sqlite.ts, as a check before the INSERT.', why: 'A repository stores and reads. If it also decides, a test with the memory store does not see the rule.' }
      ]
    },
    l2_gate: {
      q: 'A request has the correct shape, but its date is tomorrow. Which node gives FAIL?',
      options: [
        { text: 'Gate 1, because the date field is wrong.', why: 'Gate 1 gets only the request. It cannot know what "today" is, thus it cannot know that the date is in the future. The date is a real date, and that is all that Gate 1 checks.' },
        { text: 'Gate 2, because the answer needs a fact that is not in the request.', correct: true, why: 'Rule R5 compares the date with today. Today is a fact from the clock, and load_facts reads it before Gate 2.' },
        { text: 'The verifier, after the save.', why: 'The verifier checks that the ledger agrees with the graph. A request that Gate 2 refuses never gets to commit.' }
      ]
    },
    l2_missing: {
      q: 'The path tests have nine scenarios. Which of these paths has no scenario, and thus no test?',
      options: [
        { text: 'The store fails one time during the save, then the save is good.', why: 'This is the scenario save_fails_once. It goes through commit, backoff and commit again.' },
        { text: 'The store does not answer when dedupe looks for the request key.', correct: true, why: 'The edge dedupe to escalate exists, and no scenario uses it. The test "the graph is complete" lists it, with two more. An edge with no test is a path that nobody has seen work.' },
        { text: 'A defect saves a different amount than the proposal.', why: 'This is the scenario ledger_mismatch. The verifier gives FAIL and the run goes to escalate.' }
      ]
    },
    l3_authority: {
      q: 'The model answers "groceries" for a merchant. What changed in the database at that moment?',
      options: [
        { text: 'Nothing changed in the ledger and nothing in the memory. Only the trace has one more run.', correct: true, why: 'The suggest graph gets a function that lists categories, the memory to read, and the suggester. It gets no store that can write. The memory changes only when the person records an expense (R13).' },
        { text: 'The merchant memory has a new row, thus the next request is faster.', why: 'If the model could teach the memory, a wrong answer would become "what the person usually selects". Only a recorded expense teaches the memory.' },
        { text: 'The expense has a draft row with the suggested category.', why: 'There is no draft. Until the person pushes Record, the server knows nothing about the expense.' }
      ]
    },
    l3_needs: {
      q: 'A new requirement: "Show how much I spent on transport in March." Which part does this work?',
      options: [
        { text: 'The model, with the March expenses in its prompt.', why: 'A model can add a column of numbers wrong, and you cannot see when it does. This question has one exact answer and SQL gives it.' },
        { text: 'Code: one query with SUM, through the repository.', correct: true, why: 'It is arithmetic on data that the application owns. A model adds cost, time and a possible error, and it adds no ability.' },
        { text: 'A new agent with a tool that reads the ledger.', why: 'An agent decides which steps to do. Here the steps are known before the request arrives: one query.' }
      ]
    },
    l4_budget: {
      q: 'Three suggest workers start at the same moment. Each one reads "0 model calls today, the limit is 2" from the trace. How many model calls happen?',
      options: [
        { text: 'Two. The third worker sees that the limit is used.', why: 'Each worker read the count before any of them wrote its run to the trace. No worker can see the other two.' },
        { text: 'Three, if each worker does its own count. Thus the orchestrator counts, one time, before the workers start.', correct: true, why: 'This is why level 4 needs an orchestrator. A limit across parallel workers needs one owner. classify gives a model call to the first merchants and tells the other workers that they have none.' },
        { text: 'None. The engine refuses parallel runs.', why: 'The engine runs one graph. The pool starts three runs of the suggest graph, and each is independent.' }
      ]
    },
    l4_justified: {
      q: 'A new requirement: "Tell me why I am over budget in March." Does it need the orchestration of level 4?',
      options: [
        { text: 'Yes. One worker for each category, then an evaluator agent that checks the answer.', why: 'The queries take milliseconds, thus parallel workers gain nothing. An evaluator that checks numbers is a deterministic gate, which level 3 has.' },
        { text: 'No. Code gets the numbers. A model can write the sentence around numbers that code puts in.', correct: true, why: 'If code inserts each figure, there is no figure of the model to check. This is a second use of level 3, or of level 1 with no model.' },
        { text: 'Yes, because the question has the word "why".', why: 'The form of a question does not decide the architecture. The decision comes from a limit that you can name: many items, parallel calls, a wait, a budget.' }
      ]
    },
    deploy_sync: {
      q: 'You record an expense on the PC. The iPhone shows it one minute later. Where is the expense stored?',
      options: [
        { text: 'In the storage of the two browsers, which the browsers keep the same.', why: 'A browser does not share its storage with a different device. Storage of a browser is for that browser only.' },
        { text: 'In the one database of the server. The two devices ask the same server.', correct: true, why: 'There is one copy of the truth, thus there is nothing to merge. The cost: no server, no data. Offline writes are postponed.' },
        { text: 'In iCloud, because the iPhone installed the application.', why: 'A Home Screen web app is a web page with its own window. It has no connection to iCloud storage.' }
      ]
    }
  };

  /* The gate of the part. */
  GE.data.gates.studio = {
    title: 'Gate of the studio: can you place each responsibility?',
    questions: [
      { kind: 'assign', source: 'Studio, levels 1 to 4', at: 'ps-map',
        prompt: 'A team builds an application that books a meeting room. Each sentence is a responsibility. Select the part of the architecture that owns it.',
        hint: 'Ask what the part needs to read. Only the request? The current facts? What was stored after the write? What happened before?',
        bins: ['Gate 1', 'Gate 2', 'Verifier', 'Trace'],
        why: 'The four parts differ in what they read: the request, the facts, the stored result, the history.',
        items: [
          { text: 'The end time must be a real time in the form HH:MM.', bin: 'Gate 1', why: 'It reads only the request.' },
          { text: 'The room must be free at that time.', bin: 'Gate 2', why: 'It needs a fact from the store: the bookings that exist now.' },
          { text: 'After the save, the room has exactly one booking for that hour.', bin: 'Verifier', why: 'It reads what is stored after the write, with its own query.' },
          { text: 'Which request was refused yesterday, and by which rule?', bin: 'Trace', why: 'It is a question about history. The bookings table has no row for a refused request.' },
          { text: 'The room id must be text of 1 to 20 characters.', bin: 'Gate 1', why: 'It is the shape of one field.' },
          { text: 'A person cannot book more than 3 rooms in one day.', bin: 'Gate 2', why: 'It needs the count of bookings of that person, a fact from the store.' }
        ] },
      { kind: 'choice', source: 'Studio, level 1', at: 'ps-level-1',
        prompt: 'A parking application stores prices as numbers such as 12.5 (rand). After a year, the monthly report is 3 cents different from the bank. What is the cause, and the repair?',
        hint: 'Read what the studio says about 0.1 + 0.2.',
        options: [
          { text: 'Binary floats cannot hold most decimal fractions. Store integer cents.', correct: true, why: 'Each sum adds a very small error. Integer cents are exact, and text becomes cents by string operations.' },
          { text: 'The report rounds each line. Round only the total, to two decimals, at the end.', why: 'The error is in the stored values and in each addition, before a report rounds anything.' },
          { text: 'The database has too little precision. Use a column type with more digits.', why: 'More digits of a binary float are still a binary float.' },
          { text: 'Two requests changed the total at the same time. Add a lock around the update.', why: 'A race gives a difference of a full price, not of 3 cents.' }
        ] },
      { kind: 'choice', source: 'Studio, level 2', at: 'ps-level-2',
        prompt: 'A phone sends "pay the invoice" and loses the connection before the answer. The person pushes the button again. Which design makes sure that one payment is recorded?',
        hint: 'What is the same in the two requests, and who makes it?',
        options: [
          { text: 'The server refuses a second request with the same amount in the same minute.', why: 'Two real payments of the same amount exist. The server cannot know which case it sees.' },
          { text: 'The client sends one key for the action with each try. The store refuses a second row.', correct: true, why: 'The key is the identity of the intention. A replay gets the stored result. In the studio: idempotency_key, UNIQUE, the node dedupe.' },
          { text: 'The button is disabled after the first push.', why: 'It helps the person and it protects nothing: the first request possibly never arrived, and a different page can send again.' },
          { text: 'The server waits for a confirmation of the client before it saves.', why: 'The confirmation can be lost in the same way. The problem moves; it does not go away.' }
        ] },
      { kind: 'assign', source: 'Studio, levels 3 and 4', at: 'ps-level-3',
        prompt: 'An application manages the stock of a small shop. Who does each of these: code, a model, or a person?',
        hint: 'A model is for language and judgement where a small error is seen and corrected. Arithmetic and rules are code. A change that costs money needs a person.',
        bins: ['Code', 'Model', 'Person'],
        why: 'Code for what has one correct answer. A model for a proposal from messy text. A person for the decision.',
        items: [
          { text: 'Add the quantities of each product in the stock list.', bin: 'Code', why: 'Arithmetic has one correct answer.' },
          { text: 'Read "2 bx choc digestives 400g" on a supplier note and propose the product.', bin: 'Model', why: 'Messy text to a proposal. A gate checks that the product exists.' },
          { text: 'Approve an order of R40 000 to a new supplier.', bin: 'Person', why: 'It spends money and cannot be undone easily.' },
          { text: 'Refuse a sale when the stock is 0.', bin: 'Code', why: 'A rule against a current fact: a Gate 2.' },
          { text: 'Decide that "choc digestives" always means product 1182 from now on.', bin: 'Person', why: 'It changes the memory of the system. In the studio, only a decision of the person teaches the memory.' }
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
      { kind: 'choice', source: 'Studio, level 4', at: 'ps-level-4',
        prompt: 'A team wants "a planner agent, three worker agents and a judge agent" for a tool that renames 5 files by a fixed rule. What is the best answer?',
        hint: 'Which limit of a simpler level did the team name?',
        options: [
          { text: 'Build it, and measure if the judge agent finds errors.', why: 'The measurement comes after the cost. First name the limit that a simpler design has.' },
          { text: 'Use one agent, because three workers cost too much.', why: 'The rule is fixed, thus no model needs to decide anything.' },
          { text: 'A script. A fixed rule is code.', correct: true, why: 'Level 1 is sufficient. Orchestration answers many items, parallel calls, a wait for a person, or one budget. None is here.' },
          { text: 'A graph with gates, because renames can fail.', why: 'A try and a clear error is enough for 5 files. Structure has a cost too.' }
        ] }
    ]
  };
})(window.GE);

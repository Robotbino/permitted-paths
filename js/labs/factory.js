/* factory.js: the instruments of part 6.
   - factory: the execution graph of the game store software factory, as a simulation (GE 06, sections 5 to 7).
   - transitions: the permitted transitions of the status of an order (GE 06, section 3).
   The plans and the test results of the agent are fixed for each scenario. No model operates here. */
(function (GE) {
  'use strict';
  var h = GE.h, O = GE.onto;
  var MAX_ATTEMPTS = 2; // an example value; the notes say only that each cycle has a maximum

  var SCENARIOS = [
    { id: 'A', label: 'A. Show orders that wait for delivery', request: 'Show orders that wait for delivery', type: 'FEATURE', context: ['BR-R1'],
      plans: [{ entities: ['Order'], statuses: ['PENDING_SHIP'], rules: ['R1'], files: ['OrderListPage'] },
              { entities: ['Order'], statuses: ['PAID'], rules: ['R1'], files: ['OrderListPage'] }],
      tests: [[]],
      loop: 'The agent adds the value PENDING_SHIP. Some screens show the value and some screens do not.',
      after: 'The plan gate found that PENDING_SHIP is not in rule R1. The agent got the cause. Its second plan uses a filter on the status PAID.' },
    { id: 'B', label: 'B. Add a refund button', request: 'Add a refund button to the order page', type: 'FEATURE', context: ['BR-R2', 'CODE-RefundService', 'TEST-second-refund'],
      plans: [{ entities: ['Order', 'Refund'], statuses: ['REFUNDED'], rules: ['R2'], files: ['OrderPage', 'RefundService'] }],
      tests: [['Rule R2: the test “the service rejects a second refund” gives FAIL.'], []],
      loop: 'The endpoint operates. A second click makes a second refund.',
      after: 'Node 2 gave rule R2 and its test to the agent. The first version of the code did not obey the rule. The rule test gave FAIL at the rule gate, and the agent corrected the code. This run has the same path as run 57 in GE 06, section 7. That is an example by this edition.' },
    { id: 'C1', label: 'C. Give back a game, run 1', request: 'Let a customer give back a game', type: 'FEATURE', context: ['BR-R2', 'BR-R7'], pair: 'C',
      plans: [{ entities: ['Return'], statuses: ['RETURNED'], rules: [], files: ['ReturnService'] },
              { entities: ['Refund'], statuses: ['REFUNDED'], rules: ['R2', 'R7'], files: ['RefundService'] }],
      tests: [[]],
      loop: 'Run 1 adds an entity Return and the status RETURNED.',
      after: 'The plan gate rejected Return and RETURNED. They are not in the ontology. After the gate, the plan uses Refund and REFUNDED.' },
    { id: 'C2', label: 'C. Give back a game, run 2', request: 'Let a customer give back a game', type: 'FEATURE', context: ['BR-R2', 'BR-R7'], pair: 'C',
      plans: [{ entities: ['Return'], statuses: ['RETURNED'], rules: [], files: ['ReturnController'] },
              { entities: ['Refund'], statuses: ['REFUNDED'], rules: ['R2', 'R7'], files: ['RefundController', 'RefundService'] }],
      tests: [[]],
      loop: 'Run 2 uses Refund and REFUNDED. The two runs of the loop give two different designs.',
      after: 'In this run also, the plan gate rejected Return and RETURNED. After the gate, the plan uses Refund and REFUNDED. The files are different from run 1.' },
    { id: 'H', label: 'Add the status ON_HOLD', request: 'Add the status ON_HOLD', type: 'FEATURE', context: ['BR-R1'],
      plans: [{ entities: ['Order'], statuses: ['ON_HOLD'], rules: ['R1'], files: ['Order'] }],
      tests: [[]],
      loop: 'The notes give no result for this request with one loop. Scenario A shows what occurs when an agent adds a value.', noLoopResult: true,
      after: 'The plan gate rejected the plan two times. At the maximum, the run went to a person. A change to the ontology is a change request: a person gives approval, and the ontology gets a new version.' },
    { id: 'Q', label: 'A question about a rule', request: 'Which rule gives the maximum number of refunds?', type: 'QUESTION', context: ['BR-R2'],
      plans: [], tests: [],
      loop: 'With no knowledge graph, the agent does a search of the full repository to find the rule.', noLoopResult: true,
      after: 'The answer came from the knowledge graph. No agent wrote a plan or code.' }
  ];
  var NUMBER = { IN: '1', RET: '2', PLAN: '3', G1: '4', HUM: '5', IMP: '6', TEST: '7', G2: '8', REV: '9', PR: '10', REC: '11', UPD: '12', ANS: 'answer', ESC: 'escalate' };
  var FIELDS = [
    ['request', 'The caller'], ['request_type', '1 Intake'], ['context', '2 Retrieve'], ['plan', '3 Plan'], ['plan_attempts', '3 Plan'],
    ['plan_problems', '4 Plan gate'], ['approved', '5 Approval'], ['branch', '6 Implement'], ['attempts', '6 Implement'],
    ['test_report', '7 Tests'], ['rule_problems', '8 Rule gate'], ['review', '9 Review']
  ];

  function factoryGraph(opts) {
    opts = opts || {};
    function texts(problems) { return problems.map(function (p) { return p.text; }); }
    var nodes = [
      { id: 'IN', act: function (s, c) { return { writes: { request_type: c.scenario.type }, note: 'The request is a ' + c.scenario.type + '.' }; } },
      { id: 'RET', act: function (s, c) { return { writes: { context: c.scenario.context }, note: 'A query gets the related nodes: ' + c.scenario.context.join(', ') + '.' }; } },
      { id: 'ANS', act: function () { return { note: 'A model writes the answer from the facts of the knowledge graph.' }; } },
      { id: 'PLAN', act: function (s, c) {
        var n = s.plan_attempts || 0, plans = c.scenario.plans, plan = plans[Math.min(n, plans.length - 1)];
        return { writes: { plan: plan, plan_attempts: n + 1 }, note: 'The agent writes a typed plan. Attempt ' + (n + 1) + '. Status values: ' + plan.statuses.join(', ') + '. Entities: ' + plan.entities.join(', ') + '.' };
      } },
      { id: 'G1', act: function (s) {
        if (opts.noPlanGate) return { writes: { plan_problems: [] }, note: 'The plan gate is not in the graph in this run. No node examines the plan.' };
        var problems = texts(O.planGate(s.plan));
        return { writes: { plan_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? problems.join(' ') : 'Each entity and each status value of the plan is in the ontology.' };
      } },
      { id: 'HUM', act: function () { return { writes: { approved: true }, note: 'A person gives approval for the plan.' }; } },
      { id: 'IMP', act: function (s, c) { var n = (s.attempts || 0) + 1; return { writes: { branch: 'change/' + c.scenario.id.toLowerCase(), attempts: n }, note: 'The agent writes the code in an isolated branch. Attempt ' + n + '.' }; } },
      { id: 'TEST', act: function (s, c) {
        var t = c.scenario.tests, failed = t[Math.min(s.attempts - 1, t.length - 1)];
        return { writes: { test_report: { failed: failed } }, note: 'Code does the tests. The rule tests come from the protected main branch.' };
      } },
      { id: 'G2', act: function (s) {
        var problems = s.test_report.failed;
        return { writes: { rule_problems: problems }, result: problems.length ? 'FAIL' : 'PASS', note: problems.length ? problems.join(' ') : 'Each related rule has a test with the result PASS.' };
      } },
      { id: 'REV', act: function () { return { writes: { review: 'ACCEPT' }, note: 'A different agent examines the change. Result: ACCEPT.' }; } },
      { id: 'PR', act: function () { return { note: 'Code opens the pull request with the evidence.' }; } },
      { id: 'REC', act: function () { return { note: 'Code writes the trace of the run.' }; } },
      { id: 'UPD', act: function (s, c) { return { note: c.scenario.lesson ? 'Code adds the lesson to the knowledge graph: “' + c.scenario.lesson + '”' : 'Code updates the knowledge graph. This run gave no new lesson.' }; } },
      { id: 'ESC', act: function () { return { result: 'FAIL', note: 'The maximum number of attempts is reached. The run goes to a person.' }; } }
    ];
    var none = function (list) { return !list || !list.length; };
    var edges = [
      { from: 'IN', to: 'RET' },
      { from: 'RET', to: 'ANS', when: function (s) { return s.request_type === 'QUESTION'; } }, { from: 'RET', to: 'PLAN' },
      { from: 'PLAN', to: 'G1' },
      { from: 'G1', to: 'HUM', when: function (s) { return none(s.plan_problems); } },
      { from: 'G1', to: 'ESC', when: function (s) { return s.plan_attempts >= MAX_ATTEMPTS; } }, { from: 'G1', to: 'PLAN' },
      { from: 'HUM', to: 'IMP', when: function (s) { return s.approved; } },
      { from: 'HUM', to: 'ESC', when: function (s) { return s.plan_attempts >= MAX_ATTEMPTS; } }, { from: 'HUM', to: 'PLAN' },
      { from: 'IMP', to: 'TEST' }, { from: 'TEST', to: 'G2' },
      { from: 'G2', to: 'REV', when: function (s) { return none(s.rule_problems); } },
      { from: 'G2', to: 'ESC', when: function (s) { return s.attempts >= MAX_ATTEMPTS; } }, { from: 'G2', to: 'IMP' },
      { from: 'REV', to: 'PR', when: function (s) { return s.review === 'ACCEPT'; } },
      { from: 'REV', to: 'ESC', when: function (s) { return s.attempts >= MAX_ATTEMPTS; } }, { from: 'REV', to: 'IMP' },
      { from: 'PR', to: 'REC' }, { from: 'ANS', to: 'REC' }, { from: 'ESC', to: 'REC' }, { from: 'REC', to: 'UPD' }
    ];
    return {
      start: 'IN', nodes: nodes, edges: edges,
      owners: { request_type: 'IN', context: 'RET', plan: 'PLAN', plan_attempts: 'PLAN', plan_problems: 'G1', approved: 'HUM', branch: 'IMP', attempts: 'IMP', test_report: 'TEST', rule_problems: 'G2', review: 'REV' }
    };
  }
  GE.factoryGraph = factoryGraph; GE.factoryScenarios = SCENARIOS;

  function show(field, v) {
    if (v == null) return '—';
    if (field === 'plan') return 'entities: ' + v.entities.join(', ') + ' · status: ' + v.statuses.join(', ') + ' · rules: ' + (v.rules.join(', ') || 'none') + ' · files: ' + v.files.join(', ');
    if (field === 'test_report') return v.failed.length ? 'rule tests: FAIL (' + v.failed.length + ')' : 'rule tests: PASS';
    if (Array.isArray(v)) return v.length ? v.join(' ') : '[ ] (no problems)';
    if (v === true) return 'yes';
    return String(v);
  }

  GE.labs.factory = function (el, chapter) {
    var graph = factoryGraph(), noGate = false, guess = null;
    var host = h('div');
    var view = GE.graphView(host, GE.data.graphs.factory, { minScale: 0.8 });
    var scenario = SCENARIOS[0], player = null, run = null, pairResults = {};
    var stateBody = h('tbody');
    var log = h('ol', { class: 'log', 'data-empty': 'The run did not start.' });
    var loopText = h('p'), reqText = h('p', { class: 'case-text' });
    var result = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var start = h('button', { type: 'button', class: 'btn' }, 'Start the run');
    var step = h('button', { type: 'button', class: 'btn ghost' }, 'One step');
    var reset = h('button', { type: 'button', class: 'btn ghost' }, 'Reset');
    var cells = {};
    var loopNote = h('p', { class: 'small muted' }, 'Nothing stops it.');
    var now = h('p', { class: 'factory-now', 'aria-live': 'polite' });
    var NAME = {};
    GE.data.graphs.factory.nodes.forEach(function (n) { NAME[n.id] = n.label.split('\n')[0]; });

    FIELDS.forEach(function (f) {
      var value = h('td', { class: 'mono state-v' }, '—');
      cells[f[0]] = value;
      stateBody.appendChild(h('tr', null, h('td', { class: 'mono' }, f[0]), value, h('td', { class: 'small' }, f[1])));
    });
    function setField(name, v) {
      var td = cells[name]; if (!td) return;
      td.textContent = show(name, v);
      td.parentNode.classList.remove('is-written'); void td.offsetWidth; td.parentNode.classList.add('is-written');
    }
    function prepare() {
      if (player) player.stop();
      graph = factoryGraph({ noPlanGate: noGate });
      run = GE.runGraph(graph, { scenario: scenario, initial: { request: scenario.request } });
      view.reset(); GE.clear(log); GE.clear(result);
      view.mark('G1', 'suggested', noGate);
      guess = null; guessSeg.set(null, true);
      now.textContent = 'The run is ready. Before you start it, make your prediction: which node gives the first FAIL result?';
      Object.keys(cells).forEach(function (k) { cells[k].textContent = '—'; cells[k].parentNode.classList.remove('is-written'); });
      cells.request.textContent = scenario.request;
      reqText.textContent = '“' + scenario.request + '”';
      loopText.textContent = scenario.loop;
      loopNote.hidden = !!scenario.noLoopResult;
      start.disabled = true; step.disabled = true; start.textContent = 'Start the run';
      player = GE.player(view, run.steps, {
        speed: 480,
        onStep: function (st) {
          Object.keys(st.writes).forEach(function (k) { setField(k, st.writes[k]); });
          log.appendChild(h('li', { class: st.result === 'FAIL' ? 'is-fail' : '' }, h('span', null, NUMBER[st.node]), h('span', null, (st.result ? st.result + '. ' : '') + st.note)));
          log.scrollTop = log.scrollHeight;
          GE.clear(now);
          now.appendChild(h('strong', null, NAME[st.node] + '. '));
          if (st.result) now.appendChild(GE.stamp(st.result));
          now.appendChild(document.createTextNode(' ' + st.note));
        },
        onState: function (s) { start.textContent = s === 'playing' ? 'Pause' : 'Continue the run'; if (s === 'done') { run.done = true; start.disabled = true; step.disabled = true; start.textContent = 'The run is complete'; reset.focus({ preventScroll: true }); } },
        onDone: finish
      });
    }
    function finish() {
      var path = run.path.map(function (id) { return NUMBER[id]; });
      var firstFail = run.steps.filter(function (s) { return s.result === 'FAIL'; })[0];
      var escalated = run.path.indexOf('ESC') >= 0;
      var missed = noGate && run.state.plan ? O.planGate(run.state.plan) : [];
      var actual = firstFail ? (firstFail.node === 'G1' ? '4 Plan gate' : firstFail.node === 'G2' ? '8 Rule gate' : 'No node') : 'No node';
      GE.clear(result);
      if (noGate && missed.length) result.appendChild(h('p', null, GE.stamp('FAIL'), ' With no plan gate, no node examined the plan. ' + missed.map(function (p) { return p.text; }).join(' ') + ' These values are in the pull request now. In this simulation, the person and the review agent did not find the problem: no node has the responsibility to compare the plan with the ontology. This run is an example by this edition.'));
      else if (noGate) result.appendChild(h('p', null, GE.stamp('PASS'), ' The plan of this request uses only entities and status values of the ontology. Thus the run is the same with no plan gate. Try request A, C or ON_HOLD.'));
      else result.appendChild(h('p', null, GE.stamp(escalated ? 'FAIL' : 'PASS'), ' ', scenario.after));
      result.appendChild(h('p', null, 'Your prediction: ', h('strong', null, guess), '. The first FAIL result: ', h('strong', null, actual), '. ', guess === actual ? 'Correct.' : 'Not correct. Look at the steps of the run to see why.'));
      result.appendChild(h('p', { class: 'panel-title' }, 'The trace of this run (a context graph)'));
      var dl = h('dl', { class: 'kv' },
        h('dt', null, 'went on the path'), h('dd', { class: 'mono' }, path.join(', ')),
        h('dt', null, 'got FAIL first at'), h('dd', null, firstFail ? NUMBER[firstFail.node] + (firstFail.node === 'G1' ? ' Plan gate' : firstFail.node === 'G2' ? ' Rule gate' : '') : 'no node'));
      if (run.state.plan && !escalated) { dl.appendChild(h('dt', null, 'entities and status values after the gate')); dl.appendChild(h('dd', { class: 'mono' }, run.state.plan.entities.concat(run.state.plan.statuses).join(', '))); }
      if (scenario.lesson) { dl.appendChild(h('dt', null, 'gave the lesson')); dl.appendChild(h('dd', null, scenario.lesson + ' The lesson changes node 2, Retrieve.')); }
      result.appendChild(dl);
      if (scenario.pair) {
        pairResults[scenario.id] = run.state.plan.entities.concat(run.state.plan.statuses).join(', ') + '; files: ' + run.state.plan.files.join(', ');
        if (pairResults.C1 && pairResults.C2) result.appendChild(h('p', null, h('strong', null, 'The two runs of scenario C. '), 'Run 1: ' + pairResults.C1 + '. Run 2: ' + pairResults.C2 + '. The files and the text of the code are different. The entities, the status values and the tests are the same. The model stays probabilistic. The parts that must not change stay the same.'));
        else result.appendChild(h('p', { class: 'small' }, 'Now do the other run of scenario C, and compare the two results.'));
      }
      GE.trace.lab('factory:' + scenario.id, chapter);
    }
    start.addEventListener('click', function () { if (player.isPlaying()) player.pause(); else player.play(); });
    step.addEventListener('click', function () { player.step(); });
    reset.addEventListener('click', prepare);

    var guessSeg = GE.segmented('Your prediction', ['No node', '4 Plan gate', '8 Rule gate'], null, function (v) {
      guess = v; if (player && !run.done) { start.disabled = false; step.disabled = false; }
    });
    var gateBox = h('input', { type: 'checkbox', id: 'fac-nogate' });
    gateBox.addEventListener('change', function () { noGate = gateBox.checked; prepare(); });
    var seg = GE.segmented('Request', SCENARIOS.map(function (s) { return { value: s.id, label: s.label }; }), 'A', function (id) {
      scenario = SCENARIOS.filter(function (s) { return s.id === id; })[0]; prepare();
    });
    el.appendChild(h('p', { class: 'panel-title' }, 'The request'));
    el.appendChild(seg.el);
    el.appendChild(h('p', { class: 'check-row' }, gateBox, h('label', { for: 'fac-nogate' }, 'Remove the plan gate from the graph. This is a test: what does the gate prevent?')));
    el.appendChild(h('p', { class: 'panel-title' }, 'Your prediction: which node gives the first FAIL result?'));
    el.appendChild(guessSeg.el);
    el.appendChild(h('div', { class: 'factory-head' }, reqText, h('div', { class: 'controls' }, start, step, reset), now));
    el.appendChild(h('div', { class: 'factory-layout' },
      h('div', null, host, GE.legend(), h('p', { class: 'small muted' }, 'Each cycle has a maximum of ' + MAX_ATTEMPTS + ' attempts in this simulation. On the drawing, “try again” is “no, try again”, and “maximum reached” is “no, maximum reached”.')),
      h('div', { class: 'factory-side' },
        h('div', { class: 'panel loop-panel' }, h('p', { class: 'panel-title' }, 'With one agent loop'), loopText, loopNote),
        h('p', { class: 'panel-title' }, 'With the factory: the state contract'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'state' }, h('thead', null, h('tr', null, h('th', null, 'Field'), h('th', null, 'Value'), h('th', null, 'Owner'))), stateBody)),
        h('p', { class: 'panel-title' }, 'The steps of the run'), log)));
    el.appendChild(result);
    prepare();
  };

  /* ---- The permitted transitions ---- */
  GE.labs.transitions = function (el, chapter) {
    var from = null;
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' }, 'Select the status that the order has now.');
    var view = GE.graphView(el, GE.data.graphs.transitions, { interactive: true, onNode: function (id) {
      if (!from) {
        view.reset(); from = id; view.mark(id, 'selected', true);
        out.textContent = 'The order has the status ' + id + '. Now select the new status.';
        return;
      }
      var ok = O.TRANSITIONS[from].indexOf(id) >= 0;
      GE.clear(out); out.appendChild(GE.stamp(ok ? 'PASS' : 'FAIL'));
      if (ok) { view.markEdge(from + '>' + id, 'used', true); view.mark(id, 'done', true); out.appendChild(document.createTextNode(' The change from ' + from + ' to ' + id + ' is a permitted transition.')); }
      else { view.mark(id, 'failed', true); out.appendChild(document.createTextNode(from === id ? ' The order has this status already.' : ' Rule R7: the change from ' + from + ' to ' + id + ' is not a permitted transition. ' + (O.TRANSITIONS[from].length ? 'From ' + from + ', the permitted values are ' + O.TRANSITIONS[from].join(' and ') + '.' : from + ' is an end status. No transition starts there.'))); }
      from = null;
      GE.trace.lab('transitions', chapter);
    } });
    var input = h('input', { class: 'input mono', type: 'text', id: 'tr-new', value: 'Pending shipment', autocomplete: 'off', spellcheck: 'false' });
    var out2 = h('p', { class: 'feedback', 'aria-live': 'polite' });
    function tryIt() { var v = O.validateStatus(input.value); GE.clear(out2); out2.appendChild(GE.stamp(v.ok ? 'PASS' : 'FAIL')); out2.appendChild(document.createTextNode(v.ok ? ' ' + v.status + ' is one of the five values of rule R1.' : ' Rule R1: “' + input.value + '” is not one of the five values.')); }
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tryIt(); });
    el.appendChild(out);
    el.appendChild(h('div', { class: 'try-row' }, h('div', { class: 'field' }, h('label', { for: 'tr-new' }, 'Or try a status value that is not in the drawing'), input), h('button', { type: 'button', class: 'btn ghost', onclick: tryIt }, 'Validate')));
    el.appendChild(out2);
  };
})(window.GE);

/* ledger.js: the instruments of part 2.
   - ledger: move decisions from the model to the structure, then measure the variation (GE 02 section 3, GE 01 section 5).
   - colour: give a type to each node of the example graph (GE 02, Try it).
   - decide: script, loop, harness or graph (GE 08 section 4). */
(function (GE) {
  'use strict';
  var h = GE.h;

  /* The five rows of the table in GE 02, section 3. `nodes` are the parts of the drawing that become structure. */
  var DECISIONS = [
    { id: 'next', text: 'Which step is next', becomes: 'Code, on the edges. Each arrow is now a continuous line.', nodes: ['RT'] },
    { id: 'approval', text: 'If a person must give approval', becomes: 'The graph. The path goes through the person step.', nodes: ['AP'] },
    { id: 'tests', text: 'If the tests are necessary', becomes: 'The graph. The path goes through the verifier.', nodes: ['VF'] },
    { id: 'attempts', text: 'The number of attempts', becomes: 'An edge with a maximum. At the maximum, the run goes to a person.', nodes: ['HM'] },
    { id: 'text', text: 'The text of the plan and of the code', stays: true }
  ];
  var NAMES = { CL: 'classify', RT: 'which type', LK: 'answer', PL: 'plan', AP: 'approval', WR: 'write', VF: 'verifier', HM: 'escalate', SM: 'summary' };
  var LARGE = 400; // runs for the stable number; ten runs are too few to compare two structures

  /* The task as a graph for the runner. A decision that the model keeps is an edge with a probability (p).
     The probabilities are an example by this edition. */
  function taskGraph(moved) {
    var edges = [{ from: 'S', to: 'CL' }, { from: 'SM', to: 'E' }, { from: 'HM', to: 'E' }];
    if (moved.next) edges.push({ from: 'CL', to: 'RT' }, { from: 'RT', to: 'PL' });
    else edges.push({ from: 'CL', to: 'PL', p: 0.7 }, { from: 'CL', to: 'WR', p: 0.3 });           // code before the plan
    if (moved.approval) edges.push({ from: 'PL', to: 'AP' });
    else edges.push({ from: 'PL', to: 'AP', p: 0.6 }, { from: 'PL', to: 'WR', p: 0.4 });           // no approval
    edges.push({ from: 'AP', to: 'WR' });
    if (moved.tests) edges.push({ from: 'WR', to: 'VF' });
    else edges.push({ from: 'WR', to: 'VF', p: 0.6 }, { from: 'WR', to: 'SM', p: 0.4 });           // no tests
    edges.push({ from: 'VF', to: 'SM', when: function (s) { return s.verdict === 'pass'; } });
    if (moved.attempts) {
      edges.push({ from: 'VF', to: 'HM', when: function (s) { return s.attempts >= 2; } }, { from: 'VF', to: 'WR' });
    } else {
      edges.push({ from: 'VF', to: 'WR', p: 0.75, when: function (s) { return s.verdict === 'fail'; } },
                 { from: 'VF', to: 'SM', p: 0.25, id: 'VF>SM!', when: function (s) { return s.verdict === 'fail'; } }); // approval of its own work
    }
    return {
      start: 'S', edges: edges,
      owners: { attempts: 'WR', verdict: 'VF' },
      nodes: [{ id: 'S' }, { id: 'CL' }, { id: 'RT' }, { id: 'PL' }, { id: 'AP' }, { id: 'SM' }, { id: 'HM' }, { id: 'E' },
        { id: 'WR', act: function (s) { return { writes: { attempts: (s.attempts || 0) + 1 } }; } },
        { id: 'VF', act: function (s, ctx) { return { writes: { verdict: ctx.rng.chance(0.55) ? 'pass' : 'fail' } }; } }]
    };
  }
  /** What a run did that the permitted paths do not contain. */
  function problemsOf(run) {
    var p = run.path, out = [];
    if (p.indexOf('PL') < 0 || p.indexOf('PL') > p.indexOf('WR')) out.push('no plan before the code');
    if (p.indexOf('AP') < 0) out.push('no approval');
    for (var i = 0; i < p.length - 1; i++) if (p[i] === 'WR' && p[i + 1] === 'SM') { out.push('no tests'); break; }
    if (run.steps.some(function (s) { return s.edge === 'VF>SM!'; })) out.push('the summary after a FAIL result');
    if (run.state.attempts > 2) out.push(run.state.attempts + ' attempts');
    if (run.steps[run.steps.length - 1].stopped) out.push('no end');
    return out;
  }
  /** The part of many runs that goes outside the permitted paths, in percent. */
  function outsideRate(moved, seed) {
    var rng = GE.rng(seed), graph = taskGraph(moved), outside = 0;
    for (var i = 0; i < LARGE; i++) if (problemsOf(GE.runGraph(graph, { rng: rng, maxSteps: 24 })).length) outside++;
    return Math.round(outside / LARGE * 100);
  }
  GE.ledgerRate = outsideRate;

  GE.labs.ledger = function (el, chapter) {
    var def = GE.data.graphs.example;
    var moved = {};
    var measurements = [];
    var host = h('div');
    var view = GE.graphView(host, def, { minScale: 0.5 }); // smaller than the default, so the drawing fits beside the switches
    var note = h('p', { class: 'feedback small', 'aria-live': 'polite' });
    var counter = h('span', { class: 'ledger-count mono small' });
    var runBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Do 10 runs');
    var strip = h('div', { class: 'run-strip', 'aria-hidden': 'true' });
    var result = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var runsBox = h('ol', { class: 'runs' });
    var runsDrawer = h('details', { class: 'drawer', hidden: true }, h('summary', null, 'See the path of each run'), runsBox);
    var table = h('tbody');
    var tableWrap = h('div', { class: 'table-wrap', hidden: true }, h('table', { class: 'compact' },
      h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'In the structure'), h('th', { class: 'num' }, 'Outside, 10 runs'), h('th', { class: 'num' }, 'Outside, ' + LARGE + ' runs'))), table));
    var guess = null;
    var guessSeg = GE.segmented('Your prediction', ['0', '1–2', '3–5', '6–8', '9–10'], null, function (v) { guess = v; runBtn.disabled = false; });
    var RANGES = { '0': [0, 0], '1–2': [1, 2], '3–5': [3, 5], '6–8': [6, 8], '9–10': [9, 10] };

    function count() { return DECISIONS.filter(function (d) { return moved[d.id]; }).length; }
    function paintGraph() {
      var suggested = {};
      DECISIONS.forEach(function (d) {
        (d.nodes || []).forEach(function (id) { view.mark(id, 'suggested', !moved[d.id]); if (!moved[d.id]) suggested[id] = true; });
      });
      def.edges.forEach(function (e) {
        view.setEdgeKind(GE.edgeKey(e), moved.next && !suggested[e.from] && !suggested[e.to] ? 'fixed' : 'model');
      });
    }

    /* One row for each decision: the decision and a switch, Model or Structure. */
    var rows = h('ul', { class: 'ledger-list' });
    var switches = {}, effects = {};
    DECISIONS.forEach(function (d) {
      effects[d.id] = h('span', { class: 'small ledger-effect' });
      switches[d.id] = GE.segmented('Who decides: ' + d.text, [{ value: 'model', label: 'Model' }, { value: 'code', label: 'Structure' }], 'model', function (v) {
        if (d.stays && v === 'code') {
          switches[d.id].set('model', true);
          GE.clear(note); note.appendChild(GE.stamp('FAIL'));
          note.appendChild(document.createTextNode(' Judgment is necessary for “' + d.text.toLowerCase() + '”. It stays with the model.'));
          return;
        }
        moved[d.id] = v === 'code';
        update(moved[d.id] ? 'Moved: “' + d.text + '”.' : 'The model has this decision again: “' + d.text + '”.');
      });
      rows.appendChild(h('li', null, h('strong', null, d.text), switches[d.id].el, effects[d.id]));
    });

    function update(message) {
      paintGraph();
      DECISIONS.forEach(function (d) { effects[d.id].textContent = moved[d.id] ? d.becomes : ''; });
      counter.textContent = count() + ' of 4 in the structure';
      note.textContent = message || '';
      guess = null; guessSeg.set(null, true); runBtn.disabled = true;
      runBtn.textContent = 'Do 10 runs';
    }
    runBtn.addEventListener('click', function () {
      var rng = GE.rng(GE.newSeed());
      var graph = taskGraph(moved);
      var outside = 0;
      GE.clear(runsBox); GE.clear(strip);
      for (var i = 0; i < 10; i++) {
        var run = GE.runGraph(graph, { rng: rng, maxSteps: 24 });
        var probs = problemsOf(run);
        var text = run.path.filter(function (id) { return NAMES[id]; }).map(function (id) { return NAMES[id]; }).join(' → ');
        if (probs.length) outside++;
        strip.appendChild(h('span', { class: probs.length ? 'is-fail' : 'is-pass', title: text }));
        runsBox.appendChild(h('li', { class: probs.length ? 'is-fail' : '' }, h('span', { class: 'mono' }, text),
          probs.length ? h('span', { class: 'small' }, ' Not permitted: ' + probs.join(', ') + '.') : null));
      }
      var n = count();
      var rate = outsideRate(moved, 20261112); // the same seed each time: a comparison of two structures, not of two samples
      var prev = measurements[measurements.length - 1];
      measurements.push({ n: n, outside: outside, rate: rate });
      GE.clear(table);
      measurements.forEach(function (m, i) {
        table.appendChild(h('tr', null, h('td', null, String(i + 1)), h('td', null, m.n + ' of 4'), h('td', { class: 'num' }, m.outside + ' of 10'), h('td', { class: 'num' }, m.rate + '%')));
      });
      tableWrap.hidden = false; runsDrawer.hidden = false;
      var range = RANGES[guess], hit = outside >= range[0] && outside <= range[1];
      GE.clear(result);
      result.appendChild(GE.stamp(hit ? 'PASS' : 'FAIL'));
      result.appendChild(h('strong', null, ' ' + outside + ' of 10 runs went outside the permitted paths. You said ' + guess + '. '));
      var text2;
      if (n === 4) text2 = 'Code selects each path now, so no run can go outside. The runs are still different: the writer can try again after a FAIL. The model stays probabilistic. The system is predictable.';
      else if (!prev) text2 = 'Now move one more decision to the structure, and do it again.';
      else if (rate < prev.rate) text2 = 'In ' + LARGE + ' runs: from ' + prev.rate + '% to ' + rate + '%. Ten runs are a small sample, so use the last column to compare.';
      else if (rate > prev.rate) text2 = 'In ' + LARGE + ' runs: from ' + prev.rate + '% to ' + rate + '%. The model has more decisions now.';
      else text2 = 'In ' + LARGE + ' runs: ' + rate + '%, the same as before. The structure did not change.';
      result.appendChild(document.createTextNode(text2));
      if (n === 4) result.appendChild(h('span', { class: 'small' }, ' A graph does not correct an error in a node. That is the work of controls 2 and 3, in part 4.'));
      guess = null; guessSeg.set(null, true); runBtn.disabled = true;
      GE.trace.lab('ledger', chapter);
    });

    var steps = h('div', { class: 'ledger-steps' },
      h('div', { class: 'ledger-step' },
        h('p', { class: 'panel-title' }, h('span', { class: 'step-n' }, '1'), ' Who decides? ', counter),
        rows, note),
      h('div', { class: 'ledger-step' },
        h('p', { class: 'panel-title' }, h('span', { class: 'step-n' }, '2'), ' How many of 10 runs go outside the permitted paths?'),
        guessSeg.el),
      h('div', { class: 'ledger-step' },
        h('p', { class: 'panel-title' }, h('span', { class: 'step-n' }, '3'), ' Run it'),
        h('div', { class: 'controls' }, runBtn, strip), result));
    el.appendChild(h('div', { class: 'ledger-layout' }, steps,
      h('div', { class: 'ledger-graph' }, host, GE.legend(), h('p', { class: 'small muted' }, 'A dashed outline is a sentence in the prompt. The model can obey it or not.'))));
    el.appendChild(tableWrap);
    el.appendChild(runsDrawer);
    el.appendChild(h('p', { class: 'small muted' }, 'A simulation: the model ignores a prompt sentence in 25% to 40% of cases. These numbers are high on purpose, so you can see the effect in ten runs. The lesson is the direction of the change, not the size.'));
    update();
  };

  /* ---- Give a type to each node ---- */
  GE.labs.colour = function (el, chapter) {
    var src = GE.data.graphs.example;
    var answer = {}, given = {};
    var def = Object.assign({}, src, { nodes: src.nodes.map(function (n) {
      if (n.type) answer[n.id] = n.type;
      return Object.assign({}, n, { type: null });
    }) });
    var types = ['code', 'model', 'agent', 'person'];
    var names = { code: 'Code', model: 'One model call', agent: 'Agent', person: 'Person' };
    var current = 'code', attempts = 0, hintsLeft = 3, lastNode = null;
    var shapes = { code: 'ruled line', model: 'line that is not straight', agent: 'double outline that is not straight', person: 'rounded box' };
    /* Two worked examples, one fixed and one probabilistic. The reason uses the rule of the node table. */
    var WORKED = {
      RT: 'Which type? selects one of two fixed answers with a function. No model is necessary, so it is code.',
      CL: 'Classify the request reads free text and gives one label, in one call with no tools. So it is one model call.'
    };
    /* A hint names the rule to use. It does not give the type. */
    var HINT = {
      LK: 'Ask: does this step need a model, or does it look up a fixed answer?',
      PL: 'Ask: can one call with no tools make the plan, or must it read files with tools, in a loop?',
      AP: 'Ask: who makes this decision?',
      WR: 'Ask: does this step use tools again and again until the change is complete?',
      VF: 'Ask: is "are the tests satisfactory?" a judgement, or a result that a program reads?',
      HM: 'Ask: what happens when the run escalates?',
      SM: 'Ask: does a summary need tools in a loop, or one call?'
    };
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var palette = h('div', { class: 'chips', role: 'group', 'aria-label': 'Type to give' });
    var buttons = types.map(function (t, i) {
      var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(t === current), onclick: function () { pick(t); } },
        h('span', { class: 'role role-' + t }, (i + 1) + '  ' + names[t]));
      palette.appendChild(b); return b;
    });
    function pick(t) { current = t; buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(types[i] === t)); }); }
    function give(id, t) {
      if (!answer[id] || WORKED[id]) return;
      lastNode = id;
      given[id] = t; view.setType(id, t); view.mark(id, 'failed', false);
      view.describe(id, 'type: ' + names[t]);
      var left = Object.keys(answer).length - Object.keys(given).length;
      check.disabled = left > 0;
      out.textContent = left > 0 ? left + ' nodes have no type.' : 'Each node has a type. Send your answer to the check.';
    }
    var view = GE.graphView(el, def, {
      interactive: true,
      canUse: function (n) { return n.shape !== 'pill'; }, // Start and End have no type
      onNode: function (id) { give(id, current); },
      onKey: function (id, ev) { var i = '1234'.indexOf(ev.key); if (i >= 0) { pick(types[i]); give(id, types[i]); } }
    });
    var hintBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () {
      var id = lastNode || Object.keys(HINT).filter(function (k) { return !given[k]; })[0];
      if (!id || !hintsLeft) return;
      hintsLeft--;
      var name = def.nodes.filter(function (n) { return n.id === id; })[0].label.split(String.fromCharCode(10)).join(' ');
      out.textContent = name + ': ' + HINT[id] + ' (' + hintsLeft + (hintsLeft === 1 ? ' hint' : ' hints') + ' left.)';
      if (!hintsLeft) { hintBtn.disabled = true; hintBtn.textContent = 'No hints left: now use the rule'; }
    } }, 'Give me a hint about the last node (3)');
    var check = h('button', { type: 'button', class: 'btn', disabled: true, onclick: function () {
      attempts++;
      var wrong = Object.keys(answer).filter(function (id) { return given[id] !== answer[id]; });
      wrong.forEach(function (id) { view.mark(id, 'failed', true); view.describe(id, 'type: ' + names[given[id]] + ', not correct'); });
      var wrongNames = wrong.map(function (id) { return def.nodes.filter(function (n) { return n.id === id; })[0].label.split(String.fromCharCode(10)).join(' '); });
      GE.clear(out);
      if (!wrong.length) {
        var code = Object.keys(answer).filter(function (id) { return answer[id] === 'code'; }).length;
        out.appendChild(GE.stamp('PASS'));
        out.appendChild(document.createTextNode(' Each node has the correct type. Code does ' + code + ' of the ' + Object.keys(answer).length + ' steps. A model is necessary in only ' + Object.keys(answer).filter(function (id) { return answer[id] === 'model' || answer[id] === 'agent'; }).length + ' steps.'));
        GE.trace.lab('colour', chapter);
        out.parentNode.appendChild(GE.whyCheck('Why is “Verifier: are the tests satisfactory?” code, and not a model step?', [
          { text: 'A program runs the tests and reads PASS or FAIL. No judgement is necessary.', correct: true, why: 'Correct. The tests give a fixed result. A function reads it, so the same input always gives the same path.' },
          { text: 'Because it is a gate, and all gates are code.', correct: false, why: 'Not the reason. “A person gives approval?” is also a gate, and it is a person step. The shape does not decide the type.' },
          { text: 'Because it is near the end of the graph.', correct: false, why: 'Not the reason. The place of a node does not decide its type. Ask what the node must do.' }
        ], 3));
      } else {
        out.appendChild(GE.stamp('FAIL'));
        out.appendChild(document.createTextNode(' ' + (wrong.length === 1 ? '1 node has' : wrong.length + ' nodes have') + ' an incorrect type. Each one has a thick outline' + (attempts >= 2 ? ': ' + wrongNames.join(', ') + '.' : '.') + ' Use the node table above: a node that selects between fixed answers with a function is code. One call with no tools is one model call. A model that uses tools in a loop is an agent.'));
        show.hidden = attempts < 2;
      }
    } }, 'Send my answer to the check');
    var show = h('button', { type: 'button', class: 'btn ghost', hidden: true, onclick: function () {
      Object.keys(answer).forEach(function (id) { if (!WORKED[id]) give(id, answer[id]); });
      out.textContent = 'This is the answer of the notes. Code: ' + shapes.code + ' (blue). One model call: ' + shapes.model + ' (yellow). Agent: ' + shapes.agent + ' (purple). Person: ' + shapes.person + ' (green). Select a node to hear its type.';
    } }, 'Show the answer');
    Object.keys(WORKED).forEach(function (id) { view.setType(id, answer[id]); view.mark(id, 'worked', true); view.describe(id, 'worked example, type: ' + names[answer[id]]); given[id] = answer[id]; });
    var worked = h('div', { class: 'worked' }, h('p', null, h('strong', null, 'Two worked examples. '), 'Two nodes already have their type. Read why. Then give a type to the other seven nodes with the same question: what must this node do?'),
      h('ul', null, Object.keys(WORKED).map(function (id) { return h('li', null, WORKED[id]); })));
    el.insertBefore(palette, el.firstChild);
    el.insertBefore(worked, el.firstChild);
    el.appendChild(h('div', { class: 'controls' }, check, hintBtn, show));
    el.appendChild(out);
    out.textContent = (Object.keys(answer).length - Object.keys(WORKED).length) + ' nodes have no type.';
  };

  /* ---- Script, loop, harness or graph ---- */
  var CASES = [
    { text: 'Give a new name to 400 files. A fixed pattern gives each new name.', answer: 'S', nodes: ['Q0', 'S'], edges: ['Q0>S'],
      why: 'All the steps are code. Then a script is sufficient.' },
    { text: 'Correct one typing error in one function. Then do the tests.', answer: 'L', nodes: ['Q0', 'Q1', 'L'], edges: ['Q0>Q1', 'Q1>L'],
      why: 'One instruction gives the full task. Use one loop with a verifier: here the verifier is the tests.' },
    { text: 'Do general research on a new market. You do not know which sources are necessary.', answer: 'H', nodes: ['Q0', 'Q1', 'Q2', 'H'], edges: ['Q0>Q1', 'Q1>Q2', 'Q2>H'],
      why: 'The task is open. You cannot give its steps before the run. Use an agent harness for such a task.' },
    { text: 'Classify a change request, write a plan, get approval from a person, write the code, do the tests. The change is to the text of a help page only.', answer: 'D', nodes: ['Q0', 'Q1', 'Q2', 'G', 'Q4', 'D'], edges: ['Q0>Q1', 'Q1>Q2', 'Q2>G', 'G>Q4', 'Q4>D'],
      why: 'The task goes from one role to a different role, and you know the steps. Thus a graph. The nodes do not read or change business data, thus the graph is sufficient.' },
    { text: 'Give or refuse a refund for an order. A person must give approval for a large amount. The system changes the status of the order and sends a payment.', answer: 'O', nodes: ['Q0', 'Q1', 'Q2', 'G', 'Q4', 'O'], edges: ['Q0>Q1', 'Q1>Q2', 'Q2>G', 'G>Q4', 'Q4>O'],
      why: 'You know the steps, and the task goes from one role to a different role. Thus a graph. The nodes read and change business data, thus add an ontology and the two gates (part 4).' }
  ];
  var OPTIONS = [['S', 'A script'], ['L', 'One loop with a verifier'], ['H', 'An agent harness'], ['D', 'A graph'], ['O', 'A graph, an ontology and two gates']];

  GE.labs.decide = function (el, chapter) {
    var i = 0, right = 0;
    var cases = GE.rng(GE.newSeed()).shuffle(CASES); // a new sequence each time: the position of a case gives no help
    var view;
    var caseText = h('p', { class: 'case-text' });
    var count = h('span', { class: 'mono small' });
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var opts = h('div', { class: 'chips', role: 'group', 'aria-label': 'Designs' });
    var next = h('button', { type: 'button', class: 'btn', hidden: true }, 'Next case');
    var buttons = OPTIONS.map(function (o) {
      var b = h('button', { type: 'button', class: 'chip', onclick: function () { answer(o[0], b); } }, o[1]);
      opts.appendChild(b); return b;
    });
    function show() {
      var c = cases[i];
      view.focus();
      caseText.textContent = c.text;
      count.textContent = 'Case ' + (i + 1) + ' of ' + cases.length;
      out.textContent = '';
      next.hidden = true;
      buttons.forEach(function (b) { b.disabled = false; b.classList.remove('is-wrong'); b.classList.remove('is-answer'); });
    }
    function answer(code, btn) {
      var c = cases[i];
      var ok = code === c.answer;
      if (ok) right++;
      buttons.forEach(function (b, j) { b.disabled = true; b.classList.toggle('is-answer', OPTIONS[j][0] === c.answer); });
      if (!ok) btn.classList.add('is-wrong');
      view.focus(c.nodes, c.edges);
      GE.clear(out);
      out.appendChild(GE.stamp(ok ? 'PASS' : 'FAIL'));
      out.appendChild(document.createTextNode(' ' + (ok ? '' : 'The answer of the notes: ' + OPTIONS.filter(function (o) { return o[0] === c.answer; })[0][1].toLowerCase() + '. ') + c.why + ' The drawing shows the path of this case.'));
      next.hidden = false;
      next.textContent = i < cases.length - 1 ? 'Next case' : 'Start again';
      next.focus({ preventScroll: true });
      if (i === cases.length - 1) { out.appendChild(h('strong', null, ' You had ' + right + ' of ' + cases.length + ' on the first attempt.')); GE.trace.lab('decide', chapter); }
    }
    next.addEventListener('click', function () { if (i < cases.length - 1) i++; else { i = 0; right = 0; cases = GE.rng(GE.newSeed()).shuffle(CASES); } show(); buttons[0].focus(); });

    var left = h('div', { class: 'panel' }, count, caseText, opts, h('div', { class: 'controls' }, next), out);
    var host = h('div');
    el.appendChild(h('div', { class: 'split even graph-split' }, left, host));
    view = GE.graphView(host, GE.data.graphs.decision);
    show();
  };
})(window.GE);

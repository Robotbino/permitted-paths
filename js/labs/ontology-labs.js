/* ontology-labs.js: the instruments of part 4. Each one uses the checks in core/ontology.js.
   - validator: the five results of part 1 and validate_status (GE 04, section 10).
   - workbench: add facts to a knowledge graph that obeys the ontology (GE 04 section 1, GE 06 section 3).
   - gates: the two gates around one tool call (GE 04 section 5, GE 08 exercise 4).
   - reasoner: RDFS infers, OWL does not reject, SHACL validates (GE 04, section 4). */
(function (GE) {
  'use strict';
  var h = GE.h, O = GE.onto;

  function problemList(problems) {
    var ul = h('ul', { class: 'problems' });
    problems.forEach(function (p) { ul.appendChild(h('li', null, h('span', { class: 'mono rule-id' }, /^R\d$/.test(p.rule) ? 'Rule ' + p.rule : p.rule), ' ', p.text)); });
    return ul;
  }

  GE.labs.validator = function (el, chapter) {
    var own, results, shownKey = null;
    var title = h('p', { class: 'panel-title' }), noOwn = h('p', { class: 'small muted' }, 'You did not do the experiment in part 1. These are the five results that the notes give as an example.');
    var slips = h('ol', { class: 'slips' });
    // Read the results each time: the learner can do the experiment of part 1 after this part is open.
    function readResults() {
      var mine = GE.store.get('order1042', []);
      own = Array.isArray(mine) && mine.length >= 5;
      results = own ? mine.slice(0, 5) : ['Awaiting delivery', 'Paid', 'Processing', 'Pending shipment', 'Paid'];
      var key = results.join('|');
      if (key === shownKey) return;
      shownKey = key;
      title.textContent = own ? 'Your five results from part 1' : 'Five example results from the notes';
      noOwn.hidden = own;
      GE.clear(slips);
      results.forEach(function (r, i) { slips.appendChild(h('li', { class: 'slip is-set' }, h('span', { class: 'slip-n mono' }, 'Chat ' + (i + 1)), h('span', { class: 'slip-v' }, r))); });
      GE.clear(out); GE.clear(summary);
    }
    var estimate = null;
    var out = h('ol', { class: 'log validator-out', 'data-empty': 'The validator did not operate yet.' });
    var summary = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var run = h('button', { type: 'button', class: 'btn', disabled: true }, 'Put the five results into the validator');
    var seg = GE.segmented('Your estimate of the rejected results', ['0', '1', '2', '3', '4', '5'], null, function (v) { estimate = +v; run.disabled = false; });

    run.addEventListener('click', function () {
      readResults();
      GE.clear(out);
      var rejected = 0;
      results.forEach(function (r) {
        var v = O.validateStatus(r);
        if (!v.ok) rejected++;
        out.appendChild(h('li', { class: v.ok ? '' : 'is-fail' }, GE.stamp(v.ok ? 'PASS' : 'FAIL'), h('span', null, v.ok ? v.status : JSON.stringify(r) + ' is not in the ontology.')));
      });
      GE.clear(summary);
      var d = estimate - rejected;
      summary.appendChild(h('strong', null, 'The validator rejects ' + rejected + ' of 5. Your estimate was ' + estimate + (d === 0 ? ': correct. ' : d > 0 ? ': ' + d + ' too many. ' : ': ' + (-d) + ' too few. ')));
      summary.appendChild(document.createTextNode('The correct status of order 1042 is PAID. Each rejected result is a value that a system cannot use. With no validator, each of these values goes to the next step.'));
      summary.appendChild(h('p', { class: 'panel-title reasoner-q' }, 'One more question. The validator gives PASS for the value “Refunded”. The correct status of order 1042 is PAID. Is PASS the same as correct?'));
      var chips = h('div', { class: 'chips' }), verdict = h('p', { class: 'small' });
      [['Yes: a value with PASS is the correct value', false], ['No: PASS says only that the value is permitted', true]].forEach(function (o) {
        chips.appendChild(h('button', { type: 'button', class: 'chip', onclick: function () {
          [].forEach.call(chips.children, function (b) { b.disabled = true; });
          GE.clear(verdict); verdict.appendChild(GE.stamp(o[1] ? 'PASS' : 'FAIL'));
          verdict.appendChild(document.createTextNode(' An ontology gives consistent meaning. It does not make a fact correct. The validator stops the values that a system cannot use. To know that PAID is the correct value, connect the fact to a source: here, the accepted payment. (GE 04, section 9)'));
        } }, o[0]));
      });
      summary.appendChild(chips); summary.appendChild(verdict);
      GE.trace.lab('validator', chapter);
    });

    var tryIn = h('input', { class: 'input mono', type: 'text', id: 'val-try', value: 'paid', autocomplete: 'off', spellcheck: 'false' });
    var tryOut = h('p', { class: 'feedback mono', 'aria-live': 'polite' });
    function tryIt() { var v = O.validateStatus(tryIn.value); GE.clear(tryOut); tryOut.appendChild(GE.stamp(v.ok ? 'PASS' : 'FAIL')); tryOut.appendChild(document.createTextNode(' ' + v.line.slice(6))); }
    tryIn.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tryIt(); });

    el.appendChild(h('div', { class: 'split even' },
      h('div', null,
        title, noOwn, slips,
        h('p', { class: 'panel-title' }, 'How many of the five does the validator reject?'), seg.el,
        h('div', { class: 'controls' }, run)),
      h('div', null,
        h('pre', null, h('code', null, 'ALLOWED_STATUS = {"CART", "PAID", "FULFILLED",\n                  "REFUNDED", "CANCELLED"}\n\ndef validate_status(value: str) -> str:\n    status = value.strip().upper().replace(" ", "_")\n    if status in ALLOWED_STATUS:\n        return f"PASS  {status}"\n    return (f"FAIL  {value!r} is not in the ontology. "\n            f"Permitted: {sorted(ALLOWED_STATUS)}")')),
        out, summary)));
    el.appendChild(h('div', { class: 'try-row' },
      h('div', { class: 'field' }, h('label', { for: 'val-try' }, 'Try a value of your own'), tryIn),
      h('button', { type: 'button', class: 'btn ghost', onclick: tryIt }, 'Validate')));
    el.appendChild(tryOut);
    readResults();
    GE.store.onChange(function () { if (el.closest('.chapter').classList.contains('is-current')) readResults(); });
    window.addEventListener('hashchange', function () { setTimeout(readResults, 0); });
  };

  /* ---- The fact workbench ---- */
  var STATUS_CHOICES = ['CART', 'PAID', 'FULFILLED', 'REFUNDED', 'CANCELLED', 'PROBABLY_SHIPPED', 'Pending shipment', 'RETURNED'];
  var PRESETS = [
    ['Order 1042', 'has status', 'PROBABLY_SHIPPED'], ['Order 1042', 'has status', 'CART'], ['Order 1042', 'is refunded by', 'Refund A'],
    ['Order 1042', 'is refunded by', 'Refund B'], ['Refund A', 'pays', 'Sipho'], ['Sipho', 'is a', 'Customer'], ['Order 1043', 'is refunded by', 'Refund B'], ['Thandi', 'places', 'Star Harbour']
  ];
  var TRACKED = ['R1', 'R2', 'R3', 'R4', 'R7', 'R8'];

  GE.labs.workbench = function (el, chapter) {
    var facts, hit;
    var subj = h('select', { class: 'input', id: 'wb-s' }), rel = h('select', { class: 'input', id: 'wb-r' }), obj = h('select', { class: 'input', id: 'wb-o' });
    var list = h('ul', { class: 'facts' });
    var out = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var tracker = h('ul', { class: 'rule-tracker' });
    var wbGuess = null;
    var addBtn = h('button', { type: 'button', class: 'btn', disabled: true }, 'Add the fact');
    var wbSeg = GE.segmented('Your prediction', ['The validator accepts it', 'The validator rejects it'], null, function (v) { wbGuess = v; addBtn.disabled = false; });
    function resetGuess() { wbGuess = null; wbSeg.set(null, true); addBtn.disabled = true; }

    function options(select, values, keep) {
      var old = keep ? select.value : null;
      GE.clear(select);
      values.forEach(function (v) { select.appendChild(h('option', { value: v }, v)); });
      if (old && values.indexOf(old) >= 0) select.value = old;
    }
    function objectChoices() {
      if (rel.value === 'has status') return STATUS_CHOICES;
      if (rel.value === 'is a') return ['Customer', 'StaffMember'];
      return Object.keys(facts.types);
    }
    function paint() {
      GE.clear(list);
      facts.triples.forEach(function (t) {
        list.appendChild(h('li', null, h('span', { class: 'ent' }, t[0], h('small', null, facts.types[t[0]])), h('span', { class: 'rel mono' }, t[1]), h('span', { class: 'ent' }, t[2], h('small', null, facts.types[t[2]]))));
      });
      Object.keys(facts.status).forEach(function (o) {
        list.appendChild(h('li', null, h('span', { class: 'ent' }, o, h('small', null, 'Order')), h('span', { class: 'rel mono' }, 'has status'), h('span', { class: 'ent mono' }, facts.status[o])));
      });
      GE.clear(tracker);
      TRACKED.forEach(function (r) {
        tracker.appendChild(h('li', { class: hit[r] ? 'is-hit' : '' }, h('span', { class: 'mono' }, r), ' ', O.RULES[r].text, hit[r] ? h('span', { class: 'stamp none' }, 'rejected a fact') : null));
      });
    }
    function reset() {
      facts = O.newFacts(); hit = {};
      options(subj, Object.keys(facts.types)); options(rel, ['has status', 'is refunded by', 'pays', 'places', 'contains', 'is for', 'is a']); options(obj, objectChoices());
      GE.clear(out); paint(); resetGuess();
    }
    addBtn.addEventListener('click', function () { add(); });
    function add() {
      var res = O.assertFact(facts, subj.value, rel.value, obj.value);
      GE.clear(out);
      var text = subj.value + ' — ' + rel.value + ' → ' + obj.value;
      if (res.problems.length) {
        res.problems.forEach(function (p) { if (O.RULES[p.rule]) hit[p.rule] = true; });
        out.appendChild(h('p', null, GE.stamp('FAIL'), ' The validator rejects the fact “' + text + '”. The graph did not change.'));
        out.appendChild(problemList(res.problems));
      } else {
        out.appendChild(h('p', null, GE.stamp('PASS'), ' ', res.note || 'The fact “' + text + '” obeys the ontology. It is in the graph now.'));
      }
      out.appendChild(h('p', { class: 'small' }, 'Your prediction was ' + ((res.problems.length ? 'The validator rejects it' : 'The validator accepts it') === wbGuess ? 'correct.' : 'not correct.')));
      resetGuess();
      paint();
      if (TRACKED.every(function (r) { return hit[r]; })) out.appendChild(h('p', null, h('strong', null, 'Each of the six rules rejected a fact. '), 'Rules R5 and R6 are about amounts. The two-gate bench uses R5.'));
      GE.trace.lab('workbench', chapter);
    }
    rel.addEventListener('change', function () { options(obj, objectChoices(), true); });

    var presets = h('div', { class: 'chips' });
    PRESETS.forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'chip small', onclick: function () {
        subj.value = p[0]; rel.value = p[1]; options(obj, objectChoices()); obj.value = p[2]; resetGuess();
        GE.clear(out); out.appendChild(h('p', { class: 'small' }, 'The fact is in the form. Make your prediction. Then add the fact.'));
        wbSeg.el.querySelector('button').focus({ preventScroll: true });
      } }, p[0] + ' ' + p[1] + ' ' + p[2]));
    });

    el.appendChild(h('div', { class: 'split even' },
      h('div', null,
        h('p', { class: 'panel-title' }, 'Add a fact'),
        h('div', { class: 'triple-form' },
          h('div', { class: 'field' }, h('label', { for: 'wb-s' }, 'Subject'), subj),
          h('div', { class: 'field' }, h('label', { for: 'wb-r' }, 'Relation'), rel),
          h('div', { class: 'field' }, h('label', { for: 'wb-o' }, 'Object'), obj)),
        h('p', { class: 'panel-title' }, 'Your prediction'), wbSeg.el,
        h('div', { class: 'controls' }, addBtn,
          h('button', { type: 'button', class: 'btn ghost', onclick: reset }, 'Start again')),
        out,
        h('p', { class: 'panel-title' }, 'Or put one of these facts in the form'), presets),
      h('div', null,
        h('p', { class: 'panel-title' }, 'The knowledge graph: the facts now'), list,
        h('p', { class: 'panel-title' }, 'The rules of the ontology'), tracker)));
    reset();
  };

  /* ---- The two-gate bench ---- */
  var PROPOSALS = [
    { label: 'Proposal 1', call: [1042, 'ten', 7, 'REFUNDED'] },
    { label: 'Proposal 2', call: [1042, '40000', 7, 'PROBABLY_SHIPPED'] },
    { label: 'Proposal 3', call: [1043, '1000', 12, 'REFUNDED'] },
    { label: 'Proposal 4', call: [1042, '40000', 7, 'REFUNDED'] },
    { label: 'Proposal 5 (proposal 4 one more time)', call: [1042, '40000', 7, 'REFUNDED'] },
    { label: 'Proposal 6', call: [1042, '40000', 31, 'REFUNDED'] },
    { label: 'Proposal 7', call: [1042, '90000', 7, 'REFUNDED'] }
  ];
  var STOPS = [['G1', 'Gate 1 rejects it'], ['G2', 'Gate 2 rejects it'], ['DB', 'It commits']];

  GE.labs.gates = function (el, chapter) {
    var world = O.newWorld();
    var player = null, prediction = null;
    var host = h('div');
    var view = GE.graphView(host, GE.data.graphs.twoGates);
    var orderIn = h('select', { class: 'input mono', id: 'tg-order' }, h('option', { value: '1042' }, '1042'), h('option', { value: '1043' }, '1043'));
    var amountIn = h('input', { class: 'input mono', id: 'tg-amount', type: 'text', value: '40000', autocomplete: 'off', spellcheck: 'false' });
    var payeeIn = h('select', { class: 'input mono', id: 'tg-payee' });
    Object.keys(world.people).forEach(function (id) { payeeIn.appendChild(h('option', { value: id }, id + '  ' + world.people[id].name + ', ' + (world.people[id].cls === 'Customer' ? 'customer' : 'staff member'))); });
    var statusIn = h('input', { class: 'input mono', id: 'tg-status', type: 'text', value: 'REFUNDED', autocomplete: 'off', spellcheck: 'false' });
    var json = h('pre', { class: 'call-json' }, h('code'));
    var db = h('tbody');
    var out = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var send = h('button', { type: 'button', class: 'btn', disabled: true }, 'Send the proposal');
    var seg = GE.segmented('Your prediction', STOPS.map(function (s) { return { value: s[0], label: s[1] }; }), null, function (v) { prediction = v; send.disabled = false; });

    function readCall() {
      var amount = amountIn.value.trim();
      return { order_id: +orderIn.value, amount_cents: /^-?\d+$/.test(amount) ? +amount : amount, payee_id: +payeeIn.value, new_status: statusIn.value.trim() };
    }
    function paintCall() { json.firstChild.textContent = JSON.stringify(readCall(), null, 2); }
    function paintDb(changed) {
      GE.clear(db);
      Object.keys(world.orders).forEach(function (id) {
        var o = world.orders[id];
        db.appendChild(h('tr', { class: String(changed) === id ? 'is-changed' : '' }, h('td', { class: 'mono' }, id), h('td', { class: 'mono' }, o.status), h('td', { class: 'mono' }, o.customer_id + ' ' + world.people[o.customer_id].name),
          h('td', { class: 'mono num' }, String(o.payment_cents)), h('td', { class: 'mono num' }, String(o.refund_count))));
      });
    }
    [orderIn, amountIn, payeeIn, statusIn].forEach(function (x) { x.addEventListener('input', paintCall); x.addEventListener('change', paintCall); });

    function fire() {
      if (player) player.stop();
      var call = readCall();
      var p1 = O.gate1(call);
      var p2 = p1.length ? [] : O.gate2(world, call);
      var stop = p1.length ? 'G1' : p2.length ? 'G2' : 'DB';
      var steps = [{ node: 'M', edge: 'M>G1' }];
      if (stop === 'G1') steps.push({ node: 'G1', result: 'FAIL', edge: 'G1>M' }, { node: 'M', edge: null });
      else {
        steps.push({ node: 'G1', edge: 'G1>T' }, { node: 'T', edge: 'T>G2' });
        if (stop === 'G2') steps.push({ node: 'G2', result: 'FAIL', edge: 'G2>M' }, { node: 'M', edge: null });
        else steps.push({ node: 'G2', edge: 'G2>DB' }, { node: 'DB', edge: null });
      }
      view.reset(); GE.clear(out); send.disabled = true;
      var guessed = prediction;
      player = GE.player(view, steps, { speed: 420, onDone: function () {
        if (stop === 'DB') {
          O.commit(world, call); paintDb(call.order_id);
          out.appendChild(h('p', null, GE.stamp('PASS'), ' Gate 1 and Gate 2 accept the proposal. Code commits the change. This is the only step with a side effect. Look at the database row.'));
        } else {
          out.appendChild(h('p', null, GE.stamp('FAIL'), stop === 'G1'
            ? ' Gate 1 rejects the proposal. It read only the call. The tool did not operate.'
            : ' Gate 1 accepts the shape. Gate 2 rejects the result. It read the call, the result, the ontology and the current facts (the database row). The database did not change, so nothing is lost.'));
          out.appendChild(problemList(stop === 'G1' ? p1 : p2));
          out.appendChild(h('p', { class: 'small' }, 'The cause goes back to the model. The cost is one more model call.'));
        }
        if (guessed) out.appendChild(h('p', null, 'Your prediction: ', h('strong', null, STOPS.filter(function (s) { return s[0] === guessed; })[0][1].toLowerCase()), '. ', guessed === stop ? 'Correct.' : 'Not correct. Read the cause above.'));
        seg.set(null, true); prediction = null; send.disabled = true;
        GE.trace.lab('gates', chapter);
      } });
      player.play();
    }
    send.addEventListener('click', fire);

    var presets = h('div', { class: 'chips' });
    PROPOSALS.forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'chip', onclick: function () {
        orderIn.value = String(p.call[0]); amountIn.value = p.call[1]; payeeIn.value = String(p.call[2]); statusIn.value = p.call[3];
        if (player) player.stop();
        paintCall(); GE.clear(out); view.reset(); seg.set(null, true); prediction = null; send.disabled = true;
        out.appendChild(h('p', { class: 'small' }, 'The proposal is in the form. Read the four fields and the database row. Make your prediction. Then send the proposal.'));
      } }, p.label));
    });
    var reset = h('button', { type: 'button', class: 'btn ghost', onclick: function () { if (player) player.stop(); world = O.newWorld(); paintDb(); view.reset(); GE.clear(out); send.disabled = prediction === null; } }, 'Reset the database');

    el.appendChild(h('p', { class: 'panel-title' }, 'Proposals from the model'));
    el.appendChild(presets);
    el.appendChild(host);
    el.appendChild(h('div', { class: 'split even' },
      h('div', { class: 'panel' },
        h('p', { class: 'panel-title' }, 'The tool call (you can change each field)'),
        h('div', { class: 'call-form' },
          h('div', { class: 'field' }, h('label', { for: 'tg-order' }, 'order_id'), orderIn),
          h('div', { class: 'field' }, h('label', { for: 'tg-amount' }, 'amount_cents'), amountIn),
          h('div', { class: 'field field-wide' }, h('label', { for: 'tg-payee' }, 'payee_id'), payeeIn),
          h('div', { class: 'field' }, h('label', { for: 'tg-status' }, 'new_status'), statusIn)),
        json),
      h('div', { class: 'panel' },
        h('p', { class: 'panel-title' }, 'The database: the current facts'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'db' }, h('thead', null, h('tr', null, h('th', null, 'order'), h('th', null, 'status'), h('th', null, 'customer'), h('th', { class: 'num' }, 'payment'), h('th', { class: 'num' }, 'refunds'))), db)),
        h('p', { class: 'small muted' }, 'Gate 2 uses the five status values of the game store and rules R1, R2, R3, R5, R7 and R8.'),
        h('p', { class: 'panel-title' }, 'Where does this proposal stop?'), seg.el,
        h('div', { class: 'controls' }, send, reset))));
    el.appendChild(out);
    paintCall(); paintDb();
  };

  /* ---- Infer, or reject? ---- */
  GE.labs.reasoner = function (el, chapter) {
    var inferred = h('ol', { class: 'log', 'data-empty': 'The reasoner has no fact yet.', 'aria-live': 'polite' });
    var add = h('button', { type: 'button', class: 'btn', onclick: function () {
      add.disabled = true;
      var lines = [
        [':bob  :teaches  :scooter .', 'the fact that you added'],
        [':bob  a  :Teacher .', 'inferred: the domain of :teaches is :Teacher'],
        [':bob  a  :Person .', 'inferred: :Teacher is a subclass of :Person'],
        [':scooter  a  :Student .', 'inferred: the range of :teaches is :Student']
      ];
      lines.forEach(function (l, i) {
        setTimeout(function () { inferred.appendChild(h('li', null, h('span', null, l[0]), h('span', { class: 'muted' }, l[1]))); }, GE.reduced() ? 0 : i * 420);
      });
      GE.trace.lab('reasoner', chapter);
    } }, 'Add the fact: bob teaches scooter');

    var reveal = h('div', { class: 'split even', hidden: true },
      h('div', { class: 'panel' }, h('p', { class: 'panel-title' }, 'OWL reasoner'),
        h('pre', null, h('code', null, ':refundA  owl:sameAs  :refundB .   # inferred')),
        h('p', null, h('span', { class: 'stamp none' }, 'NO ERROR'), ' OWL uses the open-world assumption. In OWL, two names can be one thing. The reasoner infers that the two refunds are the same thing.')),
      h('div', { class: 'panel' }, h('p', { class: 'panel-title' }, 'SHACL validator'),
        h('pre', null, h('code', null, 'sh:path :hasRefund ;  sh:maxCount 1 .')),
        h('p', null, GE.stamp('FAIL'), ' Order 1042 has 2 values for :hasRefund. The maximum is 1. SHACL or code gives a strict check of data.')));
    var verdict = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var opts = h('div', { class: 'gate-opts', role: 'group', 'aria-label': 'Your prediction' });
    [['It gives an error and rejects the data', false], ['It infers that the two refunds are the same thing, and gives no error', true], ['It removes the second refund', false]].forEach(function (o) {
      opts.appendChild(h('button', { type: 'button', class: 'chip', onclick: function (ev) {
        [].forEach.call(opts.children, function (b) { b.disabled = true; });
        ev.currentTarget.classList.add(o[1] ? 'is-right' : 'is-wrong'); ev.currentTarget.setAttribute('aria-pressed', 'true');
        GE.clear(verdict); verdict.appendChild(GE.stamp(o[1] ? 'PASS' : 'FAIL'));
        verdict.appendChild(document.createTextNode(o[1] ? ' Correct. OWL does not reject data.' : ' Not correct. OWL does not reject data.'));
        reveal.hidden = false; again.hidden = false;
      } }, o[0]));
    });
    var again = h('button', { type: 'button', class: 'btn ghost', hidden: true, onclick: function () {
      GE.clear(inferred); add.disabled = false; GE.clear(verdict); reveal.hidden = true; again.hidden = true;
      [].forEach.call(opts.children, function (b) { b.disabled = false; b.classList.remove('is-right'); b.classList.remove('is-wrong'); b.removeAttribute('aria-pressed'); });
      add.focus();
    } }, 'Start again');

    el.appendChild(h('div', { class: 'split even' },
      h('div', null, h('p', { class: 'panel-title' }, '1. RDFS infers'),
        h('pre', null, h('code', null, ':teaches  rdfs:domain  :Teacher ;\n          rdfs:range   :Student .\n:Teacher  rdfs:subClassOf  :Person .')),
        h('p', { class: 'small' }, 'With RDFS, you declare the domain and the range of a relation. Then a reasoner infers new facts.'),
        h('div', { class: 'controls' }, add)),
      h('div', null, h('p', { class: 'panel-title' }, 'What the reasoner knows'), inferred)));
    el.appendChild(h('p', { class: 'panel-title reasoner-q' }, '2. Your prediction. The ontology says that an order has one refund at most. The data says that order 1042 has two refunds: refund A and refund B. What does an OWL reasoner do?'));
    el.appendChild(opts); el.appendChild(verdict); el.appendChild(reveal);
    el.appendChild(h('div', { class: 'controls' }, again));
  };
})(window.GE);

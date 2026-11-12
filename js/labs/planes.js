/* planes.js: put each part of the course in its plane (GE 05, section 2, "Where the parts of these notes are"). */
(function (GE) {
  'use strict';
  var h = GE.h;

  var PLANES = [
    { id: 'intelligence', name: 'Intelligence plane', does: 'Keeps the knowledge' },
    { id: 'control', name: 'Control plane', does: 'Manages the agents' },
    { id: 'data', name: 'Data plane', does: 'Does the work' }
  ];
  var PARTS = [
    ['Agent step', 'data'], ['Model call', 'data'], ['Tool call', 'data'],
    ['Execution graph', 'control'], ['Maximum values', 'control'], ['Approval', 'control'], ['Tool permissions', 'control'],
    ['Ontology', 'intelligence'], ['Knowledge graph', 'intelligence'], ['Memory', 'intelligence'], ['Traces', 'intelligence'], ['Access to data', 'intelligence']
  ];
  var WHY = {
    'Access to data': 'Access to data is in the intelligence plane, because it sets what the agent can know. Tool permissions are in the control plane.',
    'Execution graph': 'The execution graph sets limits for the agent. It is in the control plane.',
    'Approval': 'Approval is a limit for the agent. It is in the control plane.',
    'Maximum values': 'A maximum is a limit for the agent. It is in the control plane.',
    'Traces': 'The traces are what the system knows about its runs. They are in the intelligence plane. The audit trail is in the control plane.'
  };
  /* Worked examples: these three items are placed before the learner starts, with the reason.
     One example for each plane, so each plane has a model answer (worked-example effect). */
  var WORKED = {
    'Model call': 'A model call does work in the run. It does not set a limit and it does not keep knowledge. Thus it is in the data plane.',
    'Approval': 'An approval stops the run until a person decides. It is a limit on the agent. Thus it is in the control plane.',
    'Ontology': 'The ontology keeps the permitted types, values and rules. It is knowledge that the gates use. Thus it is in the intelligence plane.'
  };
  /* A hint gives the question to ask about an item. It does not give the plane. */
  var HINT = {
    'Agent step': 'Ask: when the agent step runs, does it do work, set a limit, or keep knowledge?',
    'Tool call': 'Ask: is a tool call an action in the run, or a rule about the run?',
    'Execution graph': 'Ask: who selects the path, and what does the path permit or forbid?',
    'Maximum values': 'Ask: what does a maximum do to the run when it is reached?',
    'Tool permissions': 'Ask: does a permission do work, or does it say what the agent can do?',
    'Knowledge graph': 'Ask: what does a knowledge graph hold after the run ends?',
    'Memory': 'Ask: does memory act in this run, or does it keep what the system learned?',
    'Traces': 'Ask: a trace is written by the run. Where is it kept, and what is it used for later?',
    'Access to data': 'Careful: this is about what the agent can know, not which tools it can use.'
  };
  var HINT_BUDGET = 3;

  GE.labs.planes = function (el, chapter) {
    var placed = {}, selected = null, attempts = 0, hintsLeft = HINT_BUDGET;
    Object.keys(WORKED).forEach(function (k) { placed[k] = PARTS.filter(function (p) { return p[0] === k; })[0][1]; });
    var tray = h('div', { class: 'chips plane-tray', role: 'group', 'aria-label': 'Items with no plane' });
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var check = h('button', { type: 'button', class: 'btn', disabled: true }, 'Send my answer to the check');
    var bands = {};
    var chips = {};
    var order = GE.rng(11).shuffle(PARTS);

    order.forEach(function (p) {
      if (WORKED[p[0]]) {
        chips[p[0]] = h('button', { type: 'button', class: 'chip is-worked', disabled: true, 'aria-label': p[0] + ', worked example, in the ' + p[1] + ' plane' }, p[0], h('span', { class: 'worked-tag' }, ' example'));
        return;
      }
      chips[p[0]] = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: function () { select(p[0]); } }, p[0]);
    });
    function select(name) {
      selected = selected === name ? null : name;
      Object.keys(chips).forEach(function (k) { chips[k].setAttribute('aria-pressed', String(k === selected)); });
      out.textContent = selected ? 'Selected: ' + selected + '. Now select a plane.' : '';
    }
    function layout() {
      GE.clear(tray);
      PLANES.forEach(function (pl) { GE.clear(bands[pl.id].slot); });
      order.forEach(function (p) {
        var where = placed[p[0]];
        (where ? bands[where].slot : tray).appendChild(chips[p[0]]);
      });
      var left = PARTS.length - Object.keys(placed).length;
      check.disabled = left > 0;
      tray.hidden = left === 0;
    }
    var hintBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () {
      if (!selected) { out.textContent = 'First select an item. Then ask for a hint about it.'; return; }
      if (!hintsLeft) return;
      hintsLeft--;
      out.textContent = selected + ': ' + HINT[selected] + ' (' + hintsLeft + (hintsLeft === 1 ? ' hint' : ' hints') + ' left.)';
      hintBtn.disabled = hintsLeft === 0;
      if (!hintsLeft) hintBtn.textContent = 'No hints left: now use the rule';
    } }, 'Give me a hint about the selected item (' + HINT_BUDGET + ')');
    function put(planeId) {
      if (!selected) { out.textContent = 'First select an item. Then select a plane.'; return; }
      placed[selected] = planeId;
      chips[selected].classList.remove('is-wrong'); chips[selected].removeAttribute('aria-label');
      var name = selected; select(selected);
      layout();
      var left = PARTS.length - Object.keys(placed).length;
      out.textContent = name + ' is in the ' + planeId + ' plane. ' + (left ? left + ' items have no plane.' : 'Each item has a plane. Send your answer to the check.');
      var nextChip = tray.querySelector('.chip'); if (nextChip) nextChip.focus();
    }
    function solveAll() {
      PARTS.forEach(function (p) { placed[p[0]] = p[1]; chips[p[0]].classList.remove('is-wrong'); }); layout();
    }
    check.addEventListener('click', function () {
      attempts++;
      var wrong = PARTS.filter(function (p) { return placed[p[0]] !== p[1]; });
      GE.clear(out);
      if (!wrong.length) {
        out.appendChild(GE.stamp('PASS'));
        out.appendChild(document.createTextNode(' Each item is in its plane. The control plane operates the gate. The intelligence plane supplies the rules that the gate uses.'));
        GE.trace.lab('planes', chapter);
        out.appendChild(GE.whyCheck('Why are “Tool permissions” in the control plane, but “Access to data” in the intelligence plane?', [
          { text: 'A permission limits what the agent can do. Access to data sets what the agent can know.', correct: true, why: 'Correct. The control plane limits actions. The intelligence plane is about knowledge, and access decides which knowledge the agent gets.' },
          { text: 'Permissions are code, and data is not code.', correct: false, why: 'Not the reason. Both can be code. The difference is what each one controls: actions, or knowledge.' },
          { text: 'Access to data is slower to change than a permission.', correct: false, why: 'Not the reason. The speed of a change does not decide the plane. Ask what the item controls.' }
        ], 5));
        return;
      }
      wrong.forEach(function (p) { chips[p[0]].classList.add('is-wrong'); chips[p[0]].setAttribute('aria-label', p[0] + ', not in the correct plane'); });
      out.appendChild(GE.stamp('FAIL'));
      var hint = wrong.map(function (p) { return WHY[p[0]]; }).filter(Boolean)[0] || 'The data plane does the work. The control plane sets limits. The intelligence plane keeps what the system knows.';
      out.appendChild(document.createTextNode(' ' + (wrong.length === 1 ? '1 item is' : wrong.length + ' items are') + ' not in the correct plane. Each one is marked. Select a marked item and move it. ' + hint));
      if (attempts >= 2) out.appendChild(h('button', { type: 'button', class: 'btn ghost small', onclick: function () {
        solveAll();
        out.textContent = 'This is the answer of the notes. The plane table below gives the reason for each plane.';
      } }, 'Show the answer'));
    });

    var stack = h('div', { class: 'planes' });
    PLANES.forEach(function (pl) {
      var slot = h('div', { class: 'chips plane-slot' });
      var btn = h('button', { type: 'button', class: 'plane-target', onclick: function () { put(pl.id); } }, h('strong', null, pl.name), h('span', null, pl.does), h('span', { class: 'small' }, 'Put the selected item in this plane'));
      bands[pl.id] = { slot: slot };
      stack.appendChild(h('div', { class: 'plane plane-' + pl.id }, btn, slot));
    });
    var worked = h('div', { class: 'worked' }, h('p', null, h('strong', null, 'Three worked examples. '), 'One item for each plane is already in its plane. Read the reason first. Then use the same question for the other nine items.'),
      h('ul', null, Object.keys(WORKED).map(function (k) { return h('li', null, h('strong', null, k + ': '), WORKED[k]); })));
    el.appendChild(worked);
    el.appendChild(tray);
    el.appendChild(stack);
    el.appendChild(h('p', { class: 'small muted' }, 'The intelligence plane influences which decision the agent makes. The control plane sets limits for the agent. The data plane sends traces to the intelligence plane and audit events to the control plane.'));
    el.appendChild(h('div', { class: 'controls' }, check, hintBtn));
    el.appendChild(out);
    layout();
  };
})(window.GE);

/* case-study.js: the instruments of part 7 (GE 07).
   - walker: go from rule R2 to its code unit and its test (section 4).
   - notecheck: the graph validator for one note (sections 3 and 4).
   - baseline: known findings and new findings (section 6). */
(function (GE) {
  'use strict';
  var h = GE.h, O = GE.onto;

  /* The three example notes of GE 07, section 4. The notes give no note for the requirement. */
  var NOTES = {
    'BR-R2': '---\nid: BR-R2\nnode_type: business_rule\ntitle: "BR-R2 — An order has one refund at most"\nknowledge_class: AUTH\nconfidence: "Strong evidence"\naudit_status: partial\nimpl_status: "IMPLEMENTED BUT NOT VERIFIED"\nevidence: "Requirement \'Refunds\', section 2; the method RefundService.createRefund"\nsources: ["Requirement \'Refunds\', section 2"]\nrelations:\n  - "specified_by|REQ-Refunds"\n  - "implemented_by|CODE-RefundService"\n  - "validated_by|TEST-second-refund"\nverified: false\nlast_verified: 2026-11-07\n---',
    'CODE-RefundService': '---\nid: CODE-RefundService\nnode_type: code\ntitle: "CODE-RefundService"\nknowledge_class: OBS\nconfidence: "Verified"\n---',
    'TEST-second-refund': '---\nid: TEST-second-refund\nnode_type: test\ntitle: "TEST — The service rejects a second refund"\nknowledge_class: OBS\nconfidence: "Verified"\n---',
    'REQ-Refunds': null
  };
  var READ = {
    'BR-R2': 'The rule note. The claim comes from an authoritative document (AUTH). The confidence is \u201cStrong evidence\u201d, the audit status is \u201cpartial\u201d, and the implementation status is \u201cimplemented but not verified\u201d. Three relations point to other notes.',
    'CODE-RefundService': 'The code unit note. The claim is an observation of the code (OBS), and it is verified. From here, the agent opens the source file.',
    'TEST-second-refund': 'The test note. This test is the evidence for rule R2. The rule gate of part 6 uses the same relation, validated_by.',
    'REQ-Refunds': 'The requirement. The notes give no example note for it.'
  };

  GE.labs.walker = function (el, chapter) {
    var seen = {};
    var title = h('p', { class: 'panel-title' }, 'Select a node');
    var code = h('pre', { class: 'note-yaml' }, h('code', null, 'Start at BR-R2.'));
    var read = h('p', { class: 'small' });
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var host = h('div');
    var view = GE.graphView(host, GE.data.graphs.notes, { interactive: true, onNode: function (id) {
      view.nodeIds().forEach(function (k) { view.mark(k, 'selected', k === id); });
      seen[id] = true; view.mark(id, 'done', true);
      if (id !== 'BR-R2') view.markEdge('BR-R2>' + id, 'used', true);
      title.textContent = id;
      code.firstChild.textContent = NOTES[id] || '# The notes give no example for this note.';
      read.textContent = READ[id];
      if (seen['BR-R2'] && seen['CODE-RefundService'] && seen['TEST-second-refund']) {
        GE.clear(out); out.appendChild(GE.stamp('PASS'));
        out.appendChild(document.createTextNode(' You went from the rule to its code unit and to its test. The agent reads these small notes first. Then it reads only the code that the note points to.'));
        GE.trace.lab('walker', chapter);
      } else out.textContent = seen['BR-R2'] ? 'Now go along implemented_by and validated_by.' : 'Start at the rule: BR-R2.';
    } });
    el.appendChild(h('div', { class: 'split even graph-split' }, h('div', null, host, out), h('div', { class: 'panel' }, title, code, read)));
  };

  /* ---- The graph validator ---- */
  var KNOWN = ['BR-R2', 'REQ-Refunds', 'CODE-RefundService', 'TEST-second-refund'];
  var START = { knowledge_class: 'AUTH', confidence: 'Strong evidence', relations: ['specified_by|REQ-Refunds', 'implemented_by|CODE-RefundService', 'validated_by|TEST-second-refund'] };
  var BREAKS = [
    ['A relation type that is not in the list', function (f) { f.rel[1].value = 'implements|CODE-RefundService'; }],
    ['A target of an incorrect type', function (f) { f.rel[2].value = 'validated_by|CODE-RefundService'; }],
    ['A confidence value that is not in the list', function (f) { f.conf.value = 'Probably correct'; }],
    ['A relation with no separator', function (f) { f.rel[0].value = 'specified_by REQ-Refunds'; }],
    ['A target that is not in the graph', function (f) { f.rel[1].value = 'implemented_by|CODE-PaymentService'; }]
  ];

  GE.labs.notecheck = function (el, chapter) {
    var kinds = {};
    var f = {
      kc: h('input', { class: 'input mono', id: 'nc-kc', type: 'text', autocomplete: 'off', spellcheck: 'false' }),
      conf: h('input', { class: 'input mono', id: 'nc-conf', type: 'text', autocomplete: 'off', spellcheck: 'false' }),
      rel: [0, 1, 2].map(function (i) { return h('input', { class: 'input mono', id: 'nc-r' + i, type: 'text', 'aria-label': 'Relation ' + (i + 1), autocomplete: 'off', spellcheck: 'false' }); })
    };
    var out = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var found = h('p', { class: 'small', 'aria-live': 'polite' });
    function fill() { f.kc.value = START.knowledge_class; f.conf.value = START.confidence; f.rel.forEach(function (r, i) { r.value = START.relations[i]; }); }
    function validate() {
      var note = { knowledge_class: f.kc.value.trim(), confidence: f.conf.value.trim(), relations: f.rel.map(function (r) { return r.value.trim(); }).filter(Boolean) };
      var problems = O.validateNote(note, KNOWN);
      GE.clear(out);
      if (!problems.length) out.appendChild(h('p', null, GE.stamp('PASS'), ' The types, the relations and the targets of the note are valid.'));
      else {
        out.appendChild(h('p', null, GE.stamp('FAIL'), ' The validator rejects the note. A script made this check. No model is necessary.'));
        var ul = h('ul', { class: 'problems' });
        problems.forEach(function (p) { kinds[p.rule + ':' + p.text.replace(/"[^"]*"/, '')] = true; ul.appendChild(h('li', null, h('span', { class: 'mono rule-id' }, p.rule), ' ', p.text)); });
        out.appendChild(ul);
      }
      var n = Object.keys(kinds).length;
      found.textContent = n ? 'Different types of FAIL that you found: ' + n + '.' + (n >= 3 ? ' Each one is a rule of the ontology of the notes. A script enforces each rule.' : '') : '';
      if (n >= 3) GE.trace.lab('notecheck', chapter);
    }
    var breaks = h('div', { class: 'chips' });
    BREAKS.forEach(function (b) { breaks.appendChild(h('button', { type: 'button', class: 'chip', onclick: function () { fill(); b[1](f); validate(); } }, b[0])); });
    el.appendChild(h('div', { class: 'split even' },
      h('div', { class: 'panel' },
        h('p', { class: 'panel-title' }, 'The note BR-R2 (a part of it)'),
        h('div', { class: 'field' }, h('label', { for: 'nc-kc' }, 'knowledge_class'), f.kc),
        h('div', { class: 'field' }, h('label', { for: 'nc-conf' }, 'confidence'), f.conf),
        h('div', { class: 'field' }, h('span', null, 'relations'), f.rel),
        h('div', { class: 'controls' }, h('button', { type: 'button', class: 'btn', onclick: validate }, 'Send to the validator'),
          h('button', { type: 'button', class: 'btn ghost', onclick: function () { fill(); GE.clear(out); } }, 'Put the valid note back'))),
      h('div', null, h('p', { class: 'panel-title' }, 'Or make one of these changes'), breaks, out, found)));
    fill();
  };

  /* ---- The baseline of known findings ---- */
  GE.labs.baseline = function (el, chapter) {
    var findings, known, extra;
    var list = h('ul', { class: 'findings' });
    var out = h('div', { class: 'feedback', 'aria-live': 'polite' });
    var change = h('button', { type: 'button', class: 'btn ghost', hidden: true }, 'A different developer changes the code');
    function reset() {
      findings = ['A page uses an old date function', 'A rule note has no test', 'Two notes give two values for one maximum', 'A code unit has no rule note', 'A status value in the code is not in the vocabulary'];
      known = findings.slice(0, 4); extra = false; change.hidden = true;
      GE.clear(list); GE.clear(out);
      out.appendChild(h('p', null, 'The list of known findings has ' + known.length + ' items. Start the check.'));
    }
    function check() {
      GE.clear(list); GE.clear(out);
      var fresh = findings.filter(function (x) { return known.indexOf(x) < 0; });
      findings.forEach(function (x) {
        var isNew = fresh.indexOf(x) >= 0;
        var li = h('li', { class: isNew ? 'is-new' : '' }, h('span', { class: 'stamp ' + (isNew ? 'fail' : 'known') }, isNew ? 'NEW' : 'KNOWN'), h('span', null, x));
        if (isNew) li.appendChild(h('span', { class: 'controls' },
          h('button', { type: 'button', class: 'btn ghost small', onclick: function () { known.push(x); after('A person examined the finding and accepted it as known. It is in the list now, and it does not cause a FAIL result. The problem is not corrected.'); } }, 'Accept it as known'),
          h('button', { type: 'button', class: 'btn ghost small', onclick: function () { findings.splice(findings.indexOf(x), 1); after('A person examined the finding. It is corrected.'); } }, 'Correct it')));
        list.appendChild(li);
      });
      out.appendChild(h('p', null, GE.stamp(fresh.length ? 'FAIL' : 'PASS'), fresh.length
        ? ' The check found ' + findings.length + ' problems. ' + (findings.length - fresh.length) + ' are known. ' + fresh.length + ' is new. Only the new finding causes the FAIL result. A person must examine it.'
        : ' The check found ' + findings.length + ' problems. Each one is known. The check gives PASS: nothing changed.'));
      change.hidden = !!fresh.length || extra;
      GE.trace.lab('baseline', chapter);
    }
    function after(text) { GE.clear(out); out.appendChild(h('p', null, text + ' Start the check again.')); [].forEach.call(list.querySelectorAll('button'), function (b) { b.disabled = true; }); }
    change.addEventListener('click', function () {
      extra = true; change.hidden = true;
      findings.push('A new page reads a field with no permission check');
      GE.clear(out); out.appendChild(h('p', null, 'The code changed. Start the check again.'));
    });
    el.appendChild(h('div', { class: 'controls' }, h('button', { type: 'button', class: 'btn', onclick: check }, 'Start the check'), change, h('button', { type: 'button', class: 'btn ghost', onclick: reset }, 'Start again')));
    el.appendChild(list); el.appendChild(out);
    reset();
  };
})(window.GE);

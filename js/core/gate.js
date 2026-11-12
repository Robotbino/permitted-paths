/* gate.js: the checkpoint at the end of a part.
   It behaves as a gate of the notes: each answer gets PASS or FAIL, each question has a
   maximum number of attempts, and at the maximum the gate escalates: it stops and gives
   the worked answer. The result of each question goes into the trace.

   The first FAIL gives a hint and a link back to the section. It does not give the answer.
   The sequence of the answers is different each time, so the position gives no help.

   A question is one of:
   { kind: 'choice', prompt, hint, at, source, fixed?, options: [{text, correct?, why}] }
   { kind: 'assign', prompt, hint, at, source, bins: [labels], items: [{text, bin, why}] }
   `at` is the id of the heading where the notes give the answer. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var MAX_ATTEMPTS = GE.MAX_ATTEMPTS = 2;

  GE.gate = function (host, chapter, def) {
    var saved = GE.store.gate(chapter);
    var inner = h('div', { class: 'gate-inner' });
    host.appendChild(inner);
    var index = 0, attempts = 0, results = [];

    function head(progress) {
      return h('div', { class: 'gate-head' },
        h('h2', null, def.title || 'Gate'),
        progress ? h('span', { class: 'gate-progress', text: progress }) : null);
    }
    function backLink(q) {
      return q.at ? h('a', { class: 'gate-back', href: '#' + q.at }, 'Read this section again') : null;
    }

    function showSummary(record, fresh) {
      GE.clear(inner);
      var escalated = record.results.filter(function (r) { return r !== 'PASS'; }).length;
      inner.appendChild(head());
      var summary = h('p', { class: 'gate-summary' }, GE.stamp(record.status === 'PASS' ? 'PASS' : 'FAIL'), ' ',
        record.status === 'PASS'
          ? 'You gave the correct answer to each question in ' + MAX_ATTEMPTS + ' attempts or fewer.'
          : escalated + ' of ' + record.results.length + ' questions went to the last attempt. For each of them, the gate escalated and gave the worked answer.');
      inner.appendChild(summary);
      var list = h('ol', { class: 'gate-list' });
      def.questions.forEach(function (q, i) {
        var r = record.results[i];
        if (!r) return;
        list.appendChild(h('li', null, GE.stamp(r === 'PASS' ? 'PASS' : 'FAIL'), ' ', h('span', null, q.prompt.length > 110 ? q.prompt.slice(0, 108) + '…' : q.prompt), ' ', r === 'PASS' ? null : backLink(q)));
      });
      inner.appendChild(list);
      inner.appendChild(h('p', { class: 'small muted' }, record.status === 'PASS'
        ? 'The gate recorded this result in your trace.'
        : 'The gate recorded this result in your trace. You can go to the next part, but the path shows that this gate is not passed. Read the sections again, then try the gate again.'));
      inner.appendChild(h('div', { class: 'controls' },
        h('button', { type: 'button', class: 'btn ghost', onclick: function () { index = 0; results = []; ask(true); } }, 'Try the gate again')));
      if (fresh) { summary.setAttribute('tabindex', '-1'); summary.focus({ preventScroll: true }); }
    }

    function finish() {
      var status = results.every(function (r) { return r === 'PASS'; }) ? 'PASS' : 'ESCALATED';
      var record = { status: status, results: results.slice(), at: Date.now() };
      GE.store.setGate(chapter, record);
      GE.trace.add('gate', chapter, status);
      showSummary(record, true);
    }

    function ask(focus) {
      attempts = 0;
      var q = def.questions[index];
      GE.clear(inner);
      inner.appendChild(head('Question ' + (index + 1) + ' of ' + def.questions.length));
      inner.appendChild(h('p', { class: 'gate-q' }, q.prompt, q.recall ? h('span', { class: 'small muted' }, '  (from part ' + q.recall + ')') : null));
      var body = h('div');
      var feedback = h('div', { class: 'gate-result', 'aria-live': 'polite' });
      var send = h('button', { type: 'button', class: 'btn', disabled: true }, 'Send to the gate');
      var next = h('button', { type: 'button', class: 'btn', hidden: true, onclick: function () { index++; if (index >= def.questions.length) finish(); else ask(true); } },
        index === def.questions.length - 1 ? 'Finish the gate' : 'Next question');
      var readAnswer = q.kind === 'assign' ? assign(q, body, send) : choice(q, body, send);

      send.addEventListener('click', function () {
        attempts++;
        var last = attempts >= MAX_ATTEMPTS;
        var verdict = readAnswer(last);
        GE.clear(feedback);
        if (verdict.ok) {
          feedback.appendChild(h('p', null, GE.stamp('PASS'), ' ', verdict.why));
          close('PASS');
        } else if (last) {
          feedback.appendChild(h('p', null, GE.stamp('FAIL'), ' Attempt ' + attempts + ' of ' + MAX_ATTEMPTS + ': not correct. This was the last attempt. The gate escalates: it stops, and gives you the worked answer.'));
          feedback.appendChild(h('p', null, h('strong', null, 'Worked answer. '), verdict.answer));
          if (verdict.detail) feedback.appendChild(verdict.detail);
          var back = backLink(q); if (back) feedback.appendChild(h('p', null, back));
          verdict.reveal();
          close('ESCALATED');
        } else {
          feedback.appendChild(h('p', null, GE.stamp('FAIL'), ' Attempt ' + attempts + ' of ' + MAX_ATTEMPTS + ': not correct. ', verdict.count || ''));
          feedback.appendChild(h('p', null, h('strong', null, 'A hint. '), q.hint || 'The notes give the answer in the section of this question.', ' ', backLink(q)));
          send.disabled = true;
          var first = body.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
        }
      });
      function close(result) {
        results[index] = result;
        send.hidden = true; next.hidden = false;
        [].forEach.call(body.querySelectorAll('button'), function (b) { b.disabled = true; });
        next.focus({ preventScroll: true });
      }
      inner.appendChild(body); inner.appendChild(h('div', { class: 'controls' }, send, next,
        q.source ? h('span', { class: 'src', text: q.source }) : null));
      inner.appendChild(feedback);
      // The button that the learner pushed is gone: put the focus on the new question.
      if (focus) { var qEl = inner.querySelector('.gate-q'); qEl.setAttribute('tabindex', '-1'); qEl.focus({ preventScroll: true }); }
    }

    function choice(q, body, send) {
      var picked = -1;
      var options = q.fixed ? q.options.slice() : GE.rng(GE.newSeed()).shuffle(q.options);
      var list = h('div', { class: 'gate-opts', role: 'group', 'aria-label': 'Answers' });
      var buttons = options.map(function (o, i) {
        var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: function () {
          picked = i; send.disabled = false;
          buttons.forEach(function (x, j) { x.setAttribute('aria-pressed', String(j === i)); });
        } }, o.text);
        list.appendChild(b); return b;
      });
      body.appendChild(list);
      var right = options.filter(function (o) { return o.correct; })[0];
      return function () {
        var o = options[picked];
        if (!o.correct) { buttons[picked].classList.add('is-wrong'); buttons[picked].disabled = true; buttons[picked].setAttribute('aria-pressed', 'false'); }
        return {
          ok: !!o.correct, why: o.why || 'Correct.',
          answer: right.text + ' ' + (right.why || ''),
          detail: o.why ? h('p', { class: 'small' }, h('strong', null, 'Your answer. '), o.why) : null,
          reveal: function () { buttons.forEach(function (b, j) { b.classList.toggle('is-answer', options[j].correct === true); }); }
        };
      };
    }

    function assign(q, body, send) {
      var answers = q.items.map(function () { return null; });
      var items = GE.rng(GE.newSeed()).shuffle(q.items);
      // With two categories, a mark on each incorrect row gives the answer. Then the gate gives only the count.
      var markRows = q.bins.length > 2;
      var list = h('div', { class: 'gate-assign' });
      var rows = items.map(function (item, n) {
        var seg = GE.segmented('Answer for: ' + item.text, q.bins, null, function (v) {
          answers[n] = v; rows[n].classList.remove('is-wrong'); rows[n].mark.hidden = true;
          send.disabled = answers.some(function (a) { return a === null; });
        });
        var mark = h('span', { class: 'stamp fail row-mark', hidden: true }, 'NOT CORRECT');
        var row = h('div', { class: 'row' }, h('span', null, mark, item.text), seg.el);
        row.seg = seg; row.mark = mark;
        list.appendChild(row); return row;
      });
      body.appendChild(list);
      return function (last) {
        var wrong = [];
        items.forEach(function (item, n) {
          var bad = answers[n] !== item.bin;
          if (bad) wrong.push(item);
          var show = bad && (markRows || last);
          rows[n].classList.toggle('is-wrong', show); rows[n].mark.hidden = !show;
        });
        var detail = h('ul', { class: 'problems' });
        wrong.forEach(function (item) { detail.appendChild(h('li', null, item.text + ' → ' + item.bin + '. ' + (item.why || ''))); });
        return {
          ok: !wrong.length,
          why: q.why || 'Each row has the correct answer.',
          count: (wrong.length === 1 ? '1 of ' + q.items.length + ' rows has' : wrong.length + ' of ' + q.items.length + ' rows have') + ' an incorrect answer.' + (markRows ? ' Each one is marked.' : ''),
          answer: 'The rows now show the answer of the notes.',
          detail: detail,
          reveal: function () { rows.forEach(function (r, n) { r.seg.set(items[n].bin, true); r.mark.hidden = true; r.classList.remove('is-wrong'); }); }
        };
      };
    }

    if (saved) showSummary(saved, false); else ask();
  };
})(window.GE);

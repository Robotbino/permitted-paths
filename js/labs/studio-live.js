/* studio-live.js: the instruments of part S that run the code of the reference application in the page.
   Added by this edition. It is not from the GE notes.

   studioSort      sort statements of a person into four kinds of evidence, then read the cause
   studioPlan      the payday plan: change the inputs, and the application's own function makes the plan
   studioPipeline  the import pipeline on a sample bank file, or on text that the learner pastes
   studioInsights  observation, possible interpretations, recommendation, from the application's own function
   studioAssist    replays a recorded request through the six layers of the permitted-action design

   GE.domain is a bundle of the TypeScript in examples/personal-finance/shared (js/data/studio-domain.js,
   made by examples/tools/sync-studio.py). The page and the application thus run the same functions.
   Nothing here sends data to a network: text that the learner pastes stays in the page. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var D = GE.domain;
  function money(cents) { return D.formatMoney(cents); }
  function missing(el) { el.appendChild(h('p', { class: 'small' }, 'This instrument needs the file js/data/studio-domain.js. Run: python examples/tools/sync-studio.py')); }
  function field(label, input, hint) {
    return h('label', { class: 'st-field' }, h('span', { class: 'st-field-label' }, label), input, hint ? h('span', { class: 'small muted' }, hint) : null);
  }
  /** One short line for a screen reader. The element is made once and is never cleared with its instrument,
      thus a change of its text is announced. While the person types, only the last line is announced. */
  function status() {
    var el = h('p', { class: 'vh', role: 'status' }), timer = null;
    return {
      el: el,
      say: function (text, now) {
        clearTimeout(timer);
        if (now) { el.textContent = text; return; }
        timer = setTimeout(function () { el.textContent = text; }, 600);
      }
    };
  }
  /** The ledger is the expense store and the income store together. An older recording has only the expenses. */
  function ledgerRows(sc) {
    return typeof sc.income_rows_after === 'number' ? 'Rows in the ledger: ' + sc.rows_after + ' expenses and ' + sc.income_rows_after + ' income' : 'Expense rows in the ledger: ' + sc.rows_after;
  }

  /* ---------- sort the evidence ---------- */
  var KINDS = [['explicit', 'Explicit'], ['inference', 'Strong inference'], ['open', 'Open question'], ['challenged', 'Challenged assumption']];
  GE.labs.studioSort = function (el, chapter) {
    var rows = [].slice.call(el.querySelectorAll('tr[data-kind]'));
    var fallback = [].slice.call(el.children);
    var score = h('p', { class: 'st-score', 'aria-live': 'polite' }, 'You sorted 0 of ' + rows.length + ' statements.');
    var done = 0, right = 0, trap = 0;
    var list = h('ol', { class: 'st-sort' }, rows.map(function (tr) {
      var cells = tr.children, kind = tr.dataset.kind;
      var out = h('div', { class: 'st-sort-out', 'aria-live': 'polite' });
      var group = h('div', { class: 'chips', role: 'group', 'aria-label': 'The kind of this statement' });
      KINDS.forEach(function (k) {
        var b = h('button', { type: 'button', class: 'chip small', 'aria-pressed': 'false', onclick: function () {
          if (group.dataset.done) return;
          group.dataset.done = '1';
          done++;
          var ok = k[0] === kind;
          if (ok) right++;
          if (!ok && k[0] === 'explicit') trap++;
          [].forEach.call(group.children, function (x) { x.disabled = true; x.setAttribute('aria-pressed', String(x === b)); if (x.dataset.k === kind) x.classList.add('st-answer'); });
          GE.clear(out);
          out.appendChild(h('p', null, GE.stamp(ok ? 'PASS' : 'FAIL'), ' ', h('span', { class: 'st-ev st-ev-' + kind }, cells[2].textContent), ' ', cells[3].textContent));
          score.textContent = 'You sorted ' + done + ' of ' + rows.length + ' statements. ' + right + ' correct.' + (done === rows.length ? (trap ? ' ' + trap + ' time(s) you marked a statement "explicit" that was not: that is the most common error, and it is how a team builds what was said and not what is needed.' : ' You did not mark any inference or assumption as "explicit".') : '');
          if (done === rows.length) GE.trace.lab('studioSort', chapter);
        } }, k[1]);
        b.dataset.k = k[0];
        group.appendChild(b);
      });
      return h('li', null, h('p', { class: 'st-sort-text' }, cells[0].textContent), h('p', { class: 'small st-sort-evidence' }, h('strong', null, 'Evidence: '), cells[1].textContent), group, out);
    }));
    el.appendChild(score);
    el.appendChild(list);
    el.appendChild(h('details', { class: 'drawer' }, h('summary', null, 'The register as a table ', h('span', { class: 'tag' }, 'with the answers')), h('div', { class: 'drawer-body' }, fallback)));
  };

  /* ---------- the payday plan ---------- */
  GE.labs.studioPlan = function (el, chapter) {
    if (!D) return missing(el);
    var P = D.planning, base = D.planExample();
    function first() { return { income: base.income_cents, request: base.savings_request_cents, living: base.variable_living_cents, unlisted: base.unlisted_cents, ignore: false }; }
    var state = first();
    var used = 0, bad = {}, inputs = {};
    // Not a live region: paint() rebuilds it on each key. The status line says the result in one sentence.
    var out = h('div', { class: 'st-plan-out' });
    var said = status();

    function amountInput(key, step) {
      var input = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: String(step || 100), value: String(state[key] / 100), oninput: function () {
        var cents = D.parseAmount(String(input.value));
        // An amount that the application does not accept: the plan does not show old figures in silence.
        bad[key] = cents === null;
        input.setAttribute('aria-invalid', String(bad[key]));
        if (!bad[key]) { state[key] = cents; if (++used === 3) GE.trace.lab('studioPlan', chapter); }
        paint();
      } });
      inputs[key] = input;
      return input;
    }
    var ignore = h('input', { type: 'checkbox', id: 'st-ignore', onchange: function () { state.ignore = ignore.checked; paint(true); } });

    function table(caption, head, body) {
      return h('div', { class: 'table-wrap' }, h('table', { class: 'st-plan-table' }, h('caption', null, caption),
        h('thead', null, h('tr', null, head.map(function (t) { return h('th', { scope: 'col' }, t); }))), h('tbody', null, body)));
    }

    function paint(now) {
      var input = Object.assign({}, base, { income_cents: state.income, savings_request_cents: state.request, variable_living_cents: state.living, unlisted_cents: state.ignore ? 0 : state.unlisted });
      // With the layer left out, the history must leave it out too, or the comparison is not fair.
      if (state.ignore) input.history = base.history.map(function (c) { return Object.assign({}, c, { unlisted_cents: 0 }); });
      GE.clear(out);
      if (Object.keys(bad).some(function (k) { return bad[k]; })) {
        var wrong = 'Give an amount from 0 to 999 999 999.99, with no more than two decimals. The plan shows again when each amount is correct.';
        out.appendChild(h('p', { class: 'small' }, GE.stamp('FAIL'), ' ' + wrong));
        said.say('FAIL. ' + wrong, now);
        return;
      }
      var problems = P.checkPlanInput(input);
      if (problems.length) { out.appendChild(h('ul', { class: 'small' }, problems.map(function (p) { return h('li', null, p); }))); said.say(problems[0], now); return; }
      var plan = P.buildPlan(input);
      out.appendChild(table('The arithmetic (rule BR2). Each subtraction is one line.', ['Line', 'Amount', 'What is left'],
        plan.arithmetic.map(function (a) { return h('tr', null, h('th', { scope: 'row' }, a.label), h('td', { class: 'num' }, money(a.amount_cents)), h('td', { class: 'num' }, money(a.running_cents))); })));
      out.appendChild(h('p', null, h('strong', null, 'Savings (rule BR4): ' + money(plan.sizing.chosen_cents) + '. '), plan.sizing.reason,
        plan.sizing.excluded_cycles.length ? ' Left out, because its data is not complete: ' + plan.sizing.excluded_cycles.join(', ') + '.' : ''));
      if (state.ignore) out.appendChild(h('p', { class: 'callout note' }, h('strong', null, 'You left a layer out. '), 'The plan now says that ' + money(plan.headroom_cents) + ' is free. With the layer, it is ' + money(P.buildPlan(Object.assign({}, base, { income_cents: state.income, savings_request_cents: state.request, variable_living_cents: state.living, unlisted_cents: state.unlisted })).headroom_cents) + '. The difference is money that the plan promises to savings and that the cycle spends.'));
      out.appendChild(table('The savings pots, in the sequence of their priority (rule BR5).', ['Pot', 'Target', 'Gets', 'Short by'],
        plan.split.map(function (s) { return h('tr', null, h('th', { scope: 'row' }, s.name), h('td', { class: 'num' }, money(s.target_cents)), h('td', { class: 'num' }, money(s.funded_cents)), h('td', { class: 'num' }, s.shortfall_cents ? money(s.shortfall_cents) : 'nothing')); })));
      if (plan.sacrificed.length) out.appendChild(h('p', { class: 'small' }, h('strong', null, 'What gets less: '), plan.sacrificed.join(', ') + '. The plan says it plainly; it does not hide it in a total.'));
      out.appendChild(table('What to move, on the day after payday, in this sequence (rule BR3).', ['', 'Move', 'Amount', 'On'],
        plan.moves.map(function (m) { return h('tr', null, h('td', { class: 'num' }, String(m.order)), h('th', { scope: 'row' }, m.label), h('td', { class: 'num' }, money(m.amount_cents)), h('td', { class: 'mono' }, m.on)); })));
      var top = Math.max.apply(null, plan.weeks.map(function (w) { return w.cap_cents; }).concat([1]));
      out.appendChild(h('p', null, h('strong', null, 'Free spending for the cycle: ' + money(plan.discretionary_cents) + '. '), 'That is ' + money(plan.daily_rate_cents) + ' for each day (rule BR7).'));
      out.appendChild(h('ol', { class: 'st-weeks' }, plan.weeks.map(function (w) {
        // The index of a block starts at 1 (shared/planning/pay-cycle.ts).
        return h('li', null, h('span', { class: 'st-week-label' }, 'Week ' + w.index + ' · ' + w.start + ' to ' + w.end + ' · ' + w.days + ' day' + (w.days === 1 ? '' : 's')),
          h('span', { class: 'st-week-bar', 'aria-hidden': 'true' }, h('span', { style: 'width:' + Math.round(w.cap_cents * 100 / top) + '%' })), h('span', { class: 'num' }, money(w.cap_cents)));
      })));
      if (plan.remainder_cents) out.appendChild(h('p', { class: 'small muted' }, money(plan.remainder_cents) + ' is not in a cap, because the daily rate is a whole number of cents. The plan states it.'));
      if (plan.warnings.length) out.appendChild(h('ul', { class: 'small st-warnings' }, plan.warnings.map(function (w) { return h('li', null, h('strong', null, w.rule), ' ', w.text); })));
      said.say('Savings ' + money(plan.sizing.chosen_cents) + '. Free spending ' + money(plan.discretionary_cents) + '. ' + plan.warnings.length + (plan.warnings.length === 1 ? ' warning.' : ' warnings.'), now);
    }

    function startAgain() {
      state = first(); bad = {};
      Object.keys(inputs).forEach(function (k) { inputs[k].value = String(state[k] / 100); inputs[k].setAttribute('aria-invalid', 'false'); });
      ignore.checked = false;
      paint(true); // the button stays in its place, thus the focus stays on it
    }

    el.appendChild(h('div', { class: 'st-plan' },
      h('div', { class: 'st-plan-in' },
        field('Income for the cycle (rand)', amountInput('income', 500)),
        field('Savings that Sam asks for', amountInput('request', 250), 'The plan gives this amount, or the largest amount that held in the worst cycle on record.'),
        field('Planned living costs: food, transport', amountInput('living', 250)),
        field('Spending that fits neither list', amountInput('unlisted', 100), 'From the history. A plan that leaves it out says that more is free than is true.'),
        h('label', { class: 'st-check', for: 'st-ignore' }, ignore, ' Leave out the spending that fits neither list'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: startAgain }, 'Start again')),
      out, said.el));
    el.appendChild(h('p', { class: 'small' }, h('span', { class: 'prov source' }, 'The real function of the application.'), ' ', h('code', null, 'buildPlan'), ' in ', h('code', null, 'shared/planning/plan.ts'), '. Sam, the banks and the amounts are fictional. Fixed commitments: ' + money(base.commitments.reduce(function (s, c) { return s + c.amount_cents; }, 0)) + ' in ' + base.commitments.length + ' items. Buffer: ' + base.buffer_items.map(function (b) { return b.name + ' ' + money(b.amount_cents); }).join(', ') + '.'));
    paint();
    said.say('', true); // nothing to announce when the page opens
  };

  /* ---------- the import pipeline ---------- */
  var STATUS_TEXT = { 'new': 'new', duplicate: 'duplicate', transfer: 'transfer', held: 'held', reversed: 'reversed', problem: 'problem' };
  GE.labs.studioPipeline = function (el, chapter) {
    if (!D) return missing(el);
    var S = D.samples, PL = D.pipeline;
    var cases = [
      { id: 'northbank', label: 'Northbank file', text: S.NORTHBANK_SAMPLE, account: S.NORTHBANK_ACCOUNT, name: 'northbank.csv' },
      { id: 'harbour', label: 'Harbour Bank file, after the Northbank file', text: S.HARBOUR_SAMPLE, account: S.HARBOUR_ACCOUNT, name: 'harbour.csv', after: 'northbank' },
      { id: 'again', label: 'The Northbank file a second time', text: S.NORTHBANK_SAMPLE, account: S.NORTHBANK_ACCOUNT, name: 'northbank.csv', again: true },
      { id: 'unknown', label: 'A file in a layout that the application does not know', text: S.UNKNOWN_SAMPLE, account: 'other-account', name: 'other.tsv' },
      { id: 'own', label: 'Your own text (it stays in this page)', text: 'Date,Details,Amount\n2026-03-02,Corner shop,-45.50\n2026-03-30,Salary,21000.00\n', account: 'my-account', name: 'pasted.csv', editable: true }
    ];
    var current = cases[0], mapping = null, seen = 0;
    var pick = h('select', { class: 'st-select', 'aria-label': 'The file', onchange: function () { current = cases.filter(function (c) { return c.id === pick.value; })[0]; mapping = null; area.value = current.text; area.readOnly = !current.editable; run(true); } },
      cases.map(function (c) { return h('option', { value: c.id }, c.label); }));
    var area = h('textarea', { class: 'st-raw', rows: '7', spellcheck: 'false', 'aria-label': 'The raw text of the file', readonly: true, oninput: function () { if (current.editable) { current.text = area.value; mapping = null; run(false); } } });
    area.value = current.text;
    // Not a live region: run() rebuilds it on each key. The status line says the result in one sentence.
    var out = h('div', { class: 'st-pipe-out' });
    var said = status();

    function knownFor(c) {
      var known = { fingerprints: [] };
      if (c.again) known.fingerprints = PL.runPipeline(c.text, { account: c.account, source_name: c.name }).rows.map(function (r) { return r.fingerprint; });
      if (c.after) {
        var first = cases.filter(function (x) { return x.id === c.after; })[0];
        known.other_account_rows = PL.runPipeline(first.text, { account: first.account, source_name: first.name }).rows
          .filter(function (r) { return r.status === 'new' && r.occurred_on && r.amount_cents && r.direction; })
          .map(function (r) { return { account: r.account, occurred_on: r.occurred_on, amount_cents: r.amount_cents, direction: r.direction, fingerprint: r.fingerprint }; });
      }
      return known;
    }

    function stage(n, title, body) { return h('section', { class: 'st-stage-card' }, h('h4', { class: 'st-stage-' + n, tabindex: '-1' }, h('span', { class: 'st-stage-n' }, String(n)), ' ', title), body); }

    /** The first guess of the form. One column named "Amount" (or only three columns) is one amount with a sign. */
    function firstGuess(ins) {
      var header = ins.header, row = ins.rows[0] ? ins.rows[0].cells : [];
      var named = header.filter(function (c) { return /^amount$/i.test(String(c).trim()); })[0];
      var single = named || (header.length < 4 ? header[2] || '' : '');
      var day = String(row[0] || '').trim();
      return {
        date: header[0] || '', description: header[1] || '',
        amount: single, debit: single ? '' : header[2] || '', credit: single ? '' : header[3] || '', negative_means: 'out',
        date_format: /^\d{4}-\d{2}-\d{2}$/.test(day) ? 'YYYY-MM-DD' : /^\d{8}$/.test(day) ? 'YYYYMMDD' : 'DD/MM/YYYY', decimal: '.'
      };
    }

    function mappingForm(ins) {
      var m = mapping ? Object.assign({}, mapping) : firstGuess(ins);
      function sel(key, options) {
        var s = h('select', { class: 'st-select', onchange: function () { m[key] = s.value; } }, options.map(function (o) {
          var value = Array.isArray(o) ? o[0] : o, text = Array.isArray(o) ? o[1] : o || '(none)';
          return h('option', { value: value, selected: value === m[key] ? true : null }, text);
        }));
        return s;
      }
      var cols = [''].concat(ins.header);
      return h('div', { class: 'st-mapping' },
        h('p', { class: 'small' }, 'No known layout fits this header. The application does not guess. A person gives the mapping here; at level 3 a model can propose one. In the two cases the same check decides.'),
        field('Date column', sel('date', cols)), field('Description column', sel('description', cols)),
        field('Amount column (one amount with a sign)', sel('amount', cols)), field('A minus sign means', sel('negative_means', [['out', 'money out'], ['in', 'money in']])),
        field('Money out column', sel('debit', cols)), field('Money in column', sel('credit', cols)),
        field('Date format', sel('date_format', ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYYMMDD'])), field('Decimal sign', sel('decimal', ['.', ','])),
        h('p', { class: 'small muted' }, 'Give one amount column, or a money-out column and a money-in column. A mapping from a person gets no tolerance: one row with a date that does not exist stops the whole file. Remove the row, or correct it, and check again.'),
        h('button', { type: 'button', class: 'btn small', onclick: function () {
          mapping = m; run(true);
          // run() rebuilt the stage that held this button. Put the focus on the new button, or on the heading of stage 2.
          var next = out.querySelector('.st-mapping button') || out.querySelector('.st-stage-2');
          if (next) next.focus();
        } }, 'Check this mapping'));
    }

    function run(now) {
      GE.clear(out);
      var options = { account: current.account, source_name: current.name, known: knownFor(current) };
      if (mapping) {
        var columns = { date: mapping.date, description: mapping.description, amount: mapping.amount || undefined, debit: mapping.debit || undefined, credit: mapping.credit || undefined };
        options.profile = { id: 'person', name: 'A mapping from the person', columns: columns, date_format: mapping.date_format, decimal: mapping.decimal };
        if (mapping.amount) options.profile.negative_means = mapping.negative_means;
      }
      var r = PL.runPipeline(area.value, options);
      var ins = r.inspected;
      out.appendChild(stage(1, 'Inspect', h('p', { class: 'small' }, 'Separator: ', h('code', null, ins.delimiter === '\t' ? 'tab' : ins.delimiter), '. Quoted cells: ' + (ins.quoted ? 'yes' : 'no') + '. Header: ', h('code', null, ins.header.join(' | ') || '(none)'), '. Rows: ' + ins.rows.length + '. Hash of the file: ', h('code', null, r.file_hash), '.')));
      var mapBody;
      if (r.profile && !r.mapping_problems.length) mapBody = h('p', { class: 'small' }, GE.stamp('PASS'), ' The layout is "' + r.profile.name + '". Date format ' + r.profile.date_format + ', decimal sign "' + r.profile.decimal + '".');
      else if (r.mapping_problems.length) mapBody = h('div', null, h('p', { class: 'small' }, GE.stamp('FAIL'), ' The mapping did not pass the check. Nothing is staged.'), h('ul', { class: 'small' }, r.mapping_problems.slice(0, 6).map(function (p) { return h('li', null, h('strong', null, p.rule), ' ', p.text); })), mappingForm(ins));
      else mapBody = mappingForm(ins);
      out.appendChild(stage(2, 'Map and validate', mapBody));
      if (r.problems.length) out.appendChild(h('ul', { class: 'small st-warnings' }, r.problems.slice(0, 5).map(function (p) { return h('li', null, h('strong', null, p.rule), ' ', p.text); })));
      if (!r.rows.length) {
        var first = r.mapping_problems[0] || r.problems[0];
        said.say(r.mapping_problems.length ? 'FAIL. The mapping did not pass the check. ' + first.rule + ' ' + first.text
          : r.needs_mapping ? 'No known layout fits this header. Give a mapping.'
          : first ? 'Nothing is staged. ' + first.rule + ' ' + first.text : 'Nothing is staged.', now);
        return;
      }
      var detail = h('div', { class: 'st-prov', 'aria-live': 'polite' }, h('p', { class: 'small muted' }, 'Select a row to see where each value came from.'));
      var body = r.rows.map(function (row) {
        var btn = h('button', { type: 'button', class: 'st-rowbtn', onclick: function () {
            GE.clear(detail);
            detail.appendChild(h('p', { class: 'small' }, h('strong', null, 'Line ' + row.line_no + ' of ' + current.name + ', as it is in the file: '), h('code', null, row.raw)));
            detail.appendChild(h('ol', { class: 'small st-steps' }, row.provenance.map(function (s) { return h('li', null, h('span', { class: 'mono' }, s.step + ' · ' + s.field), ': ', h('code', null, s.from || '(empty)'), ' → ', h('code', null, s.to || '(empty)')); })));
            if (row.problems.length) detail.appendChild(h('ul', { class: 'small' }, row.problems.map(function (p) { return h('li', null, GE.stamp('FAIL'), ' ', h('strong', null, p.rule), ' ', p.text); })));
            if (row.note) detail.appendChild(h('p', { class: 'small' }, row.note));
            [].forEach.call(out.querySelectorAll('.st-rowbtn'), function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
            if (++seen === 2) GE.trace.lab('studioPipeline', chapter);
          } }, STATUS_TEXT[row.status]);
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Line ' + row.line_no + ', ' + STATUS_TEXT[row.status] + ': show where each value came from');
        var tr = h('tr', { class: 'st-row st-row-' + row.status }, h('td', { class: 'num' }, String(row.line_no)),
          h('td', null, btn),
          h('td', { class: 'mono' }, row.occurred_on || '—'), h('td', { class: 'num' }, row.amount_cents == null ? '—' : (row.direction === 'in' ? '+' : '−') + money(row.amount_cents)),
          h('td', null, row.description_clean), h('td', { class: 'small' }, row.note || (row.problems[0] ? row.problems[0].text : '')));
        return tr;
      });
      var counts = Object.keys(r.summary).filter(function (k) { return r.summary[k]; }).map(function (k) { return r.summary[k] + ' ' + k; }).join(' · ');
      said.say('Staged ' + r.rows.length + ' rows: ' + counts.replace(/ · /g, ', ') + '.', now);
      out.appendChild(stage(3, 'Normalise and reconcile', h('div', null,
        h('p', { class: 'small' }, counts + '. Only a row that is "new" goes to the person for a category.'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'st-rows' }, h('thead', null, h('tr', null, ['Line', 'State', 'Date', 'Amount', 'Description, cleaned', 'Note'].map(function (t) { return h('th', { scope: 'col' }, t); }))), h('tbody', null, body))), detail)));
      var entries = r.rows.filter(function (x) { return x.status === 'new' && x.amount_cents; }).map(function (x) { return { occurred_on: x.occurred_on, description: x.description_clean, amount_cents: x.amount_cents, category_name: '', note: '', kind: x.direction === 'in' ? 'income' : 'consumption' }; });
      var paste = D.exporter.pasteRows(entries, D.exporter.EXPORT_PROFILES.filter(function (p) { return p.id === 'two-tab-tracker'; })[0] || D.exporter.EXPORT_PROFILES[0]);
      out.appendChild(stage(4, 'Export: rows to paste', h('div', null, h('p', { class: 'small' }, 'After the person gives each new row a category, the application gives text that the person pastes into the spreadsheet. The application does not open the spreadsheet file. This is the expenses text for these rows, with no category yet:'),
        h('pre', { class: 'st-json', tabindex: '0', role: 'region', 'aria-label': 'Rows to paste' }, h('code', null, paste.expenses_tsv || '(no rows)')), h('ul', { class: 'small' }, paste.notes.map(function (t) { return h('li', null, t); })))));
    }

    el.appendChild(h('div', { class: 'st-pipe' }, h('div', { class: 'controls' }, h('label', { class: 'st-pick' }, h('span', null, 'File'), pick)), area, out, said.el));
    el.appendChild(h('p', { class: 'small' }, h('span', { class: 'prov source' }, 'The real pipeline of the application.'), ' ', h('code', null, 'runPipeline'), ' in ', h('code', null, 'shared/pipeline/index.ts'), '. The banks and the rows are fictional. Text that you put here is not sent anywhere.'));
    run();
    said.say('', true); // nothing to announce when the page opens
  };

  /* ---------- insights ---------- */
  GE.labs.studioInsights = function (el, chapter) {
    if (!D) return missing(el);
    var cap = 55342;
    function days(first, rest) { var a = []; for (var i = 0; i < 31; i++) a.push(i < 5 ? first : rest); return a; }
    var presets = {
      steady: { label: 'A steady cycle', weeks: [[cap, 48000], [cap, 51000], [cap, 50500], [cap, 47000]], by_day: days(7000, 6800), rows: [], now: { 'eating-out': 60000 }, before: { 'eating-out': 58000 }, planned: 600000, moved: 600000 },
      over: { label: 'Three weeks over the cap', weeks: [[cap, 71000], [cap, 64500], [cap, 52000], [cap, 69900]], by_day: days(9000, 8000), rows: [], now: { 'eating-out': 60000 }, before: { 'eating-out': 58000 }, planned: 600000, moved: 600000 },
      early: { label: 'Most of the spending in the first five days', weeks: [[cap, 54000], [cap, 20000], [cap, 15000], [cap, 12000]], by_day: days(29000, 4000), rows: [], now: {}, before: {}, planned: 600000, moved: 600000 },
      recurring: { label: 'A charge that repeats', weeks: [[cap, 40000], [cap, 42000], [cap, 41000], [cap, 39000]], by_day: days(6000, 5500), rows: ['2025-11-25', '2025-12-25', '2026-01-25'].map(function (c) { return { cycle_id: c, merchant_key: 'streamhouse', amount_cents: 19900, category_id: 'entertainment' }; }), now: {}, before: {}, planned: 600000, moved: 600000 },
      category: { label: 'One category grew', weeks: [[cap, 50000], [cap, 49000], [cap, 51000], [cap, 50000]], by_day: days(6500, 6400), rows: [], now: { transport: 240000 }, before: { transport: 150000 }, planned: 600000, moved: 600000 },
      nosave: { label: 'The savings did not move', weeks: [[cap, 30000], [cap, 28000], [cap, 31000], [cap, 29000]], by_day: days(4000, 4100), rows: [], now: {}, before: {}, planned: 600000, moved: 0 }
    };
    var out = h('div', { class: 'st-insights', 'aria-live': 'polite' });
    function paint(key) {
      var p = presets[key];
      var list = D.insights.insightsFor({ weeks: p.weeks.map(function (w) { return { cap_cents: w[0], spent_cents: w[1] }; }), spend_by_day: p.by_day, days_observed: 31, rows: p.rows, by_category_now: p.now, by_category_before: p.before, planned_savings_cents: p.planned, savings_rows_cents: p.moved });
      GE.clear(out);
      if (!list.length) out.appendChild(h('p', null, 'No insight. The function says nothing when the data does not support a statement. An application that always has something to say trains a person to ignore it.'));
      list.forEach(function (i) {
        out.appendChild(h('article', { class: 'st-insight' },
          h('p', null, h('span', { class: 'st-part' }, 'Observation'), ' ', i.observation),
          h('div', null, h('span', { class: 'st-part' }, 'Possible interpretations'), h('ul', null, i.interpretations.map(function (t) { return h('li', null, t); }))),
          h('p', null, h('span', { class: 'st-part' }, 'An option'), ' ', i.recommendation)));
      });
    }
    var seg = GE.segmented('The data of the cycle', Object.keys(presets).map(function (k) { return { value: k, label: presets[k].label }; }), 'over', function (k) { paint(k); GE.trace.lab('studioInsights', chapter); });
    el.appendChild(h('div', { class: 'controls st-wrap' }, seg.el));
    el.appendChild(out);
    el.appendChild(h('p', { class: 'small' }, h('span', { class: 'prov source' }, 'The real function of the application.'), ' ', h('code', null, 'insightsFor'), ' in ', h('code', null, 'shared/planning/insights.ts'), '. The data is fictional.'));
    paint('over');
  };
  /* ---------- a sentence through the six layers ---------- */
  var ASSIST_IDS = ['assist_analyse', 'assist_allowance_approved', 'assist_allowance_declined', 'assist_outside_allowlist', 'assist_invalid_answer', 'assist_clarify', 'assist_declined_request', 'assist_model_down', 'assist_ai_off'];
  var ASSIST_OPTIONS = [
    { value: 'answer', label: 'It answers at once, with figures from code' },
    { value: 'wait', label: 'It shows a proposal and waits for the person' },
    { value: 'ask', label: 'It asks a question' },
    { value: 'refuse', label: 'It refuses. Nothing changes' },
    { value: 'forms', label: 'It says: use the forms' }
  ];
  var ASSIST_KIND = { DONE: 'answer', NEEDS_APPROVAL: 'wait', CLARIFY: 'ask', REJECTED: 'refuse', DECLINED: 'refuse', AI_OFF: 'forms', DAILY_CAP: 'forms', MODEL_UNAVAILABLE: 'forms' };

  GE.labs.studioAssist = function (el, chapter) {
    var R = GE.data.studioRuns;
    if (!R || !R.assist) { el.appendChild(h('p', { class: 'small' }, 'The recordings are not loaded (js/data/studio-runs.js).')); return; }
    var byId = {};
    R.scenarios.forEach(function (sc) { byId[sc.id] = sc; });
    var list = ASSIST_IDS.map(function (id) { return byId[id]; }).filter(Boolean);
    var scenario = list[0], prediction = null, sent = false;
    var needs = {};
    R.assist.allowlist.forEach(function (c) { needs[c.name] = c; });

    var pick = h('select', { class: 'st-select', 'aria-label': 'The sentence', onchange: function () { scenario = byId[pick.value]; reset(); } },
      list.map(function (sc) { return h('option', { value: sc.id }, '"' + sc.request.text + '": ' + sc.title); }));
    var quote = h('p', { class: 'st-quote' });
    var setup = h('p', { class: 'small' });
    var sendBtn = h('button', { type: 'button', class: 'btn', onclick: send }, 'Send the sentence');
    var seg = GE.segmented('Your prediction', ASSIST_OPTIONS, null, function (v) { prediction = v; sendBtn.disabled = false; });
    var layers = h('ol', { class: 'st-layer-list', 'aria-live': 'polite' });
    var out = h('div', { class: 'st-out', 'aria-live': 'polite' });

    function first() { return scenario.exchanges ? scenario.exchanges[0].response : scenario.http.body; }
    function layer(name, state, body) {
      // The words say which layer decided. The outline is only a second signal.
      return h('li', { class: 'st-layer' + (state ? ' is-' + state : ''), 'aria-current': state === 'now' ? 'step' : null },
        h('span', { class: 'st-layer-name' }, name, state === 'now' ? h('span', { class: 'st-kind st-decided' }, 'Decided here') : null), h('div', { class: 'st-layer-body' }, body));
    }
    function lock(on) { [].forEach.call(seg.el.children, function (b) { b.disabled = on; }); }
    function p() { return h('p', null, [].slice.call(arguments)); }
    function problems(list) { return h('ul', null, list.map(function (x) { return h('li', null, h('strong', null, x.rule), ' ', x.text); })); }

    function reset() {
      prediction = null;
      quote.textContent = '“' + scenario.request.text + '”';
      var w = scenario.world || {};
      setup.textContent = w.interpreter === 'off' ? 'In this recording the server has no API key: the AI is off.'
        : w.interpreter === 'timeout' ? 'In this recording the stand-in model is told to give no answer in the permitted time.'
        : w.interpreter === 'outside' ? 'In this recording the stand-in model is told to request a capability that the allowlist does not have. A real model can do this too: after a hostile sentence, or by error.'
        : w.interpreter === 'invalid' ? 'In this recording the stand-in model is told to name a permitted capability with an input of the wrong shape.'
        : 'In this recording the stand-in model gives a sensible answer. The ledger has the rows of the worked example; today is ' + w.today + '.';
      GE.clear(layers); GE.clear(out);
      ['1 Interaction', '2 Interpretation', '3 Gate', 'The person', '4 Service', '5 Persistence', '6 Presentation'].forEach(function (n) { layers.appendChild(layer(n, 'waiting', h('p', { class: 'muted' }, 'Not reached yet.'))); });
      lock(false); seg.set(null, true); sent = false;
      sendBtn.disabled = true; sendBtn.removeAttribute('aria-disabled');
    }

    function send() {
      if (!prediction || sent) return;
      // The prediction is fixed when the sentence goes. "Start again" or a new sentence frees it.
      // aria-disabled, not disabled: the button has the focus, and a disabled button loses it.
      sent = true; lock(true); sendBtn.setAttribute('aria-disabled', 'true');
      var a = first(), st = a.status, cap = a.capability || null;
      var decide = scenario.exchanges && scenario.exchanges[1] ? scenario.exchanges[1] : null;
      var rows = [];
      rows.push(layer('1 Interaction', null, p('A client sends ', h('code', null, 'POST /api/assist'), ' with the text. The reference web application has no screen for this yet; the tests send the request through HTTP. The server checks its shape: 1 to 500 characters, and no other field.')));

      // 2 the model
      if (st === 'AI_OFF' || st === 'DAILY_CAP') rows.push(layer('2 Interpretation', 'now', p(GE.stamp('NO CALL'), ' ', a.message)));
      else if (st === 'MODEL_UNAVAILABLE') rows.push(layer('2 Interpretation', 'now', p(GE.stamp('FAIL'), ' One model call, and no answer that the application can use. There is no second try.')));
      else if (st === 'CLARIFY') rows.push(layer('2 Interpretation', 'now', p('The model answers ', h('code', null, 'CLARIFY'), ': the sentence can mean more than one thing. It names no capability.')));
      else if (st === 'DECLINED') rows.push(layer('2 Interpretation', 'now', p('The model answers ', h('code', null, 'DECLINE'), ': the sentence asks for something that is not in its list of capabilities. No request goes to the gate.')));
      else rows.push(layer('2 Interpretation', null, p('The model answers ', h('code', null, 'ACTION'), ' with the capability ', h('code', null, cap || '(none)'), cap === 'recommend_allowance' && a.consequences ? [' and the input ', h('code', null, '{ change_percent: ' + a.consequences.change_percent + ', reason: … }'), '. A percentage, not an amount.'] : '.', ' This is a request. It is not trusted.')));

      // 3 the gate
      var gated = st === 'REJECTED' || st === 'DONE' || st === 'NEEDS_APPROVAL' || st === 'FAILED';
      if (!gated) rows.push(layer('3 Gate', 'skipped', p('Not reached: there is no request to check.')));
      else if (st === 'REJECTED') rows.push(layer('3 Gate', 'now', [p(GE.stamp('FAIL'), ' ', h('code', null, a.reason), a.reason === 'UNKNOWN_CAPABILITY' ? ': check 2, the allowlist.' : a.reason === 'INVALID_INPUT' ? ': check 3, the shape of the input.' : a.reason === 'NOT_VERIFIABLE' ? ': check 4, the facts of the application.' : ': check 1, the shape of the request.'), problems(a.problems)]));
      else rows.push(layer('3 Gate', null, p(GE.stamp('PASS'), ' The request is an object with a capability and an input. ', h('code', null, cap), ' is in the allowlist. The input has the permitted shape. ', cap === 'recommend_allowance' ? 'The application calculated what the change does, in cents. ' : 'The application could verify each value. ', 'The result is PROPOSED, not done.')));

      // the person
      if (st === 'NEEDS_APPROVAL') {
        var c = a.consequences;
        var body = [p('The capability ', h('code', null, cap), ' changes data, thus the application waits (rule R17). It shows the consequences. Each figure is from the plan function:')];
        if (c && c.weekly_caps) {
          body.push(h('div', { class: 'table-wrap' }, h('table', { class: 'st-plan-table' }, h('thead', null, h('tr', null, ['', 'Before', 'After'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
            h('tbody', null, [
              h('tr', null, h('th', { scope: 'row' }, 'Free spending of the cycle'), h('td', { class: 'num' }, money(c.free_spending_before_cents)), h('td', { class: 'num' }, money(c.free_spending_after_cents))),
              h('tr', null, h('th', { scope: 'row' }, 'Cap of a week of seven days'), h('td', { class: 'num' }, money(c.weekly_caps[0].before_cents)), h('td', { class: 'num' }, money(c.weekly_caps[0].after_cents))),
              h('tr', null, h('th', { scope: 'row' }, 'Savings of the cycle'), h('td', { class: 'num' }, money(c.savings_before_cents)), h('td', { class: 'num' }, money(c.savings_after_cents)))
            ]))));
          body.push(p('More room each week comes out of the savings. The application says so before the person decides.'));
        }
        if (decide) body.push(p(h('strong', null, 'The person: '), decide.body.approve ? 'Yes.' : 'No.', ' (', h('code', null, 'POST ' + decide.path), ')'));
        rows.push(layer('The person', 'now', body));
      } else rows.push(layer('The person', 'skipped', p(st === 'DONE' ? 'Not asked: this capability reads only.' : 'Not asked: there is no proposal.')));

      // 4 and 5
      var executed = st === 'DONE' || (decide && decide.response.status === 'EXECUTED');
      if (st === 'DONE') rows.push(layer('4 Service', null, p('The application executes: ', needs[cap] ? needs[cap].application_does : '')));
      else if (decide && decide.response.status === 'EXECUTED') rows.push(layer('4 Service', null, p(GE.stamp('PASS'), ' Before it executes, the application runs the gate again with the facts of now, and compares the consequences with the ones that the person saw. Then it stores the new setting.')));
      else if (decide) rows.push(layer('4 Service', 'skipped', p('Nothing is executed. The proposal is closed as ', h('code', null, decide.response.status), '.')));
      else rows.push(layer('4 Service', 'skipped', p('Nothing is executed.')));
      rows.push(layer('5 Persistence', executed && decide ? null : 'skipped', p(executed && decide ? 'One setting of the plan changed: the savings request is now ' + money(decide.response.output.savings_request_cents) + '. ' : 'No stored data of the plan or the ledger changed. ', ledgerRows(scenario) + ' after the request, the same as before. The record of requests has one more line' + (decide ? ' for the request and one for the decision.' : '.'))));

      // 6
      var show;
      if (st === 'DONE' && a.output && a.output.categories) show = [p('Figures that code calculated, for the cycle ' + a.output.cycle.start + ' to ' + a.output.cycle.end + ':'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'st-plan-table' }, h('thead', null, h('tr', null, ['Category', 'Kind', 'Total'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, a.output.categories.map(function (x) { return h('tr', null, h('th', { scope: 'row' }, x.name), h('td', null, x.kind), h('td', { class: 'num' }, money(x.total_cents))); }))))];
      else if (st === 'CLARIFY') show = [p(h('strong', null, a.question)), h('ul', null, a.options.map(function (o) { return h('li', null, o); })), p('The answer of the person is a new sentence. It goes the same way.')];
      else if (st === 'DECLINED') show = [p(a.reason)];
      else if (st === 'REJECTED') show = [p('The answer has the status ', h('code', null, 'REJECTED'), ', the reason ', h('code', null, a.reason), ' and the problems of the gate (layer 3). Nothing changed.')];
      else if (a.message) show = [p(a.message), h('ul', null, a.without_ai.map(function (o) { return h('li', null, o); }))];
      else if (decide) show = [p(decide.response.status === 'EXECUTED' ? 'The answer has the new caps: ' + decide.response.output.weekly_caps.map(function (w) { return money(w.after_cents); }).join(', ') + '.'
        : ['The answer has the status ', h('code', null, decide.response.status), '. The plan is the same as before.'])];
      else show = [p('The answer of the application.')];
      rows.push(layer('6 Presentation', null, show));

      GE.clear(layers);
      rows.forEach(function (r) { layers.appendChild(r); });
      var right = ASSIST_KIND[st];
      var label = function (v) { return ASSIST_OPTIONS.filter(function (o) { return o.value === v; })[0].label; };
      GE.clear(out);
      out.appendChild(h('p', null, h('strong', null, 'The answer of the server: '), h('span', { class: 'mono' }, '200 ' + st), decide ? [', then ', h('span', { class: 'mono' }, decide.response.status)] : null, '. Model calls: ' + scenario.model_calls + '.'));
      var decided = rows.some(function (r) { return r.classList.contains('is-now'); });
      out.appendChild(h('p', null, 'Your prediction: ', h('strong', null, label(prediction)), '. ', GE.stamp(prediction === right ? 'PASS' : 'FAIL'), prediction === right ? '' : ' The application did this: ' + label(right) + '. '
        + (decided ? 'The layer with the words "Decided here" decided.' : 'No layer stopped the request: each one passed it on.')));
      GE.trace.lab('studioAssist', chapter);
    }

    el.appendChild(h('div', { class: 'st-assist' },
      h('div', { class: 'controls' }, h('label', { class: 'st-pick' }, h('span', null, 'Sentence'), pick)),
      quote, setup,
      h('div', { class: 'st-predict' }, h('p', { class: 'small' }, h('strong', null, 'Predict first. '), 'What does the application do with this sentence?'), seg.el),
      h('div', { class: 'controls' }, sendBtn, h('button', { type: 'button', class: 'btn ghost small', onclick: reset }, 'Start again')),
      layers, out,
      h('p', { class: 'small' }, h('span', { class: 'prov source' }, 'A recording of the real code, not a simulation.'), ' The requests went through the real server, gate and services. The model is a stand-in; no recording used the network. The scenarios are in ', h('code', null, 'scripts/scenarios.assist.ts'), '.')));
    reset();
  };
})(window.GE);

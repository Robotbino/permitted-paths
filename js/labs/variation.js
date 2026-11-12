/* variation.js: the two instruments of part 1.
   - sampler: ask for the status of order 1042 five times (GE 01, Try it).
   - compounding: the effect of small errors, p to the power of n (GE 01, section 3).
   The two instruments are simulations. They use fixed numbers and a seeded random number. */
(function (GE) {
  'use strict';
  var h = GE.h;

  /* The answers and their probabilities are an example by this edition.
     The notes give five of them: Awaiting delivery, Paid, Processing, Pending shipment, Paid. */
  var ANSWERS = [
    { text: 'Paid', p: 0.30 }, { text: 'Processing', p: 0.18 }, { text: 'Awaiting delivery', p: 0.16 },
    { text: 'Pending shipment', p: 0.14 }, { text: 'Payment accepted', p: 0.12 }, { text: 'Key queued', p: 0.10 }
  ];

  GE.labs.sampler = function (el, chapter) {
    var seed = GE.newSeed();
    var rng = GE.rng(seed);
    var results = GE.store.get('order1042', []);

    var bars = h('div', { class: 'dist', role: 'img', 'aria-label': 'The probability of each answer in this simulation.' });
    var rows = ANSWERS.map(function (a) {
      var row = h('div', { class: 'dist-row' },
        h('span', { class: 'dist-label' }, a.text),
        h('span', { class: 'dist-track' }, h('span', { class: 'dist-fill', style: 'width:' + (a.p / 0.30 * 100) + '%' })),
        h('span', { class: 'dist-p mono' }, Math.round(a.p * 100) + '%'));
      bars.appendChild(row); return row;
    });
    var slips = h('ol', { class: 'slips', 'aria-label': 'Your results' });
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var ask = h('button', { type: 'button', class: 'btn' }, 'Ask in a new chat');
    var again = h('button', { type: 'button', class: 'btn ghost', hidden: true }, 'Do the five again');

    function paint() {
      GE.clear(slips);
      for (var i = 0; i < 5; i++) {
        slips.appendChild(h('li', { class: 'slip' + (results[i] ? ' is-set' : '') },
          h('span', { class: 'slip-n mono' }, 'Chat ' + (i + 1)), h('span', { class: 'slip-v' }, results[i] || '—')));
      }
      var done = results.length >= 5;
      ask.hidden = done; again.hidden = !done;
      ask.textContent = results.length ? 'Ask again in a new chat (' + (results.length + 1) + ' of 5)' : 'Ask in a new chat';
      if (done) {
        var distinct = results.filter(function (r, i) { return results.indexOf(r) === i; }).length;
        GE.clear(out);
        out.appendChild(h('strong', null, distinct + ' different results from five runs of one prompt. '));
        out.appendChild(document.createTextNode('The input was the same each time. The course keeps these five results. You will put them into a validator in part 4.'));
      } else out.textContent = results.length ? '' : 'The same prompt goes to the model each time.';
    }
    ask.addEventListener('click', function () {
      var a = rng.weighted(ANSWERS, function (x) { return x.p; });
      rows.forEach(function (r, i) { r.classList.toggle('is-picked', ANSWERS[i] === a); });
      results = results.concat(a.text);
      GE.store.set('order1042', results);
      GE.trace.lab('sampler', chapter);
      paint();
      if (results.length >= 5) again.focus();
      else out.textContent = 'Chat ' + results.length + ': ' + a.text + '.';
    });
    again.addEventListener('click', function () {
      results = []; GE.store.set('order1042', results);
      rows.forEach(function (r) { r.classList.remove('is-picked'); });
      paint(); ask.focus();
    });

    el.appendChild(h('blockquote', { class: 'prompt-card' },
      h('span', { class: 'panel-title' }, 'The prompt'),
      'Order 1042: the payment is accepted. The email with the game key is in the send queue. Give the status of this order in two words at most.'));
    el.appendChild(h('div', { class: 'split' },
      h('div', null, h('p', { class: 'panel-title' }, 'What the model does: a probability for each answer, then one selection'), bars,
        h('p', { class: 'small muted' }, 'A real model calculates a probability for each next token. This list is a simple picture of that.')),
      h('div', null, h('p', { class: 'panel-title' }, 'Your five results'), slips)));
    el.appendChild(h('div', { class: 'controls' }, ask, again));
    el.appendChild(out);
    paint();
  };

  GE.labs.compounding = function (el, chapter) {
    var p = 95, n = 10, isCode = [], runs = 0;
    var rng = GE.rng(GE.newSeed());

    var pOut = h('output', { class: 'mono' }), nOut = h('output', { class: 'mono' }), eOut = h('output', { class: 'mono' }, '—');
    var pIn = h('input', { type: 'range', min: 80, max: 99, step: 1, value: p, id: 'cmp-p' });
    var nIn = h('input', { type: 'range', min: 2, max: 20, step: 1, value: n, id: 'cmp-n' });
    var eIn = h('input', { type: 'range', min: 0, max: 100, step: 1, value: 50, id: 'cmp-e' });
    var chart = h('div', { class: 'funnel' });
    var release = h('button', { type: 'button', class: 'btn', disabled: true }, 'Release 100 runs');
    var allModel = h('button', { type: 'button', class: 'btn ghost', onclick: function () { isCode = []; build(); } }, 'Make all steps model decisions');
    var readouts = h('div', { class: 'readouts', 'aria-live': 'polite' });
    var hint = h('p', { class: 'feedback' });
    var cols = [];
    var delta = h('p', { class: 'feedback', 'aria-live': 'polite' });

    function modelSteps() { var k = 0; for (var i = 0; i < n; i++) if (!isCode[i]) k++; return k; }
    function build() {
      GE.clear(chart); cols = [];
      chart.style.setProperty('--n', n);
      for (var i = 0; i < n; i++) (function (i) {
        var bar = h('span', { class: 'funnel-bar' });
        var num = h('span', { class: 'funnel-num mono' });
        var btn = h('button', { type: 'button', class: 'funnel-step ' + (isCode[i] ? 'is-code' : 'is-model'), 'aria-pressed': String(!!isCode[i]),
          'aria-label': 'Step ' + (i + 1) + ': ' + (isCode[i] ? 'code' : 'model decision') + '. Push to change.',
          onclick: function () { isCode[i] = !isCode[i]; build(); cols[i].btn.focus(); } }, isCode[i] ? 'C' : 'M');
        chart.appendChild(h('div', { class: 'funnel-col' }, num, h('span', { class: 'funnel-well' }, bar), btn));
        cols.push({ bar: bar, num: num, btn: btn });
      })(i);
      note();
    }
    function note() {
      pOut.textContent = p + '%'; nOut.textContent = n;
      var k = modelSteps();
      hint.textContent = runs
        ? (k < n ? (n - k) + ' of ' + n + ' steps are code now. Code makes these decisions, so they are not points where the result can change. Release 100 runs again.' : 'Now select some steps (M) to change them to code (C). Then release 100 runs again.')
        : 'Each M is a decision that the model makes. First make your estimate.';
      allModel.hidden = k === n;
    }
    function run() {
      runs++;
      var alive = 100, survivors = [];
      for (var i = 0; i < n; i++) {
        if (!isCode[i]) { var still = 0; for (var r = 0; r < alive; r++) if (rng.chance(p / 100)) still++; alive = still; }
        survivors.push(alive);
      }
      cols.forEach(function (c, i) {
        c.bar.style.transitionDelay = (GE.reduced() ? 0 : i * 45) + 'ms';
        c.bar.style.height = survivors[i] + '%';
        c.num.textContent = survivors[i];
      });
      var k = modelSteps();
      var calc = Math.pow(p / 100, k) * 100;
      GE.clear(readouts);
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, alive + ' of 100'), h('span', null, 'runs completed all ' + n + ' steps')));
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, calc.toFixed(0) + '%'), h('span', null, 'the calculation: ' + (p / 100).toFixed(2) + ' to the power of ' + k + ' model decisions')));
      readouts.appendChild(h('div', { class: 'readout' }, h('b', null, eIn.value + ' of 100'), h('span', null, 'your estimate')));
      var d = +eIn.value - alive;
      delta.textContent = (d === 0 ? 'Your estimate was equal to the result.' : 'Your estimate was ' + Math.abs(d) + (d > 0 ? ' more' : ' less') + ' than the result.') + ' Each step is correct ' + p + '% of the time, but only ' + alive + ' of 100 runs are correct at the end.';
      GE.trace.lab('compounding', chapter);
      note();
    }

    pIn.addEventListener('input', function () { p = +pIn.value; build(); });
    nIn.addEventListener('input', function () { n = +nIn.value; build(); });
    eIn.addEventListener('input', function () { eOut.textContent = eIn.value + ' of 100'; release.disabled = false; });
    release.addEventListener('click', run);

    el.appendChild(h('div', { class: 'cols' },
      h('div', { class: 'field' }, h('label', { for: 'cmp-p' }, 'Correct rate of one step: ', pOut), pIn),
      h('div', { class: 'field' }, h('label', { for: 'cmp-n' }, 'Number of steps: ', nOut), nIn),
      h('div', { class: 'field' }, h('label', { for: 'cmp-e' }, 'Your estimate of the runs that complete all steps: ', eOut), eIn)));
    el.appendChild(h('div', { class: 'funnel-scroll' }, chart));
    el.appendChild(h('ul', { class: 'legend' },
      h('li', null, h('span', { class: 'role role-model' }, 'M: a decision that the model makes')),
      h('li', null, h('span', { class: 'role role-code' }, 'C: code makes the decision')),
      h('li', null, 'The bar shows the runs that are still correct after the step')));
    el.appendChild(h('div', { class: 'controls' }, release, allModel));
    el.appendChild(readouts);
    el.appendChild(delta);
    el.appendChild(hint);
    el.appendChild(h('p', { class: 'small muted' }, 'The steps are independent in this simulation. It is a simple calculation, not a measurement of a real agent. The count changes a little between two releases, because each run is random.'));
    build();
  };
})(window.GE);

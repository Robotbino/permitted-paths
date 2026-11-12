/* figures.js: drawings with no simulation.
   - stepper: a drawing that you read in a fixed sequence of steps.
   - figure: a drawing only.
   - governed: the token numbers of the demonstration in GE 05, as two bars. */
(function (GE) {
  'use strict';
  var h = GE.h;

  GE.labs.figure = function (el) {
    var view = GE.graphView(el, GE.data.graphs[el.dataset.graph]);
    if (el.dataset.legend !== 'none' && GE.data.graphs[el.dataset.graph].nodes.some(function (n) { return n.type; })) el.appendChild(GE.legend());
    return view;
  };

  GE.labs.stepper = function (el, chapter) {
    var def = GE.data.graphs[el.dataset.graph];
    var view = GE.graphView(el, def);
    var i = -1;
    var text = h('p', { class: 'stepper-text', 'aria-live': 'polite' });
    var count = h('span', { class: 'stepper-count mono' });
    var prev = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { go(i - 1); } }, 'Back');
    var next = h('button', { type: 'button', class: 'btn small', onclick: function () { go(i + 1); } }, 'Next step');
    var all = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { go(-1); } }, 'Show all');

    function go(n) {
      i = Math.max(-1, Math.min(def.steps.length - 1, n));
      if (i < 0) {
        view.focus();
        text.textContent = 'Read this drawing in ' + def.steps.length + ' steps.';
        count.textContent = '';
      } else {
        var st = def.steps[i];
        view.focus(st.nodes, st.edges);
        text.textContent = st.text;
        count.textContent = 'Step ' + (i + 1) + ' of ' + def.steps.length;
        GE.trace.lab('stepper:' + el.dataset.graph, chapter);
      }
      prev.disabled = i < 0;
      next.disabled = i >= def.steps.length - 1;
      all.disabled = i < 0;
    }
    if (def.nodes.some(function (n) { return n.type; })) el.appendChild(GE.legend());
    el.appendChild(h('div', { class: 'controls' }, prev, next, all, count));
    el.appendChild(text);
    go(-1);
  };

  GE.labs.governed = function (el) {
    var rows = [['Naive agent', 200000], ['Governed agent', 32000]];
    var box = h('div', { class: 'bars', role: 'img', 'aria-label': 'Tokens in the talk: naive agent 200,000, governed agent 32,000.' });
    rows.forEach(function (r) {
      box.appendChild(h('div', { class: 'bar-row' },
        h('span', { class: 'bar-label' }, r[0]),
        h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: 'width:' + (r[1] / 200000 * 100) + '%' })),
        h('span', { class: 'bar-value mono' }, r[1].toLocaleString('en-US') + ' tokens')));
    });
    el.appendChild(box);
  };
})(window.GE);

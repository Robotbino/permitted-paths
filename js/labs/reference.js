/* reference.js (labs): the reference shelf. Glossary with search, incorrect ideas, checklist, ladder, sources. */
(function (GE) {
  'use strict';
  var h = GE.h;

  GE.labs.glossary = function (el) {
    var terms = GE.data.reference.glossary;
    var input = h('input', { class: 'input', type: 'search', id: 'gl-q', placeholder: 'For example: gate', autocomplete: 'off' });
    var part = 'all';
    var list = h('dl', { class: 'glossary' });
    var count = h('p', { class: 'small muted', 'aria-live': 'polite' });
    function paint() {
      var q = input.value.trim().toLowerCase();
      var shown = terms.filter(function (t) {
        return (part === 'all' || t[2] === part) && (!q || t[0].toLowerCase().indexOf(q) >= 0 || t[1].toLowerCase().indexOf(q) >= 0);
      });
      GE.clear(list);
      shown.forEach(function (t) {
        list.appendChild(h('dt', { id: 'term-' + t[0].toLowerCase().replace(/[^a-z]+/g, '-') }, t[0], ' ', h('a', { class: 'src', href: '#/' + t[2] }, 'part ' + t[2])));
        list.appendChild(h('dd', null, t[1]));
      });
      count.textContent = shown.length ? shown.length + ' of ' + terms.length + ' terms' : 'No term has this text. Try a shorter word, or select “All parts”.';
    }
    input.addEventListener('input', paint);
    var seg = GE.segmented('Part', [{ value: 'all', label: 'All parts' }].concat(['1', '2', '3', '4', '5', '6', '7'].map(function (p) { return { value: p, label: p }; })), 'all', function (v) { part = v; paint(); });
    el.appendChild(h('div', { class: 'glossary-tools' }, h('div', { class: 'field' }, h('label', { for: 'gl-q' }, 'Find a term'), input), h('div', { class: 'field' }, h('span', null, 'Part where the course gives the term'), seg.el)));
    el.appendChild(count); el.appendChild(list);
    paint();
  };

  GE.labs.ideas = function (el, chapter) {
    var ideas = GE.data.reference.ideas;
    var rng = GE.rng(GE.newSeed());
    var grid = h('div', { class: 'ideas' });
    var done = 0, right = 0;
    var score = h('p', { class: 'small', 'aria-live': 'polite' });
    ideas.forEach(function (pair) {
      var showCorrect = rng.chance(0.5);
      var body = h('div', { class: 'idea-body', 'aria-live': 'polite' });
      var buttons = h('div', { class: 'controls' });
      [['Correct idea', true], ['Incorrect idea', false]].forEach(function (o) {
        buttons.appendChild(h('button', { type: 'button', class: 'btn ghost small', onclick: function () {
          var ok = o[1] === showCorrect;
          done++; if (ok) right++;
          GE.clear(buttons); GE.clear(body);
          body.appendChild(h('p', null, GE.stamp(ok ? 'PASS' : 'FAIL'), ' The statement is ' + (showCorrect ? 'the correct idea.' : 'an incorrect idea.')));
          body.appendChild(h('p', { class: 'idea-wrong' }, h('span', { class: 'small muted' }, 'Incorrect idea'), '“' + pair[0] + '”'));
          body.appendChild(h('p', { class: 'idea-right' }, h('span', { class: 'small muted' }, 'Correct idea'), pair[1]));
          score.textContent = right + ' of ' + done + ' correct' + (done === ideas.length ? '. You examined each of the ten ideas.' : '.');
          if (done === ideas.length) GE.trace.lab('ideas', chapter);
        } }, o[0]));
      });
      grid.appendChild(h('div', { class: 'idea' }, h('p', { class: 'idea-claim' }, showCorrect ? pair[1] : '“' + pair[0] + '”'), buttons, body));
    });
    el.appendChild(grid); el.appendChild(score);
  };

  GE.labs.checklist = function (el) {
    var saved = GE.store.get('checklist', {});
    var total = 0;
    var count = h('p', { class: 'small', 'aria-live': 'polite' });
    function tally() { count.textContent = Object.keys(saved).filter(function (k) { return saved[k]; }).length + ' of ' + total + ' items have a mark.'; }
    GE.data.reference.checklist.forEach(function (group, gi) {
      el.appendChild(h('h3', null, group[0]));
      var ul = h('ul', { class: 'checklist' });
      group[1].forEach(function (text, i) {
        var id = 'ck-' + gi + '-' + i; total++;
        var box = h('input', { type: 'checkbox', id: id });
        box.checked = !!saved[id];
        box.addEventListener('change', function () { saved[id] = box.checked; GE.store.set('checklist', saved); tally(); });
        ul.appendChild(h('li', null, box, h('label', { for: id }, text)));
      });
      el.appendChild(ul);
    });
    el.appendChild(count); tally();
  };

  GE.labs.ladder = function (el) {
    var rows = GE.data.reference.ladder;
    var detail = h('div', { class: 'panel ladder-detail', 'aria-live': 'polite' });
    var steps = h('div', { class: 'ladder', role: 'group', 'aria-label': 'The levels of the ladder' });
    var buttons = rows.map(function (r) {
      var b = h('button', { type: 'button', class: 'ladder-step' + (r[0] === 6 ? ' is-here' : ''), 'aria-pressed': 'false', style: '--level:' + r[0], onclick: function () { pick(r); } },
        h('span', { class: 'mono' }, String(r[0])), h('span', null, r[1]));
      steps.appendChild(b); return b;
    });
    function pick(r) {
      buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(rows[i] === r)); });
      GE.clear(detail);
      detail.appendChild(h('p', { class: 'panel-title' }, 'Level ' + r[0] + ': ' + r[1]));
      var dl = h('dl', { class: 'kv' },
        h('dt', null, 'Analogy in the paper'), h('dd', null, r[2]),
        h('dt', null, 'What you control'), h('dd', null, r[3]));
      if (r[4]) { dl.appendChild(h('dt', null, 'If the level is absent')); dl.appendChild(h('dd', null, r[4])); }
      detail.appendChild(dl);
      if (r[0] === 6) detail.appendChild(h('p', { class: 'small' }, 'This course is about this level. Before you add a graph, make one loop stable.'));
      if (r[0] === 7) detail.appendChild(h('p', { class: 'small' }, 'The paper gives Ontology Engineering as the future direction for system intelligence.'));
    }
    el.appendChild(h('div', { class: 'split even' }, steps, detail));
    pick(rows[5]);
  };

  GE.labs.sources = function (el) {
    var table = h('tbody');
    GE.data.reference.sources.forEach(function (s, i) {
      table.appendChild(h('tr', { id: s[4] ? 'ref-' + s[4] : null, tabindex: '-1' }, h('td', { class: 'num' }, String(i + 1)),
        h('td', null, h('a', { href: s[1], rel: 'noopener noreferrer', target: '_blank' }, s[0]), h('br'), h('span', { class: 'small muted' }, s[2])),
        h('td', null, s[3])));
    });
    el.appendChild(h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, 'Source'), h('th', null, 'What it gives'))), table)));
    el.appendChild(h('p', { class: 'small muted' }, 'Each link opens a page on the internet in a new tab. The course itself does not use the network.'));
  };
})(window.GE);

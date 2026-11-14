/* studio.js: the instruments of the Practical Architecture Studio (part S).
   Added by this edition. It is not from the GE notes.

   studioLevels    the strip of the levels; it shows the level of the section on the screen
   studioDiagram   a drawing where each component and each connection can be selected
   studioRun       replays a recording of the real application on its execution graph
   studioExplorer  the source files of the reference application, by level
   studioCheck     one question with a cause for each answer

   The drawings are in js/data/studio.js. The text of each component is in the tables of index.html:
   the instrument reads the table that is in its mount, thus the page with no JavaScript shows the same text.
   No instrument here is a simulation. studioRun plays what the tests of the application recorded. */
(function (GE) {
  'use strict';
  var h = GE.h;
  var S = GE.data.studio;
  var explorer = null; // the one explorer of the page; a file link opens a file in it
  var TOP = S.levels.length; // the highest level of the reference application

  function levelTag(level, word) {
    if (level === 9) return h('span', { class: 'st-lv st-lv-0' }, 'In the ontology, not built');
    return h('span', { class: 'st-lv st-lv-' + level }, (word || 'Level') + ' ' + level);
  }
  function fileName(path) { return path.slice(path.lastIndexOf('/') + 1); }

  /** A link to a source file. With JavaScript it opens the file in the explorer of the page. */
  function fileLink(path) {
    return h('a', { class: 'st-file', href: S.repo + path, 'data-st-file': path }, fileName(path));
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[data-st-file]');
    if (!a || !explorer || ev.metaKey || ev.ctrlKey) return;
    if (!explorer.has(a.dataset.stFile)) return; // not in the data: the link goes to the repository
    ev.preventDefault();
    explorer.open(a.dataset.stFile);
  });

  /* ---------- the strip of the levels ---------- */
  GE.labs.studioLevels = function (el) {
    var chapter = el.closest('.chapter');
    var items = [].slice.call(el.querySelectorAll('li'));
    var marks = [].slice.call(chapter.querySelectorAll('[data-st-level]'));
    var ticking = false;
    function paint() {
      ticking = false;
      if (!chapter.classList.contains('is-current')) return;
      var level = 0, line = window.innerHeight * 0.35;
      marks.forEach(function (m) { if (m.getBoundingClientRect().top < line) level = Number(m.dataset.stLevel); });
      items.forEach(function (li, i) {
        var n = i + 1;
        li.classList.toggle('is-now', n === level);
        li.classList.toggle('is-done', level > 0 && n < level);
        if (n === level) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  };

  /* ---------- a drawing with components and connections that can be selected ---------- */
  function readRows(el, attr) {
    var out = {};
    [].forEach.call(el.querySelectorAll('tr[' + attr + ']'), function (tr) {
      var heads = [].map.call(tr.closest('table').querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      out[tr.getAttribute(attr)] = [].map.call(tr.children, function (cell, i) { return [heads[i], cell]; }).slice(1);
    });
    return out;
  }

  function applyLens(view, def, level) {
    def.nodes.forEach(function (node) { view.mark(node.id, 'st-later', node.level !== 9 && node.level > level); view.mark(node.id, 'st-ghost', node.level === 9); });
    def.edges.forEach(function (edge) { view.markEdge(GE.edgeKey(edge), 'st-later', edge.level !== 9 && edge.level > level); view.markEdge(GE.edgeKey(edge), 'st-ghost', edge.level === 9); });
  }

  /** Makes each arrow of a view a button (the pattern of the instrument "Watch one run"). */
  function edgeButtons(view, def, names, onEdge, described) {
    var groups = def.edges.map(function (edge) { return view.edge(GE.edgeKey(edge)); });
    var anyDescribed = def.edges.some(function (edge) { return described[GE.edgeKey(edge)]; });
    def.edges.forEach(function (edge, i) {
      var key = GE.edgeKey(edge), g = groups[i], path = g.querySelector('path');
      g.insertBefore(GE.s('path', { class: 'st-hit', d: path.getAttribute('d') }), path);
      g.setAttribute('role', 'button'); g.setAttribute('aria-pressed', 'false');
      // An arrow that the table describes is a stop for the Tab key. Each arrow can have the focus:
      // the arrow keys go from one arrow to the next, thus the Tab order stays short.
      g.setAttribute('tabindex', described[key] || (!anyDescribed && i === 0) ? '0' : '-1');
      g.setAttribute('aria-label', 'Connection from ' + names[edge.from] + ' to ' + names[edge.to] + (edge.label ? ': ' + edge.label : ''));
      g.addEventListener('click', function () { onEdge(key, edge); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onEdge(key, edge); return; }
        var move = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
        if (!move) return;
        ev.preventDefault();
        groups[(i + move + groups.length) % groups.length].focus();
      });
    });
  }

  GE.labs.studioDiagram = function (el, chapter) {
    var key = el.dataset.diagram, def = S.drawings[key];
    var nodeRows = readRows(el, 'data-node'), edgeRows = readRows(el, 'data-edge');
    var names = {};
    def.nodes.forEach(function (node) { names[node.id] = String(node.label).replace(/\n/g, ', '); });
    var word = def.lens === 'Stage' ? 'Stage' : 'Level';
    var built = def.nodes.map(function (node) { return node.level; }).filter(function (l) { return l !== 9; });
    var top = Math.max.apply(null, built), low = Math.min.apply(null, built);
    var level = Math.max(low, Math.min(top, Number(el.dataset.level || top)));
    var seen = {}, selected = null;

    var tables = [].slice.call(el.children);
    var host = h('div', { class: 'st-stage' });
    var view = GE.graphView(host, def, { interactive: true, minScale: 0.7, onNode: function (id) { select('node', id); } });
    view.svg.classList.add('st');
    edgeButtons(view, def, names, function (k) { select('edge', k); }, edgeRows);
    def.nodes.forEach(function (node) { view.node(node.id).setAttribute('aria-pressed', 'false'); });

    var panel = h('div', { class: 'panel st-panel', 'aria-live': 'polite' });
    var options = [];
    for (var i = low; i <= top; i++) options.push({ value: String(i), label: def.stages ? def.stages[i - 1] : word + ' ' + i });
    // After a change of the lens, the panel of a selected item is painted again: its tag depends on the level.
    var lens = top > low ? GE.segmented(word + ' shown in the drawing', options, String(level), function (v) { level = Number(v); applyLens(view, def, level); if (selected) paintPanel(); else hint(); }) : null;

    function hint() {
      if (selected) return;
      GE.clear(panel);
      panel.appendChild(h('p', { class: 'panel-title' }, def.title));
      panel.appendChild(h('p', { class: 'small' }, 'Select a box or an arrow. The panel then shows its responsibility, its data contract and its source file. With the keyboard: the Tab key goes to the boxes and the main arrows; the arrow keys go from one arrow to the next.'));
      if (lens) panel.appendChild(h('p', { class: 'small muted' }, def.stages ? 'The drawing shows stage ' + level + '. A faint part belongs to a later stage.' : 'The drawing shows the application at level ' + level + '. A faint part does not exist yet at this level.'));
    }

    function select(kind, id) {
      [].forEach.call(view.svg.querySelectorAll('.st-selected'), function (x) { x.classList.remove('st-selected'); x.setAttribute('aria-pressed', 'false'); });
      selected = { kind: kind, id: id };
      var chosen = kind === 'node' ? view.node(id) : view.edge(id);
      chosen.classList.add('st-selected'); chosen.setAttribute('aria-pressed', 'true');
      paintPanel();
      seen[kind + ':' + id] = true;
      if (Object.keys(seen).length >= 3) GE.trace.lab('studioDiagram:' + key, chapter);
      if (window.matchMedia('(max-width: 78rem)').matches) panel.scrollIntoView({ block: 'nearest', behavior: GE.reduced() ? 'auto' : 'smooth' });
    }

    /** The panel of the selected item, for the level that the lens shows now. */
    function paintPanel() {
      var kind = selected.kind, id = selected.id;
      var rows = (kind === 'node' ? nodeRows : edgeRows)[id] || [];
      var item = kind === 'node' ? def.nodes.filter(function (x) { return x.id === id; })[0] : def.edges.filter(function (x) { return GE.edgeKey(x) === id; })[0];
      GE.clear(panel);
      panel.appendChild(h('p', { class: 'st-kind' }, kind === 'node' ? 'Component' : 'Connection'));
      panel.appendChild(h('p', { class: 'panel-title' }, kind === 'node' ? names[id] : names[item.from] + ' → ' + names[item.to]));
      panel.appendChild(h('p', { class: 'ptags' }, levelTag(item.level, word), item.level !== 9 && item.level > level ? h('span', { class: 'st-lv st-lv-0' }, 'Not in the drawing at ' + word.toLowerCase() + ' ' + level) : null));
      if (!rows.length) panel.appendChild(h('p', { class: 'small' }, kind === 'edge' && item.label ? 'This connection carries: ' + item.label + '.' : 'The table below has no line for this item.'));
      var dl = h('dl', { class: 'st-dl' });
      rows.forEach(function (row) {
        if (!row[1].textContent.trim()) return;
        var dd = h('dd');
        [].forEach.call(row[1].childNodes, function (child) { dd.appendChild(child.cloneNode(true)); });
        dl.appendChild(h('dt', null, row[0])); dl.appendChild(dd);
      });
      panel.appendChild(dl);
    }

    var drawer = h('details', { class: 'drawer st-table-drawer' }, h('summary', null, 'The same content as a table ', h('span', { class: 'tag' }, 'each component and each connection')), h('div', { class: 'drawer-body' }, tables));
    el.appendChild(h('div', { class: 'st-diagram' }, h('div', { class: 'st-main' }, lens ? h('div', { class: 'controls' }, lens.el) : null, host, GE.legend ? GE.legend(['code', 'model', 'person']) : null), panel));
    el.appendChild(drawer);
    applyLens(view, def, level);
    hint();
  };

  /* ---------- the replay of a recorded run ---------- */
  function short(value) {
    var text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text === undefined) text = 'null';
    return text.length > 96 ? text.slice(0, 93) + '…' : text;
  }

  GE.labs.studioRun = function (el, chapter) {
    var R = GE.data.studioRuns, conf = S.replays[el.dataset.replay];
    if (!R) { el.appendChild(h('p', { class: 'small' }, 'The recordings are not loaded (js/data/studio-runs.js).')); return; }
    var def = S.drawings[conf.drawing];
    var byId = {};
    R.scenarios.forEach(function (sc) { byId[sc.id] = sc; });
    var list = conf.scenarios.map(function (id) { return byId[id]; }).filter(Boolean);
    var scenario = list[0], player = null, prediction = null, locked = null, state = {}, owners = {};

    var pick = h('select', { class: 'st-select', 'aria-label': 'The scenario', onchange: function () { scenario = byId[pick.value]; reset(); } },
      list.map(function (sc) { return h('option', { value: sc.id }, sc.title); }));
    var playBtn = h('button', { type: 'button', class: 'btn', onclick: function () { start(true); } }, 'Play the recording');
    var stepBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { start(false); } }, 'One step');
    var resetBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: reset }, 'Start again');
    var seg = conf.options ? GE.segmented('Your prediction', conf.options, null, function (v) { prediction = v; playBtn.disabled = false; stepBtn.disabled = false; }) : null;
    var stage = h('div', { class: 'st-stage' });
    var view = GE.graphView(stage, def, { minScale: 0.7 });
    view.svg.classList.add('st');
    var setup = h('div', { class: 'st-setup' });
    var log = h('ol', { class: 'log st-log', 'aria-live': 'polite' });
    var table = h('div', { class: 'table-wrap' });
    var out = h('div', { class: 'st-out', 'aria-live': 'polite' });

    function steps() {
      // An import has two requests. The page plays the first run, then the second.
      var first = conf.manySteps && scenario.first ? scenario.first.run.steps : [];
      return first.concat(scenario.run.steps);
    }
    function graphOf() { return R.graphs[scenario.run.graph]; }

    function paintState(changed) {
      GE.clear(table);
      var rows = Object.keys(state).filter(function (f) { return owners[f]; }).map(function (field) {
        return h('tr', { class: changed && changed.indexOf(field) > -1 ? 'st-changed' : null }, h('td', { class: 'mono' }, field), h('td', { class: 'mono st-value' }, short(state[field])), h('td', { class: 'mono' }, owners[field]));
      });
      table.appendChild(h('table', { class: 'st-state' }, h('caption', null, 'The state of the run. A highlighted line was written by the last node.'),
        h('thead', null, h('tr', null, h('th', null, 'Field'), h('th', null, 'Value'), h('th', null, 'Owner'))), h('tbody', null, rows)));
    }

    function reset() {
      if (player) player.stop();
      player = null; prediction = null; locked = null;
      view.reset();
      applyLens(view, def, scenario.level > 2 || conf.drawing !== 'record' ? TOP : 2);
      GE.clear(log); GE.clear(out); GE.clear(setup);
      var g = graphOf();
      owners = {}; state = Object.assign({}, g.initial_state);
      g.input.forEach(function (f) { owners[f] = 'input'; });
      g.nodes.forEach(function (node) { node.owns.forEach(function (f) { owners[f] = node.id; }); });
      if (conf.manySteps) state = {};
      else { state.run_id = scenario.run.id; state.request = scenario.request; }
      var world = scenario.world || {};
      var notes = [];
      if (world.fault && world.fault !== 'none') notes.push('The scenario puts a defect into the store: ' + world.fault.replace(/_/g, ' ') + '.');
      if (scenario.before) notes.push(scenario.before + ' request(s) went in before this one.');
      if (world.ai === 'off') notes.push('The AI is off.');
      else if (world.ai) notes.push('The model is a stand-in that is told to: ' + world.ai.replace(/_/g, ' ') + '.');
      if (world.remembered) notes.push('The memory already knows: ' + world.remembered.map(function (m) { return m[0] + ' is ' + m[1]; }).join('; ') + '.');
      setup.appendChild(h('p', { class: 'small' }, h('strong', null, 'The request: '), h('code', null, 'POST ' + scenario.endpoint)));
      if (scenario.prepared) notes.unshift(scenario.prepared);
      var shown = scenario.request;
      if (conf.manySteps && shown && typeof shown.csv === 'string') { var csvLines = shown.csv.split('\n').filter(Boolean); shown = Object.assign({}, shown, { csv: csvLines.slice(0, 3).join('\n') + '\n… ' + csvLines.length + ' lines' }); }
      setup.appendChild(h('pre', { class: 'st-json', tabindex: '0' }, h('code', null, JSON.stringify(shown, null, 1))));
      if (notes.length) setup.appendChild(h('p', { class: 'small' }, notes.join(' ')));
      paintState(null);
      if (seg) { lock(false); seg.set(null, true); playBtn.disabled = true; stepBtn.disabled = true; } else { playBtn.disabled = false; stepBtn.disabled = false; }
    }
    function lock(on) { [].forEach.call(seg.el.children, function (b) { b.disabled = on; }); }

    function start(play) {
      if (!player) {
        // The prediction is fixed at the first step. "Start again" or a new scenario frees it.
        if (seg) { locked = prediction; lock(true); }
        var all = steps();
        var secondAt = conf.manySteps && scenario.first ? scenario.first.run.steps.length : -1;
        var second = scenario.exchanges && scenario.exchanges[1] ? scenario.exchanges[1].path : '';
        player = GE.player(view, all, {
          speed: 420,
          onStep: function (step, i) {
            if (i === secondAt) log.appendChild(h('li', { class: 'st-break' }, (/\/mapping$/.test(second) ? 'The run stored its state and stopped. The person gives a mapping.' : 'The run stored its state and stopped. The person reads the proposal and decides.') + ' The second request (POST ' + second + ') starts the graph again at the checkpoint.'));
            Object.assign(state, step.writes);
            paintState(Object.keys(step.writes));
            log.appendChild(h('li', { class: step.result === 'FAIL' ? 'is-fail' : null }, h('span', { class: 'mono' }, step.node), ' ', GE.stamp(step.result), ' ', step.note));
            log.lastChild.scrollIntoView({ block: 'nearest' });
          },
          onDone: finish
        });
      }
      if (play) player.play(); else player.step();
    }

    function finish() {
      var body = scenario.http.body, right = conf.answer ? conf.answer(scenario) : null;
      GE.clear(out);
      out.appendChild(h('p', null, h('strong', null, 'The HTTP answer: '), h('span', { class: 'mono' }, String(scenario.http.status)), ' ', body.error ? body.error.code : scenario.run.result));
      if (body.error && body.error.problems.length) out.appendChild(h('ul', { class: 'small' }, body.error.problems.map(function (p) { return h('li', null, h('strong', null, p.rule), ' ', p.text); })));
      if (body.budget && body.budget.state) out.appendChild(h('p', { class: 'small' }, 'Budget after: ' + body.budget.state + ', ' + body.budget.spent_cents + ' cents spent' + (body.budget.limit_cents ? ' of ' + body.budget.limit_cents : '') + '.'));
      if (body.reason) out.appendChild(h('p', { class: 'small' }, 'Reason: ', h('span', { class: 'mono' }, body.reason), body.suggestion ? '. Suggestion: ' + body.suggestion.category_name + ', from the ' + body.suggestion.source + '.' : '. No suggestion.'));
      if (body.counts) out.appendChild(h('p', { class: 'small' }, 'The end of each line: ' + Object.keys(body.counts).map(function (k) { return k + ' ' + body.counts[k]; }).join(', ') + '. Reconciliation: ' + (body.reconciliation.ok ? 'PASS' : 'FAIL') + '. WAITING: a line with no decision, or a line that the pipeline holds.'));
      if (body.step === 'review') out.appendChild(h('p', { class: 'small' }, 'The mapping passed its check. The run now waits for the person with ' + (body.rows_total || body.lines.length) + ' lines: ' + Object.keys(body.summary).filter(function (k) { return body.summary[k]; }).map(function (k) { return body.summary[k] + ' ' + k; }).join(', ') + '. Nothing is recorded yet.'));
      if (body.notes && body.notes.length) out.appendChild(h('ul', { class: 'small' }, body.notes.map(function (t) { return h('li', null, t); })));
      // The ledger is the expense store and the income store together. An older recording has only the expenses.
      var ledger = typeof scenario.income_rows_after === 'number' ? 'Rows in the ledger after the run: ' + scenario.rows_after + ' expenses and ' + scenario.income_rows_after + ' income.' : 'Expense rows in the ledger after the run: ' + scenario.rows_after + '.';
      out.appendChild(h('p', { class: 'small' }, ledger + ' Model calls in this request: ' + scenario.model_calls + '. Rows added to the memory: ' + scenario.memory_rows_added + '.'));
      if (right) {
        var label = function (v) { var o = conf.options.filter(function (x) { return x.value === v; })[0]; return o ? o.label : String(v); };
        out.appendChild(h('p', null, 'Your prediction: ', h('strong', null, label(locked)), '. ', GE.stamp(locked === right ? 'PASS' : 'FAIL'), locked === right ? '' : ' The run did this: ' + label(right) + '. Read the steps above to find the node that decided.'));
      }
      GE.trace.lab('studioRun:' + el.dataset.replay, chapter);
    }

    el.appendChild(h('div', { class: 'st-run' },
      h('div', { class: 'controls' }, h('label', { class: 'st-pick' }, h('span', null, 'Scenario'), pick)),
      setup,
      seg ? h('div', { class: 'st-predict' }, h('p', { class: 'small' }, h('strong', null, 'Predict first. '), conf.ask), seg.el) : null,
      h('div', { class: 'controls' }, playBtn, stepBtn, resetBtn),
      stage,
      h('div', { class: 'split even' }, h('div', { class: 'panel' }, h('p', { class: 'panel-title' }, 'The steps'), log, out), h('div', { class: 'panel' }, table)),
      h('p', { class: 'small' }, h('span', { class: 'prov source' }, 'A recording of the real code, not a simulation.'), ' The tests of the application made it: ', h('span', { class: 'mono' }, 'npm run record-runs'), '. Where a scenario has a model, the model is a stand-in; no recording used the network.')));
    reset();
  };

  /* ---------- the source explorer ---------- */
  GE.labs.studioExplorer = function (el) {
    var F = GE.data.studioFiles;
    if (!F) return;
    var fallback = [].slice.call(el.children);
    var level = TOP, showTests = false, current = 'shared/planning/plan.ts';
    var isTest = function (p) { return /\.test\.ts$/.test(p) || p.indexOf('tests/') === 0; };
    var listEl = h('nav', { class: 'st-files', 'aria-label': 'The files of the reference application' });
    var viewer = h('div', { class: 'st-viewer' });
    var seg = GE.segmented('Level', S.levels.map(function (l) { return { value: String(l.n), label: 'Level ' + l.n }; }), String(TOP), function (v) { level = Number(v); paintList(); });
    var tests = h('input', { type: 'checkbox', id: 'st-tests', onchange: function () { showTests = tests.checked; paintList(); } });

    function paintList() {
      GE.clear(listEl);
      var groups = {};
      Object.keys(F.files).sort().forEach(function (path) {
        var f = F.files[path];
        if (f.level > level || (!showTests && isTest(path))) return;
        var dir = path.slice(0, path.lastIndexOf('/'));
        (groups[dir] = groups[dir] || []).push(path);
      });
      var count = 0;
      Object.keys(groups).forEach(function (dir) {
        listEl.appendChild(h('p', { class: 'st-dir mono' }, dir + '/'));
        listEl.appendChild(h('ul', null, groups[dir].map(function (path) {
          var f = F.files[path]; count++;
          var mark = f.level === level ? h('span', { class: 'st-mark st-new' }, 'new') : f.modified.indexOf(level) > -1 ? h('span', { class: 'st-mark st-mod' }, 'changed') : null;
          return h('li', null, h('button', { type: 'button', class: 'st-filebtn', 'data-path': path, 'aria-pressed': String(path === current), onclick: function () { show(path, false); } }, h('span', { class: 'mono' }, fileName(path)), mark));
        })));
      });
      listEl.insertBefore(h('p', { class: 'small muted' }, count + ' files at level ' + level + '. "new" and "changed" are for this level.'), listEl.firstChild);
    }

    function show(path, scroll) {
      var f = F.files[path];
      if (!f) return;
      current = path;
      // The list is not built again: the button that the person used keeps the focus.
      [].forEach.call(listEl.querySelectorAll('.st-filebtn'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.path === path)); });
      GE.clear(viewer);
      var later = f.modified.filter(function (m) { return m > f.level; });
      viewer.appendChild(h('div', { class: 'pcode-bar' }, h('span', { class: 'pcode-name mono' }, path), h('a', { class: 'small', href: S.repo + path, target: '_blank', rel: 'noopener' }, 'Open in the repository')));
      viewer.appendChild(h('p', { class: 'ptags' }, levelTag(f.level), later.map(function (m) { return h('span', { class: 'st-lv st-lv-' + m }, 'changed at level ' + m); })));
      viewer.appendChild(h('p', { class: 'small' }, f.role));
      if (later.length) viewer.appendChild(h('p', { class: 'small muted' }, 'The page shows the file as it is now, with the changes of the later level.'));
      viewer.appendChild(h('pre', { tabindex: '0', 'aria-label': 'The text of ' + path }, h('code', null, f.text)));
      if (scroll) el.scrollIntoView({ block: 'start', behavior: GE.reduced() ? 'auto' : 'smooth' });
    }

    explorer = {
      has: function (path) { return !!F.files[path]; },
      open: function (path) {
        level = TOP; seg.set(String(TOP), true);
        if (isTest(path)) { showTests = true; tests.checked = true; }
        // The explorer is in this part. Go to its section, then show the file.
        if (location.hash !== '#ps-explorer') location.hash = '#ps-explorer';
        current = path;
        paintList(); // the level or the tests can have changed
        show(path, true);
      }
    };

    el.appendChild(h('div', { class: 'st-explorer' },
      h('div', { class: 'controls' }, seg.el, h('label', { class: 'st-check', for: 'st-tests' }, tests, ' Show the tests')),
      h('div', { class: 'st-explorer-body' }, listEl, viewer)));
    el.appendChild(h('details', { class: 'drawer' }, h('summary', null, 'The list of the files ', h('span', { class: 'tag' }, 'as text')), h('div', { class: 'drawer-body' }, fallback)));
    paintList();
    show(current, false);
  };

  /* ---------- one question with a cause for each answer ---------- */
  GE.labs.studioCheck = function (el, chapter) {
    var key = el.dataset.check, check = S.checks[key];
    if (!check) return;
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    var group = h('div', { class: 'chips why-options', role: 'group', 'aria-label': check.q });
    GE.rng(key.length * 31 + 7).shuffle(check.options.slice()).forEach(function (o) {
      var b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: function () {
        [].forEach.call(group.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        GE.clear(out);
        out.appendChild(GE.stamp(o.correct ? 'PASS' : 'FAIL'));
        out.appendChild(document.createTextNode(' ' + o.why));
        GE.trace.lab('studioCheck:' + key, chapter);
      } }, o.text);
      group.appendChild(b);
    });
    el.appendChild(h('div', { class: 'why-check st-check-q' }, h('p', null, h('strong', null, 'Predict. '), check.q), group, out));
  };
})(window.GE);

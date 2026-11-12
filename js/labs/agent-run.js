/* agent-run.js: "Watch one run" (part 2). Plays an invented agent run as a living graph.
   Reuses GE.graphView (hand-placed SVG, arrows, the token) and the four role styles.
   - Nodes appear when the run first reaches them. The edge draws in the direction of the run,
     the token travels on it, then its label appears.
   - Controls: play/pause, back, next, replay, speed, a scrubber. Select a node or an arrow to inspect it.
   - Reduced motion: no drawing and no token; each step changes at once. The full map is on by default.
   - The trace as a log (a list) is the same content with no animation. */
(function (GE) {
  'use strict';
  var h = GE.h;

  GE.labs.agentRun = function (el, chapter) {
    var D = GE.data.agentRun;
    var steps = D.steps, last = steps.length - 1;
    var names = {};
    D.graph.nodes.forEach(function (n) { names[n.id] = String(n.label).split('\n').join(' '); });
    var reduced = GE.reduced();

    var i = -1, playing = false, busy = false, run = 0, speed = 1, furthest = -1, loops = 0;
    // The prediction: the run stops before the first check and asks the reader.
    var predictAt = -1, guess = null;
    steps.some(function (st, k) { if (st.status) { predictAt = k; return true; } return false; });

    /* ---- Parts of the instrument ---- */
    var stage = h('div', { class: 'ar-stage' });
    var view = GE.graphView(stage, D.graph, {
      interactive: true, minScale: 0.62,
      onNode: function (id) { inspectNode(id); }
    });
    view.svg.classList.add('ar');

    // Arrows can be selected too. A wide clear path makes them easy to hit.
    D.graph.edges.forEach(function (e) {
      var key = GE.edgeKey(e), g = view.edge(key), path = g.querySelector('path');
      var hit = GE.s('path', { class: 'ar-hit', d: path.getAttribute('d') });
      g.insertBefore(hit, path);
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', 'Arrow from ' + names[e.from] + ' to ' + names[e.to] + (e.label ? ': ' + e.label : ''));
      g.addEventListener('click', function () { inspectEdge(key); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); inspectEdge(key); } });
    });

    var playBtn = h('button', { type: 'button', class: 'btn small ar-play', onclick: function () { playing ? pause() : play(); } }, 'Play');
    var backBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { pause(); go(i - 1); } }, 'Back');
    var nextBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { pause(); if (!busy) advance(); } }, 'Next');
    var replayBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { pause(); guess = null; go(-1); play(); } }, 'Replay');
    var speedSeg = GE.segmented('Speed', [{ value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }], '1', function (v) { speed = Number(v); });
    var scrub = h('input', { type: 'range', class: 'ar-scrub', min: '0', max: String(steps.length), value: '0', 'aria-label': 'Step of the run' });
    scrub.addEventListener('input', function () { pause(); go(Number(scrub.value) - 1); });
    var count = h('span', { class: 'mono small ar-count', 'aria-hidden': 'true' });
    var mapToggle = h('input', { type: 'checkbox', id: 'ar-map' });
    mapToggle.checked = reduced;
    mapToggle.addEventListener('change', function () { view.svg.classList.toggle('ar-map', mapToggle.checked); });
    view.svg.classList.toggle('ar-map', mapToggle.checked);

    var evName = h('span', { class: 'ar-event mono' });
    var evData = h('code', { class: 'ar-data' });
    var evText = h('p', { class: 'ar-text' });
    var idea = h('div', { class: 'ar-idea', hidden: true });
    var caption = h('div', { class: 'ar-caption', 'aria-live': 'polite' }, h('p', { class: 'ar-head' }, evName, evData), evText, idea);
    var verdict = h('p', { class: 'ar-verdict', hidden: true });
    caption.appendChild(verdict);
    var resume = false;
    function answer(v) {
      guess = v; ask.hidden = true;
      if (resume) play(); else advance();
    }
    var ask = h('div', { class: 'ar-ask', hidden: true, role: 'group', 'aria-label': 'Your prediction' },
      h('p', null, h('strong', null, 'Predict: '), 'the model has a likely cause and a patch. Will the first patch pass the tests?'),
      h('div', { class: 'ar-buttons' },
        h('button', { type: 'button', class: 'btn small', onclick: function () { answer('pass'); } }, 'It will pass'),
        h('button', { type: 'button', class: 'btn small', onclick: function () { answer('fail'); } }, 'It will fail')));
    caption.appendChild(ask);

    // The state: the one object that the nodes read and write. It changes as the run goes.
    var stateDl = h('dl', { class: 'ar-dl ar-state-dl' });
    var statePanel = h('div', { class: 'ar-state' }, h('h4', null, 'State of the run'), stateDl);
    function paintState() {
      var tools = 0, attempts = 0, verdictV = '—', approval = '—', ctx = '—';
      for (var j = 0; j <= i; j++) {
        var st = steps[j];
        if (st.node === 'RT') tools++;
        if (st.node === 'ED') attempts++;
        if (st.node === 'KG') ctx = 'rule LV-2, LeaveCalculator';
        if (st.status) verdictV = st.status === 'pass' ? 'PASS' : 'FAIL';
        if (st.node === 'AP') approval = 'approved';
      }
      GE.clear(stateDl);
      [['context', ctx], ['tool calls', tools + ' (limit 6)'], ['attempts', attempts + ' of 3'],
       ['verdict', verdictV], ['approval', approval]].forEach(function (r) {
        stateDl.appendChild(h('dt', null, r[0])); stateDl.appendChild(h('dd', { class: 'mono' }, r[1]));
      });
    }

    var inspector = h('div', { class: 'ar-inspect', 'aria-live': 'polite' },
      h('p', { class: 'small muted' }, 'Select a node or an arrow to see what it does.'));

    var log = h('ol', { class: 'ar-log' });
    var rows = steps.map(function (st, k) {
      var li = h('li', null, h('button', { type: 'button', class: 'ar-log-btn', onclick: function () { pause(); go(k); } },
        h('span', { class: 'mono ar-log-ev' }, st.event), ' ',
        h('span', null, (st.edge ? names[st.edge.split('>')[0]] + ' → ' : '') + names[st.node]), ' ',
        h('code', { class: 'small' }, st.data)));
      log.appendChild(li); return li;
    });

    /* ---- State ---- */
    // Show step k at once, with no animation. Used by Back, the scrubber, the log and reduced motion.
    function render(k) {
      run++;
      var seenN = {}, seenE = {}, lastSeen = {};
      for (var j = 0; j <= k; j++) { seenN[steps[j].node] = true; lastSeen[steps[j].node] = j; if (steps[j].edge) seenE[steps[j].edge] = true; }
      view.reset();
      if (token) { token.classList.remove('ar-on'); token.setAttribute('visibility', 'hidden'); }
      view.nodeIds().forEach(function (id) {
        var g = view.node(id);
        g.classList.toggle('ar-seen', !!seenN[id]);
        g.classList.remove('ar-pass', 'ar-fail');
        if (seenN[id]) view.mark(id, 'done');
        setReach(g, !!seenN[id]);
      });
      view.edgeKeys().forEach(function (key) {
        var g = view.edge(key);
        clearDraw(g);
        g.classList.toggle('ar-seen', !!seenE[key]);
        g.classList.toggle('ar-labelled', !!seenE[key]);
        g.classList.remove('ar-current');
        if (seenE[key]) view.markEdge(key, 'used');
        setReach(g, !!seenE[key]);
      });
      if (k >= 0) setCurrent(k);
      i = k;
      paint();
    }
    function setReach(g, on) { g.setAttribute('tabindex', on || mapToggle.checked ? '0' : '-1'); g.setAttribute('aria-hidden', String(!(on || mapToggle.checked))); }
    function clearDraw(g) { var p = g.querySelector('path:not(.ar-hit)'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }
    function setCurrent(k) {
      var st = steps[k];
      view.nodeIds().forEach(function (id) { view.mark(id, 'active', false); });
      view.edgeKeys().forEach(function (key) { view.edge(key).classList.remove('ar-current'); });
      view.mark(st.node, 'done', false);
      view.mark(st.node, 'active', true);
      var g = view.node(st.node);
      g.classList.toggle('ar-fail', st.status === 'fail');
      g.classList.toggle('ar-pass', st.status === 'pass');
      if (st.edge) view.edge(st.edge).classList.add('ar-current');
      view.describe(st.node, 'current step: ' + st.event);
    }
    var shownStep = null;
    function paint() {
      var st = steps[i];
      // Fade the caption in when its step changes (not when only a button label changes).
      if (shownStep !== i) { shownStep = i; caption.classList.remove('ar-swap'); void caption.offsetWidth; caption.classList.add('ar-swap'); }
      if (i < 0) {
        evName.textContent = 'Ready';
        evData.textContent = D.request;
        evText.textContent = 'Press Play to watch the run, or Next to go one step at a time. You can stop at any step.';
        idea.hidden = true;
      } else {
        evName.textContent = st.event;
        evData.textContent = st.data;
        evText.textContent = st.text;
        idea.hidden = !st.idea;
        if (st.idea) { GE.clear(idea); idea.appendChild(h('strong', null, i >= furthest ? 'New idea: ' : 'Idea: ')); idea.appendChild(document.createTextNode(st.idea)); }
        furthest = Math.max(furthest, i);
      }
      scrub.value = String(i + 1);
      scrub.setAttribute('aria-valuetext', i < 0 ? 'Not started' : 'Step ' + (i + 1) + ' of ' + steps.length + ': ' + st.event + ', ' + names[st.node]);
      count.textContent = (i + 1) + ' / ' + steps.length;
      rows.forEach(function (r, k) { if (k === i) r.setAttribute('aria-current', 'step'); else r.removeAttribute('aria-current'); r.classList.toggle('ar-past', k < i); });
      backBtn.disabled = i < 0;
      nextBtn.disabled = i >= last;
      playBtn.textContent = playing ? 'Pause' : (i >= last ? 'Play again' : 'Play');
      playBtn.setAttribute('aria-label', playing ? 'Pause the run' : 'Play the run');
      verdict.hidden = !(i === predictAt && guess);
      if (i === predictAt && guess) verdict.textContent = guess === 'fail'
        ? 'You predicted FAIL. Correct: the likely cause was only a hypothesis.'
        : 'You predicted PASS. The tests disagree. A plausible patch is not a correct patch; this is why the check is code.';
      if (i !== predictAt - 1) ask.hidden = true;
      paintState();
      if (i === last) GE.trace.lab('agentRun', chapter);
    }

    /* ---- Animation of one step forward ---- */
    function advance() {
      if (i >= last) return Promise.resolve();
      var k = i + 1, st = steps[k], mine = ++run;
      if (k === predictAt && guess === null) {
        resume = playing; playing = false; paint();
        ask.hidden = false;
        var b = ask.querySelector('button'); if (b) b.focus({ preventScroll: true });
        return Promise.resolve();
      }
      if (reduced) { render(k); return Promise.resolve(); }
      busy = true;
      view.nodeIds().forEach(function (id) { if (view.node(id).classList.contains('active')) { view.mark(id, 'active', false); view.mark(id, 'done'); } });
      // One continuous motion: the line grows, the token rides at its tip, the label fades in on the way,
      // and the next node starts to appear just before the token arrives. No separate beats.
      var n = view.node(st.node), arrived = false;
      function arrive() {
        if (arrived || mine !== run) return; arrived = true;
        if (!n.classList.contains('ar-seen')) { n.classList.add('ar-enter'); n.classList.add('ar-seen'); }
        setReach(n, true);
        setCurrent(k);
        i = k;
        paint();
      }
      var drawn = Promise.resolve();
      if (st.edge) {
        var g = view.edge(st.edge), p = g.querySelector('path:not(.ar-hit)'), len = p.getTotalLength();
        // Near-constant speed along the line, so long and short arrows feel the same.
        var ms = Math.round(Math.max(520, Math.min(1400, 380 + len * 2.6)) / speed);
        g.classList.add('ar-seen'); setReach(g, true);
        view.edgeKeys().forEach(function (key) { view.edge(key).classList.remove('ar-current'); });
        g.classList.add('ar-current');
        p.removeAttribute('marker-end');
        p.style.strokeDasharray = len + ' ' + len;
        p.style.strokeDashoffset = String(len);
        token.setAttribute('visibility', 'visible');
        token.classList.add('ar-on');
        drawn = GE.motion.tween({ ms: ms, ease: 'move', update: function (t) {
          if (mine !== run) return;
          p.style.strokeDashoffset = String(len * (1 - t));
          var pt = p.getPointAtLength(len * t);
          token.setAttribute('cx', pt.x); token.setAttribute('cy', pt.y);
          if (t > 0.45) g.classList.add('ar-labelled');
          if (t > 0.82) arrive();
        } }).then(function () {
          token.classList.remove('ar-on');
          if (mine !== run) return;
          clearDraw(g);
          view.markEdge(st.edge, 'used');
          g.classList.add('ar-labelled');
        });
      }
      return drawn.then(function () {
        arrive();
        busy = false;
        follow(n);
        return GE.wait(420 / speed);
      }).then(function () { busy = false; n.classList.remove('ar-enter'); });
    }
    // The token: a single dot that rides the tip of the line. It fades, not blinks.
    var token = GE.s('circle', { class: 'ar-token', r: 4.5, visibility: 'hidden' });
    view.svg.appendChild(token);
    // While playing, keep the current node in view with a gentle scroll, only when it leaves the screen.
    function follow(node) {
      if (!playing) return;
      var r = node.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 40) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function play() {
      if (i >= last) render(-1);
      playing = true; paint();
      var mine = ++loops;
      (function loop() {
        if (!playing || mine !== loops) return;
        if (i >= last) { playing = false; paint(); return; }
        advance().then(function () {
          if (!playing || mine !== loops) return;
          var st = steps[i];
          // Time to read: longer when a new idea appears.
          var dwell = (st && st.idea ? 3400 : 1500) / speed;
          return GE.wait(dwell).then(loop);
        });
      })();
    }
    function pause() { if (playing) { playing = false; paint(); } }
    function go(k) { busy = false; render(Math.max(-1, Math.min(last, k))); }
    GE.pauseAll = (function (prev) { return function () { pause(); if (prev) prev(); }; })(GE.pauseAll);

    /* ---- Inspector ---- */
    function row(term, text) { return [h('dt', null, term), h('dd', null, text)]; }
    function inspectNode(id) {
      var n = D.info[id];
      var out = D.graph.edges.filter(function (e) { return e.from === id; })
        .map(function (e) { return names[e.to] + (e.label ? ' (' + e.label + ')' : ''); });
      selectOnly(view.node(id));
      GE.clear(inspector);
      inspector.appendChild(h('h4', null, names[id]));
      inspector.appendChild(h('dl', { class: 'ar-dl' },
        row('Purpose', n.purpose), row('Receives', n.receives), row('Produces', n.produces),
        row('Done by', n.by), row('Next possible actions', out.length ? out.join(' · ') : 'None: the run ends here.'),
        row('Why it matters', n.why)));
    }
    function inspectEdge(key) {
      var e = D.graph.edges.filter(function (x) { return GE.edgeKey(x) === key; })[0];
      selectOnly(view.edge(key));
      GE.clear(inspector);
      inspector.appendChild(h('h4', null, names[e.from] + ' → ' + names[e.to]));
      inspector.appendChild(h('dl', { class: 'ar-dl' },
        row('Label', e.label || '—'),
        row('What travels', D.edgeInfo[key]),
        row('Line', e.kind === 'model' ? 'Dashed: the model selects this arrow.' : 'Continuous: the system fixes this arrow.')));
    }
    function selectOnly(g) {
      [].forEach.call(view.svg.querySelectorAll('.ar-selected'), function (x) { x.classList.remove('ar-selected'); });
      g.classList.add('ar-selected');
    }

    /* ---- Layout ---- */
    var controls = h('div', { class: 'ar-controls' },
      h('div', { class: 'ar-buttons' }, playBtn, backBtn, nextBtn, replayBtn),
      h('label', { class: 'ar-progress' }, scrub, count),
      h('div', { class: 'ar-speed' }, h('span', { class: 'small muted' }, 'Speed'), speedSeg.el),
      h('label', { class: 'small ar-maplabel', for: 'ar-map' }, mapToggle, ' Show the full map'));
    var key = h('ul', { class: 'legend ar-key', 'aria-label': 'How to read the run' },
      h('li', null, h('span', { class: 'role role-model' }, 'Model call')),
      h('li', null, h('span', { class: 'role role-code' }, 'Code or tool')),
      h('li', null, h('span', { class: 'role role-person' }, 'Person')),
      h('li', null, h('span', { class: 'ln' }), 'Fixed by the system'),
      h('li', null, h('span', { class: 'ln model' }), 'Selected by the model'),
      h('li', null, 'A hexagon is a decision. The small word in a node is its kind of work.'));

    el.appendChild(controls);
    el.appendChild(h('div', { class: 'ar-layout' }, h('div', { class: 'ar-main' }, stage, key), h('div', { class: 'ar-side' }, caption, statePanel, inspector)));
    // Keys: left and right arrows go one step; Space plays or pauses (not when a control has focus).
    el.addEventListener('keydown', function (ev) {
      var t = ev.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); pause(); if (!busy) advance(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); pause(); go(i - 1); }
      else if (ev.key === ' ' && tag !== 'BUTTON' && !t.closest('.gv-node, .gv-edge, summary')) { ev.preventDefault(); playing ? pause() : play(); }
    });
    el.appendChild(h('details', { class: 'drawer ar-logwrap' }, h('summary', null, 'The trace as a log ', h('span', { class: 'tag' }, 'The same run with no animation')), h('div', { class: 'drawer-body' }, log)));
    render(-1);
  };
})(window.GE);

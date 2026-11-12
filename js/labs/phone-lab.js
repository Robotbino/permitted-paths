/* phone-lab.js: the instruments of the practical laboratory (part L).
   - phoneArch:   the three architectures as drawings in eight layers; select a component to read it.
   - phoneLife:   the lifecycle of one task, step by step, with the phone screen beside it.
   - phoneIntake: the checks of the bridge on one request (the same rules as lab/bridge/server.mjs).
   - phoneCost:   the monthly cost of the three scenarios in ZAR.
   - phoneRoad:   the milestones, with a mark for each one that is complete.
   - copy:        a Copy button for a block of code.
   All the content is data in js/data/phone-lab.js. Nothing here calls a network service. */
(function (GE) {
  'use strict';
  var h = GE.h, s = GE.s;
  var P = function () { return GE.data.phone; };

  /* ------------------------------------------------------------------ */
  /* Small shared parts                                                  */
  /* ------------------------------------------------------------------ */

  /** A mark with a shape and a word. Colour is never the only signal. */
  function tag(kind, text) { return h('span', { class: 'ptag ptag-' + kind }, text); }
  function hostTag(host) { var d = P().hosts[host]; return tag('host-' + host, d ? d.name : host); }
  function costTag(cost) { var d = P().costs[cost]; return tag('cost-' + cost, d ? d.name : cost); }
  function readyTag(ready) { var d = P().ready[ready]; return tag('ready-' + ready, d ? d.name : ready); }
  function howTag(how) { var d = P().hows[how]; return tag('how-' + how, d ? d.name : how); }

  function kv(rows) {
    var dl = h('dl', { class: 'kv' });
    rows.forEach(function (r) { if (r[1] == null || r[1] === '') return; dl.appendChild(h('dt', null, r[0])); dl.appendChild(h('dd', null, r[1])); });
    return dl;
  }

  /** The drawing of one architecture, as data for GE.graphView: one band for each layer. */
  GE.phoneGraph = function (arch) {
    var data = P(), W = 1040, BAND = 100, TOP = 14, LEFT = 14, DROP = 12;
    var used = {};
    arch.nodes.forEach(function (n) { used[data.components[n.id].layer] = true; });
    var rows = data.layers.filter(function (l) { return used[l.id]; });
    var yOf = {};
    rows.forEach(function (l, i) { yOf[l.id] = TOP + i * BAND; });
    return {
      w: W, h: TOP * 2 + rows.length * BAND, label: arch.label,
      groups: rows.map(function (l) { return { x: LEFT, y: yOf[l.id] + 4, w: W - 2 * LEFT, h: BAND - 8, label: l.n + '  ' + l.name }; }),
      nodes: arch.nodes.map(function (n) {
        var c = data.components[n.id];
        return { id: n.id, x: n.x, y: yOf[c.layer] + BAND / 2 + DROP, w: n.w, label: n.label || c.short || c.name, sub: n.sub || c.sub || c.impl, type: c.role, shape: c.shape, cls: 'host-' + c.host + (c.cost === 'paid' ? ' is-paid' : '') };
      }),
      edges: arch.edges.map(function (e) {
        var l = data.links[e.link];
        var out = { from: e.from, to: e.to, label: e.label != null ? e.label : l.label, kind: l.model ? 'model' : 'fixed', cls: 'how-' + l.how + (l.boundary ? ' crosses' : '') + (l.approval ? ' needs-approval' : '') };
        ['fromSide', 'toSide', 'fo', 'to_', 'lx'].forEach(function (k) { if (e[k] != null) out[k] = e[k]; });
        // A point can name a layer in place of a y value: [x, 'orch', 12] is 12 below the centre line of that band.
        function rowY(layer, dy) { return yOf[layer] + BAND / 2 + DROP + (dy || 0); }
        if (e.via) out.via = e.via.map(function (p) { return typeof p[1] === 'string' ? [p[0], rowY(p[1], p[2])] : p; });
        if (e.ly != null) out.ly = Array.isArray(e.ly) ? rowY(e.ly[0], e.ly[1]) : e.ly;
        return out;
      })
    };
  };

  /* ------------------------------------------------------------------ */
  /* phoneArch                                                           */
  /* ------------------------------------------------------------------ */
  GE.labs.phoneArch = function (el, chapter) {
    var data = P();
    var archId = el.dataset.arch || 'B', view = null, selected = null, off = null, lens = 'all';
    var host = h('div', { class: 'parch-draw' });
    var panel = h('div', { class: 'panel parch-panel', 'aria-live': 'polite' });
    var summary = h('div', { class: 'parch-summary' });
    var list = h('div', { class: 'parch-list' });
    var seen = {};

    var archSeg = GE.segmented('Architecture', Object.keys(data.archs).map(function (k) { return { value: k, label: data.archs[k].tab }; }), archId, function (v) { archId = v; selected = null; off = null; build(); });
    var lensSeg = GE.segmented('What the drawing shows', data.lenses.map(function (l) { return { value: l.id, label: l.name }; }), lens, function (v) { lens = v; off = null; selected = null; paint(); showLens(); });

    function arch() { return data.archs[archId]; }
    function edgesOf(id) { return arch().edges.filter(function (e) { return e.from === id || e.to === id; }); }
    function keyOf(e) { return GE.edgeKey(e); }

    function decorate() {
      // A small mark in the corner of each node says where it runs. Paid parts also get a second mark.
      arch().nodes.forEach(function (n) {
        var c = data.components[n.id], g = view.node(n.id);
        // The size comes from the attributes, so it is also correct when the part is not on the screen (print).
        var shape = g.querySelector('.shape'), box;
        if (shape.tagName === 'rect') box = { x: +shape.getAttribute('x'), y: +shape.getAttribute('y'), width: +shape.getAttribute('width') };
        else {
          var xs = [], ys = [];
          shape.getAttribute('points').split(' ').forEach(function (p) { var q = p.split(','); xs.push(+q[0]); ys.push(+q[1]); });
          box = { x: Math.min.apply(null, xs) + 12, y: Math.min.apply(null, ys), width: Math.max.apply(null, xs) - Math.min.apply(null, xs) - 24 };
        }
        var mark = data.hosts[c.host].mark, w = mark.length * 6.4 + 10;
        g.appendChild(s('rect', { class: 'pmark-bg', x: box.x + 6, y: box.y - 8, width: w, height: 15, rx: 2 }));
        g.appendChild(s('text', { class: 'pmark', x: box.x + 6 + w / 2, y: box.y }, mark));
        if (c.cost === 'paid' || c.cost === 'existing') {
          var t = c.cost === 'paid' ? 'PAID' : 'PAID NOW', w2 = t.length * 6.4 + 10;
          g.appendChild(s('rect', { class: 'pmark-bg pmark-pay', x: box.x + box.width - w2 - 6, y: box.y - 8, width: w2, height: 15, rx: 2 }));
          g.appendChild(s('text', { class: 'pmark', x: box.x + box.width - 6 - w2 / 2, y: box.y }, t));
        }
        var parts = [c.name, 'runs on: ' + data.hosts[c.host].name, data.costs[c.cost].name];
        view.describe(n.id, parts.slice(1).join(', '));
      });
      // A small gate mark on each connection that waits for your approval.
      arch().edges.forEach(function (e) {
        if (!data.links[e.link].approval) return;
        var g = view.edge(keyOf(e)), path = g && g.querySelector('path'), at = null;
        try { var len = path.getTotalLength(); if (len) at = path.getPointAtLength(len * 0.5); } catch (err) { /* the part is not on the screen */ }
        if (!at) return;
        var r = 8, pts = [[-r, 0], [-r / 2, -r * 0.87], [r / 2, -r * 0.87], [r, 0], [r / 2, r * 0.87], [-r / 2, r * 0.87]];
        g.appendChild(s('polygon', { class: 'pappr', points: pts.map(function (q) { return (at.x + q[0]) + ',' + (at.y + q[1]); }).join(' ') }));
      });
    }

    function build() {
      GE.clear(host);
      view = GE.graphView(host, GE.phoneGraph(arch()), { interactive: true, minScale: 0.8, onNode: function (id) { select(id, true); } });
      decorate();
      GE.clear(summary);
      summary.appendChild(h('p', { class: 'parch-name' }, arch().name));
      summary.appendChild(h('p', { class: 'small' }, arch().summary));
      buildList();
      paint(); showLens();
    }

    function buildList() {
      GE.clear(list);
      var inArch = {};
      arch().nodes.forEach(function (n) { inArch[n.id] = true; });
      data.layers.forEach(function (l) {
        var ids = Object.keys(data.components).filter(function (id) { return inArch[id] && data.components[id].layer === l.id; });
        if (!ids.length) return;
        var row = h('div', { class: 'parch-layer' }, h('span', { class: 'parch-layer-name' }, l.n + ' ' + l.name));
        var chips = h('div', { class: 'chips' });
        ids.forEach(function (id) { chips.appendChild(h('button', { type: 'button', class: 'chip small', 'data-id': id, 'aria-pressed': 'false', onclick: function () { select(id, false); } }, data.components[id].name)); });
        row.appendChild(chips); list.appendChild(row);
      });
    }

    /** The nodes and edges that a lens shows at full strength. */
    function lensSet() {
      var nodes = [], edges = [];
      if (lens === 'all') return null;
      arch().edges.forEach(function (e) {
        var l = data.links[e.link];
        var hit = (lens === 'trust' && l.boundary) || (lens === 'build' && l.how === 'custom');
        if (hit) { edges.push(keyOf(e)); nodes.push(e.from, e.to); }
      });
      arch().nodes.forEach(function (n) {
        var c = data.components[n.id];
        if ((lens === 'build' && c.ready === 'build') || (lens === 'money' && (c.cost === 'paid' || c.cost === 'existing')) || (lens === 'person' && c.role === 'person')) nodes.push(n.id);
      });
      if (lens === 'person') arch().edges.forEach(function (e) { if (data.links[e.link].approval) { edges.push(keyOf(e)); nodes.push(e.from, e.to); } });
      return { nodes: nodes, edges: edges };
    }

    function paint() {
      if (!view) return;
      view.reset();
      [].forEach.call(list.querySelectorAll('.chip'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === selected)); });
      if (off) {
        var out = arch().off[off] || { breaks: [] };
        view.mark(off, 'failed', true);
        var keep = arch().nodes.map(function (n) { return n.id; }).filter(function (id) { return id !== off && out.breaks.indexOf(id) < 0; });
        view.focus(keep.concat([off]), arch().edges.filter(function (e) { return keep.indexOf(e.from) >= 0 && keep.indexOf(e.to) >= 0; }).map(keyOf));
        return;
      }
      if (selected) {
        var es = edgesOf(selected), ns = [selected];
        es.forEach(function (e) { ns.push(e.from, e.to); });
        view.focus(ns, es.map(keyOf));
        view.mark(selected, 'selected', true);
        return;
      }
      var set = lensSet();
      if (set) view.focus(set.nodes, set.edges); else view.focus();
    }

    function linkRow(e) {
      var l = data.links[e.link], other = e.from === selected ? e.to : e.from, c = data.components[other];
      var dir = e.from === selected ? 'To ' : 'From ';
      return h('li', null,
        h('div', { class: 'plink-head' }, h('button', { type: 'button', class: 'plink-to', onclick: function () { select(other, false); } }, dir + c.name), howTag(l.how), l.boundary ? tag('boundary', 'Crosses a trust boundary') : null, l.approval ? tag('approval', 'Approval') : null),
        h('p', { class: 'small' }, l.purpose),
        kv([['Method', l.method], ['Authentication', l.auth]]));
    }

    function showLens() {
      if (selected || off) return;
      var l = data.lenses.filter(function (x) { return x.id === lens; })[0];
      GE.clear(panel);
      panel.appendChild(h('p', { class: 'panel-title' }, l.id === 'all' ? 'Select a component' : l.name));
      panel.appendChild(h('p', { class: 'small' }, l.text));
      if (lens === 'trust' || lens === 'build') {
        var ul = h('ul', { class: 'plinks' });
        arch().edges.forEach(function (e) {
          var k = data.links[e.link];
          if (!((lens === 'trust' && k.boundary) || (lens === 'build' && k.how === 'custom'))) return;
          ul.appendChild(h('li', null, h('div', { class: 'plink-head' }, h('strong', null, data.components[e.from].name + ' → ' + data.components[e.to].name), howTag(k.how)), h('p', { class: 'small' }, lens === 'trust' ? k.auth : k.purpose)));
        });
        if (ul.children.length) panel.appendChild(ul);
        else panel.appendChild(h('p', { class: 'small muted' }, lens === 'build' ? 'This architecture has no connection that you must write yourself.' : 'No connection crosses a trust boundary.'));
      }
      if (lens === 'all') panel.appendChild(h('p', { class: 'small muted' }, 'Select a component in the drawing or in the list below it. The panel then shows what it does, what goes in and out, what it costs and what stops when it is not available.'));
    }

    function select(id, fromDrawing) {
      if (selected === id && !off) { selected = null; paint(); showLens(); return; }
      selected = id; off = null;
      seen[archId + ':' + id] = true;
      paint(); showDetail();
      if (Object.keys(seen).length >= 4) GE.trace.lab('phoneArch', chapter);
      if (!fromDrawing && window.matchMedia('(max-width: 78rem)').matches) panel.scrollIntoView({ block: 'nearest', behavior: GE.reduced() ? 'auto' : 'smooth' });
    }

    function showDetail() {
      var c = data.components[selected], out = arch().off[selected];
      GE.clear(panel);
      panel.appendChild(h('p', { class: 'panel-title' }, c.name));
      panel.appendChild(h('p', { class: 'ptags' }, hostTag(c.host), costTag(c.cost), readyTag(c.ready)));
      panel.appendChild(h('p', null, c.does));
      panel.appendChild(kv([['Implemented by', c.impl], ['Goes in', c.goesIn], ['Comes out', c.goesOut], ['Cost', c.costNote], ['Layer', layerName(c.layer)]]));
      var es = edgesOf(selected);
      if (es.length) {
        panel.appendChild(h('h4', null, 'Connections'));
        var ul = h('ul', { class: 'plinks' });
        es.forEach(function (e) { ul.appendChild(linkRow(e)); });
        panel.appendChild(ul);
      }
      if (out) {
        panel.appendChild(h('h4', null, 'When it is not available'));
        panel.appendChild(h('p', { class: 'small' }, out.text));
        panel.appendChild(h('div', { class: 'controls' }, h('button', { type: 'button', class: 'btn ghost small', 'aria-pressed': String(off === selected), onclick: function () { off = off === selected ? null : selected; paint(); showDetail(); } }, off === selected ? 'Switch it on again' : 'Switch it off in the drawing')));
        if (off === selected) panel.appendChild(h('p', { class: 'small' }, GE.stamp('FAIL'), ' ', out.breaks.length ? 'The dim components stop with it: ' + out.breaks.map(function (b) { return data.components[b].name; }).join(', ') + '.' : 'No other component stops.'));
      }
      if (c.doc) panel.appendChild(h('p', { class: 'small' }, h('a', { href: c.doc.url, rel: 'noopener' }, c.doc.text)));
    }
    function layerName(id) { var l = data.layers.filter(function (x) { return x.id === id; })[0]; return l.n + '. ' + l.name; }

    var legend = h('ul', { class: 'legend parch-legend', 'aria-label': 'Legend' });
    Object.keys(data.hosts).forEach(function (k) { legend.appendChild(h('li', null, h('span', { class: 'pkey' }, data.hosts[k].mark), data.hosts[k].name)); });
    legend.appendChild(h('li', null, h('span', { class: 'pkey pkey-pay' }, 'PAID'), 'A new cost'));
    legend.appendChild(h('li', null, h('span', { class: 'pkey pkey-pay' }, 'PAID NOW'), 'A cost you have today'));
    legend.appendChild(h('li', null, h('span', { class: 'ln' }), 'Fixed connection'));
    legend.appendChild(h('li', null, h('span', { class: 'ln model' }), 'The agent selects'));
    legend.appendChild(h('li', null, h('span', { class: 'ln custom' }), 'Code that you write'));
    legend.appendChild(h('li', null, h('span', { class: 'pkey-appr' }), 'Waits for your approval'));

    el.appendChild(h('div', { class: 'controls' }, archSeg.el));
    el.appendChild(summary);
    el.appendChild(h('div', { class: 'controls' }, h('span', { class: 'small muted' }, 'Show:'), lensSeg.el));
    el.appendChild(h('div', { class: 'parch' },
      h('div', { class: 'parch-main' }, host, GE.legend(['code', 'agent', 'person']), legend),
      panel,
      h('details', { class: 'drawer parch-drawer', open: true }, h('summary', null, 'The components as a list', h('span', { class: 'tag' }, 'the same content as the drawing')), h('div', { class: 'drawer-body' }, list))));
    build();
  };

  /* ------------------------------------------------------------------ */
  /* phoneLife                                                           */
  /* ------------------------------------------------------------------ */
  GE.labs.phoneLife = function (el, chapter) {
    var data = P(), flowId = 'fix', i = 0, rejected = false;
    var track = h('ol', { class: 'plife-track' });
    var phone = h('div', { class: 'pphone-screen', role: 'log', 'aria-label': 'The chat on the phone (a simulation)' });
    var body = h('div', { class: 'plife-body', 'aria-live': 'polite' });
    var prev = h('button', { type: 'button', class: 'btn ghost small', onclick: function () { go(i - 1); } }, 'Back');
    var next = h('button', { type: 'button', class: 'btn small', onclick: function () { go(i + 1); } }, 'Next stage');
    var count = h('span', { class: 'stepper-count mono' });
    var seg = GE.segmented('Example', Object.keys(data.flows).map(function (k) { return { value: k, label: data.flows[k].tab }; }), flowId, function (v) { flowId = v; rejected = false; go(0); });

    function flow() { return data.flows[flowId]; }
    function bubble(m, live) {
      var b = h('div', { class: 'pmsg pmsg-' + m.from }, h('span', { class: 'vh' }, m.from === 'me' ? 'You: ' : 'The bot: '), h('p', null, m.text));
      if (m.code) b.appendChild(h('pre', null, h('code', null, m.code)));
      if (m.buttons) {
        var row = h('div', { class: 'pmsg-btns' });
        m.buttons.forEach(function (label) {
          var isReject = /reject/i.test(label);
          row.appendChild(h('button', { type: 'button', class: 'btn ghost small', disabled: !live, onclick: function () { if (isReject) { rejected = true; go(i); } else { rejected = false; go(i + 1); } } }, label));
        });
        b.appendChild(row);
      }
      return b;
    }
    function go(n) {
      var st = flow().stages;
      if (n !== i) rejected = false;
      i = Math.max(0, Math.min(st.length - 1, n));
      var cur = st[i];
      GE.clear(track);
      st.forEach(function (x, k) {
        track.appendChild(h('li', { class: (k === i ? 'current' : '') + (k < i ? ' done' : '') }, h('button', { type: 'button', 'aria-current': k === i ? 'step' : null, onclick: function () { if (k <= i) rejected = false; go(k); } }, h('span', { class: 'plife-n', 'aria-hidden': 'true' }, String(k + 1)), h('span', { class: 'plife-name' }, x.name))));
      });
      // On a narrow screen the track scrolls: keep the current stage in view.
      var now = track.children[i];
      if (now && track.scrollWidth > track.clientWidth) track.scrollLeft = now.offsetLeft - track.clientWidth / 2 + now.offsetWidth / 2;
      GE.clear(phone);
      var waiting = null;
      st.slice(0, i + 1).forEach(function (x, k) {
        (x.phone || []).forEach(function (m) {
          var live = k === i && !!m.buttons && i < st.length - 1 && !rejected;
          if (live) waiting = true;
          phone.appendChild(bubble(m, live));
        });
      });
      if (rejected && cur.rejected) (cur.rejected.phone || []).forEach(function (m) { phone.appendChild(bubble(m, false)); });
      phone.scrollTop = phone.scrollHeight;

      var show = rejected && cur.rejected ? cur.rejected : cur;
      GE.clear(body);
      body.appendChild(h('p', { class: 'plife-stage' }, 'Stage ' + (i + 1) + ' of ' + st.length + (rejected && cur.rejected ? ' · the other path' : '')));
      body.appendChild(h('h4', { class: 'plife-title' }, show.title || cur.name));
      body.appendChild(h('p', { class: 'ptags' }, h('span', { class: 'role role-' + cur.role }, cur.actor), readyTag(cur.ready)));
      body.appendChild(h('p', null, show.what));
      if (show.data) body.appendChild(h('pre', { class: 'plife-data' }, h('code', null, show.data)));
      body.appendChild(kv([['State after this stage', show.state], ['If it fails', show.fail], ['Idea of the course', show.idea]]));
      prev.disabled = i === 0;
      var ended = rejected && !!cur.rejected;
      next.disabled = i >= st.length - 1 || !!waiting || ended;
      next.textContent = waiting ? 'Answer on the phone' : ended ? 'The run ended here' : 'Next stage';
      count.textContent = flow().name;
      if (rejected && cur.rejected) body.appendChild(h('div', { class: 'controls' }, h('button', { type: 'button', class: 'btn ghost small', onclick: function () { rejected = false; go(i); } }, 'Go back to the decision')));
      if (i === st.length - 1) GE.trace.lab('phoneLife:' + flowId, chapter);
    }

    el.appendChild(h('div', { class: 'controls' }, seg.el, h('span', { class: 'prov sim' }, 'A simulation. No message is sent and no agent runs.')));
    el.appendChild(h('nav', { 'aria-label': 'The stages of the task' }, track));
    el.appendChild(h('div', { class: 'plife' },
      h('div', { class: 'pphone' }, h('div', { class: 'pphone-top', 'aria-hidden': 'true' }, 'Telegram · your private bot'), phone),
      h('div', null, body, h('div', { class: 'controls' }, prev, next, count))));
    go(0);
  };

  /* ------------------------------------------------------------------ */
  /* phoneIntake: the checks of the bridge                               */
  /* ------------------------------------------------------------------ */

  /** The same rules as validate() in lab/bridge/server.mjs. Gives the list of checks and the first one that stops the request. */
  GE.phoneCheck = function (req, cfg) {
    var repo = cfg.repos[req.repo];
    var checks = [
      { id: 'token', name: 'Shared secret of the caller', ok: req.token === cfg.token, why: 'The request does not carry the secret that only n8n and the bridge know.' },
      { id: 'sender', name: 'Sender is on the allowlist', ok: cfg.users.indexOf(req.user) >= 0, why: 'The Telegram user id is not on the allowlist.' },
      { id: 'repo', name: 'Repository is on the allowlist', ok: !!repo, why: 'The bridge has no entry for this repository, so it has no folder to start in.' },
      { id: 'mode', name: 'Mode is permitted for this repository', ok: !!repo && repo.modes.indexOf(req.mode) >= 0, why: 'This repository does not permit this mode.' },
      { id: 'approval', name: 'Approval, where the mode needs it', ok: cfg.needsApproval.indexOf(req.mode) < 0 || req.approved === true, why: 'This mode changes something. It needs your approval for this task.' }
    ];
    var stop = null;
    checks.forEach(function (c) { if (!stop && !c.ok) stop = c.id; });
    return { ok: !stop, stop: stop, checks: checks };
  };

  GE.labs.phoneIntake = function (el, chapter) {
    var data = P(), cfg = data.intake.config, tried = {};
    function sel(id, options) { return h('select', { class: 'input', id: id }, options.map(function (o) { return h('option', { value: o[0] }, o[1]); })); }
    var f = {
      user: sel('pi-user', data.intake.users), token: sel('pi-token', [['yes', 'Yes, from n8n'], ['no', 'No: a direct call to the port']]),
      repo: sel('pi-repo', data.intake.repos), mode: sel('pi-mode', data.intake.modes), approved: sel('pi-ok', [['no', 'Not yet'], ['yes', 'Yes, on the phone']]),
      guess: sel('pi-guess', [['', 'Make a prediction']].concat(GE.phoneCheck({}, cfg).checks.map(function (c) { return [c.id, 'It stops at: ' + c.name]; })).concat([['run', 'It passes each check and the agent starts']]))
    };
    var run = h('button', { type: 'button', class: 'btn', disabled: true }, 'Send the request');
    var out = h('div', { class: 'pintake-out', 'aria-live': 'polite' });
    f.guess.addEventListener('change', function () { run.disabled = !f.guess.value; });
    function field(label, input) { return h('div', { class: 'field' }, h('label', { 'for': input.id }, label), input); }

    run.addEventListener('click', function () {
      var req = { user: f.user.value, token: f.token.value === 'yes' ? cfg.token : 'none', repo: f.repo.value, mode: f.mode.value, approved: f.approved.value === 'yes' };
      var r = GE.phoneCheck(req, cfg), guess = f.guess.value, right = guess === (r.stop || 'run');
      GE.clear(out);
      var ol = h('ol', { class: 'pchecks' });
      var stopped = false;
      r.checks.forEach(function (c) {
        if (stopped) { ol.appendChild(h('li', { class: 'muted' }, h('span', { class: 'stamp none' }, 'NOT RUN'), ' ', c.name)); return; }
        ol.appendChild(h('li', null, GE.stamp(c.ok ? 'PASS' : 'FAIL'), ' ', c.name, c.ok ? null : h('span', { class: 'small' }, ' — ' + c.why)));
        if (!c.ok) stopped = true;
      });
      out.appendChild(ol);
      out.appendChild(h('p', { class: 'feedback' }, GE.stamp(right ? 'PASS' : 'FAIL'), right ? ' Your prediction was correct. ' : ' Your prediction was not correct. ', r.ok ? 'The bridge starts Claude Code in the folder of the repository, with the tools of this mode only: ' + data.intake.tools[req.mode] + '.' : 'The bridge answers with an error code and writes the attempt to the audit log. Claude Code does not start.'));
      tried[r.stop || 'run'] = true;
      var left = 6 - Object.keys(tried).length;
      out.appendChild(h('p', { class: 'small muted' }, left > 0 ? 'You have seen ' + Object.keys(tried).length + ' of the 6 results. Find the others.' : 'You have seen each of the 6 results. Each check is code. The model has no part in them.'));
      if (left <= 0) GE.trace.lab('phoneIntake', chapter);
      f.guess.value = ''; run.disabled = true;
    });

    el.appendChild(h('div', { class: 'split even' },
      h('div', { class: 'pintake-form' }, field('Who sends the message?', f.user), field('Does the request carry the shared secret?', f.token), field('Which repository?', f.repo), field('Which mode?', f.mode), field('Did you give approval for this task?', f.approved)),
      h('div', null, field('Before you send it: what occurs?', f.guess), h('div', { class: 'controls' }, run), out)));
  };

  /* ------------------------------------------------------------------ */
  /* phoneCost                                                           */
  /* ------------------------------------------------------------------ */

  /** Monthly cost of one scenario. Gives {existing, added, optional, rows} in ZAR. */
  GE.phoneCost = function (scenario, opts) {
    var data = P(), fx = data.fx;
    function zar(amount, cur) { return cur === 'ZAR' ? amount : amount * fx[cur]; }
    var rows = scenario.items.map(function (it) {
      var amount = it.amount, cur = it.cur, note = it.note;
      if (it.plan) { var pl = data.plans[opts.plan]; amount = pl.usd; cur = 'USD'; note = pl.name; }
      if (it.power) { amount = it.watts * opts.hours * 30 / 1000 * data.power.zarPerKwh; cur = 'ZAR'; note = it.watts + ' W for ' + opts.hours + ' hours each day at R' + data.power.zarPerKwh.toFixed(2) + ' for each kWh'; }
      return { label: it.label, kind: it.kind, amount: amount, cur: cur, zar: zar(amount, cur), note: note, src: it.src };
    });
    function sum(kind) { return rows.filter(function (r) { return r.kind === kind; }).reduce(function (n, r) { return n + r.zar; }, 0); }
    return { rows: rows, existing: sum('existing'), added: sum('added'), optional: sum('optional') };
  };

  GE.labs.phoneCost = function (el, chapter) {
    var data = P(), opts = { plan: Object.keys(data.plans)[0], hours: 10 };
    var body = h('div', { class: 'pcost', 'aria-live': 'polite' });
    function R(n) { return 'R' + Math.round(n).toLocaleString('en-US'); }
    function orig(r) { return r.cur === 'ZAR' ? '' : (r.cur === 'USD' ? '$' : '€') + r.amount.toFixed(2); }
    var planSeg = GE.segmented('Your Claude plan', Object.keys(data.plans).map(function (k) { return { value: k, label: data.plans[k].name }; }), opts.plan, function (v) { opts.plan = v; draw(); });
    var hours = h('input', { type: 'range', id: 'pc-hours', min: '2', max: '24', step: '1', value: String(opts.hours) });
    var hoursOut = h('output', { 'for': 'pc-hours', class: 'mono' });
    hours.addEventListener('input', function () { opts.hours = +hours.value; draw(); GE.trace.lab('phoneCost', chapter); });

    function draw() {
      hoursOut.textContent = opts.hours + ' hours each day';
      GE.clear(body);
      var results = data.scenarios.map(function (sc) { return GE.phoneCost(sc, opts); });
      var max = Math.max.apply(null, results.map(function (r) { return r.existing + r.added + r.optional; })) || 1;
      data.scenarios.forEach(function (sc, k) {
        var r = results[k];
        var col = h('section', { class: 'panel pcost-col' }, h('h4', null, sc.name), h('p', { class: 'small' }, sc.text));
        col.appendChild(h('div', { class: 'readouts' }, h('div', { class: 'readout' }, h('b', null, R(r.added)), h('span', null, 'added each month')), h('div', { class: 'readout' }, h('b', null, R(r.existing)), h('span', null, 'that you pay now'))));
        var bar = h('div', { class: 'pcost-bar', role: 'img', 'aria-label': 'Each month: ' + R(r.existing) + ' that you pay now, ' + R(r.added) + ' added, ' + R(r.optional) + ' optional.' });
        [['existing', r.existing], ['added', r.added], ['optional', r.optional]].forEach(function (p) { if (p[1] > 0) bar.appendChild(h('span', { class: 'pcost-seg pcost-' + p[0], style: 'width:' + (p[1] / max * 100) + '%' })); });
        col.appendChild(bar);
        var tb = h('tbody');
        r.rows.forEach(function (row) {
          tb.appendChild(h('tr', null,
            h('td', null, h('span', { class: 'pcost-item' }, row.label), row.note ? h('span', { class: 'small muted pcost-note' }, row.note) : null, h('span', { class: 'pcost-meta' }, tag('kind-' + row.kind, data.kinds[row.kind]), row.src ? h('a', { class: 'src', href: row.src.url, rel: 'noopener' }, row.src.text) : null)),
            h('td', { class: 'num' }, h('span', { class: 'pcost-zar' }, row.zar ? R(row.zar) : 'R0'), orig(row) ? h('span', { class: 'small muted pcost-orig' }, orig(row)) : null)));
        });
        col.appendChild(h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num' }, 'Each month'))), tb)));
        if (sc.limits) col.appendChild(h('p', { class: 'small muted' }, sc.limits));
        body.appendChild(col);
      });
    }
    el.appendChild(h('div', { class: 'pcost-controls' },
      h('div', { class: 'field' }, h('span', null, 'Your Claude plan (a cost you have today)'), planSeg.el),
      h('div', { class: 'field' }, h('label', { 'for': 'pc-hours' }, 'How long is the computer on each day for this system? ', hoursOut), hours)));
    el.appendChild(h('ul', { class: 'legend' }, h('li', null, h('span', { class: 'pcost-key pcost-existing' }), 'You pay it now'), h('li', null, h('span', { class: 'pcost-key pcost-added' }), 'Added by this system'), h('li', null, h('span', { class: 'pcost-key pcost-optional' }), 'Optional')));
    el.appendChild(body);
    el.appendChild(h('p', { class: 'small muted' }, 'Exchange rates: $1 = R' + data.fx.USD.toFixed(2) + ', €1 = R' + data.fx.EUR.toFixed(2) + ' (' + data.fx.date + '; ', h('a', { href: data.fx.url, rel: 'noopener' }, data.fx.source), '). The ZAR numbers are approximate. A card payment adds the fee of your bank, and some suppliers add VAT.'));
    draw();
  };

  /* ------------------------------------------------------------------ */
  /* phoneRoad                                                           */
  /* ------------------------------------------------------------------ */
  GE.labs.phoneRoad = function (el, chapter) {
    var data = P(), done = GE.store.get('phoneRoad', {});
    var out = h('p', { class: 'feedback', 'aria-live': 'polite' });
    function say() {
      var n = data.road.filter(function (m) { return done[m.id]; }).length;
      var last = null;
      data.road.forEach(function (m) { if (done[m.id]) last = m; });
      out.textContent = n ? n + ' of ' + data.road.length + ' milestones complete. You can now: ' + last.can : 'No milestone is complete. Milestone 1 needs about ten minutes and no new software.';
    }
    var ol = h('ol', { class: 'proad' });
    data.road.forEach(function (m, k) {
      var id = 'pr-' + m.id;
      var box = h('input', { type: 'checkbox', id: id });
      box.checked = !!done[m.id];
      box.addEventListener('change', function () { done[m.id] = box.checked; GE.store.set('phoneRoad', done); say(); GE.trace.lab('phoneRoad', chapter); });
      ol.appendChild(h('li', { class: 'proad-item' },
        h('div', { class: 'proad-head' }, h('span', { class: 'proad-n', 'aria-hidden': 'true' }, String(k + 1)), h('h4', null, m.name), h('span', { class: 'ptags' }, readyTag(m.ready), tag('time', m.time), tag('cost-' + (m.cost ? 'paid' : 'free'), m.cost || 'No new cost'))),
        h('p', null, m.what),
        h('ol', { class: 'proad-steps' }, m.steps.map(function (st) { return h('li', null, st); })),
        h('p', { class: 'small' }, h('strong', null, 'After this milestone you can: '), m.can),
        m.later ? h('p', { class: 'small muted' }, 'You can delay: ' + m.later) : null,
        h('label', { class: 'check-row', 'for': id }, box, 'This milestone works on my machine')));
    });
    el.appendChild(ol);
    el.appendChild(out);
    say();
  };

  /* ------------------------------------------------------------------ */
  /* copy                                                                */
  /* ------------------------------------------------------------------ */
  GE.labs.copy = function (el) {
    var pre = el.querySelector('pre');
    if (!pre) return;
    var say = h('span', { class: 'small muted', 'aria-live': 'polite' });
    var btn = h('button', { type: 'button', class: 'btn ghost small', onclick: function () {
      var text = pre.textContent;
      function ok() { say.textContent = 'Copied.'; setTimeout(function () { say.textContent = ''; }, 2500); }
      function manual() {
        var r = document.createRange(); r.selectNodeContents(pre);
        var selx = window.getSelection(); selx.removeAllRanges(); selx.addRange(r);
        var done = false; try { done = document.execCommand('copy'); } catch (e) { /* no clipboard */ }
        say.textContent = done ? 'Copied.' : 'The text is selected. Copy it with the keyboard.';
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, manual); else manual();
    } }, 'Copy');
    var bar = h('div', { class: 'pcode-bar' }, h('span', { class: 'pcode-name mono' }, el.dataset.file || ''), say, btn);
    el.insertBefore(bar, pre);
  };
})(window.GE);

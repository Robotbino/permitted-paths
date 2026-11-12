/* graph-view.js: draws a graph as SVG from data. The positions are set by hand in the data
   (no automatic layout), so each drawing is designed.

   def = { w, h, label, groups?: [{x, y, w, h, label}],
           nodes: [{id, x, y, w?, h?, label, sub?, type?, shape?}],
           edges: [{from, to, label?, kind?, id?, fromSide?, toSide?, fo?, to_?, via?, lx?, ly?}] }
   - x, y is the centre of a node. `label` can have "\n" for a second line.
   - type: code | model | agent | person (the four roles), or none.
   - shape: step (rectangle), gate (hexagon), pill (start and end).
   - edge kind: fixed (continuous line), model (dashed: a model selects it), ref (dotted). */
(function (GE) {
  'use strict';
  var s = GE.s;
  var uid = 0;

  function sizeOf(n) {
    var lines = String(n.label).split('\n');
    var longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    var w = n.w || Math.max(96, longest * 7.4 + 30 + (n.shape === 'gate' ? 22 : 0));
    var h = n.h || (lines.length > 1 ? 54 : 40) + (n.sub ? 14 : 0);
    return { w: w, h: h, lines: lines };
  }

  function anchor(n, side) {
    if (side === 't') return [n.x, n.y - n.H / 2];
    if (side === 'b') return [n.x, n.y + n.H / 2];
    if (side === 'l') return [n.x - n.W / 2, n.y];
    return [n.x + n.W / 2, n.y];
  }

  function route(a, b, e) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var vertical = Math.abs(dy) > Math.abs(dx) * 0.6;
    var fs = e.fromSide || (vertical ? (dy > 0 ? 'b' : 't') : (dx > 0 ? 'r' : 'l'));
    var ts = e.toSide || (vertical ? (dy > 0 ? 't' : 'b') : (dx > 0 ? 'l' : 'r'));
    var p0 = anchor(a, fs), p1 = anchor(b, ts);
    // fo / to: move the start or the end along its side, when two edges use the same side.
    if (e.fo) p0[fs === 't' || fs === 'b' ? 0 : 1] += e.fo;
    if (e.to_) p1[ts === 't' || ts === 'b' ? 0 : 1] += e.to_;
    var pts = [p0];
    if (e.via) e.via.forEach(function (p) { pts.push(p); });
    else {
      var fv = fs === 't' || fs === 'b', tv = ts === 't' || ts === 'b';
      if (fv && tv && p0[0] !== p1[0]) { var my = (p0[1] + p1[1]) / 2; pts.push([p0[0], my], [p1[0], my]); }
      else if (!fv && !tv && p0[1] !== p1[1]) { var mx = (p0[0] + p1[0]) / 2; pts.push([mx, p0[1]], [mx, p1[1]]); }
      else if (fv && !tv) pts.push([p0[0], p1[1]]);
      else if (!fv && tv) pts.push([p1[0], p0[1]]);
    }
    pts.push(p1);
    return pts;
  }

  /** A path through the points with rounded corners. */
  function pathD(pts) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      var r = Math.min(10, la / 2, lb / 2);
      if (r < 1) { d += ' L' + p[0] + ' ' + p[1]; continue; }
      var ax = p[0] + (a[0] - p[0]) * r / la, ay = p[1] + (a[1] - p[1]) * r / la;
      var bx = p[0] + (b[0] - p[0]) * r / lb, by = p[1] + (b[1] - p[1]) * r / lb;
      d += ' L' + ax + ' ' + ay + ' Q' + p[0] + ' ' + p[1] + ' ' + bx + ' ' + by;
    }
    var last = pts[pts.length - 1];
    return d + ' L' + last[0] + ' ' + last[1];
  }

  function labelSpot(pts) {
    var best = 0, at = [pts[0][0], pts[0][1]];
    for (var i = 1; i < pts.length; i++) {
      var len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len > best) { best = len; at = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2]; }
    }
    return at;
  }

  function shapeFor(n) {
    var w = n.W, h = n.H, x = -w / 2, y = -h / 2;
    if (n.shape === 'gate') {
      var c = Math.min(16, h / 2);
      var pts = [[x + c, y], [x + w - c, y], [x + w, 0], [x + w - c, y + h], [x + c, y + h], [x, 0]];
      return s('polygon', { class: 'shape', points: pts.map(function (p) { return p.join(','); }).join(' ') });
    }
    if (n.shape === 'pill') return s('rect', { class: 'shape', x: x, y: y, width: w, height: h, rx: h / 2 });
    if (n.type === 'person') return s('rect', { class: 'shape', x: x, y: y, width: w, height: h, rx: 14 });
    return s('rect', { class: 'shape', x: x, y: y, width: w, height: h, rx: 3 });
  }

  GE.graphView = function (host, def, opts) {
    opts = opts || {};
    var id = 'gv' + (++uid);
    var nodes = {}, edges = {};
    var svg = s('svg', { class: 'gv', viewBox: '0 0 ' + def.w + ' ' + def.h, role: opts.interactive ? 'group' : 'img', 'aria-label': def.label || 'Diagram' });
    // Keep the text of a drawing near the size of the body text: not too small, not too large.
    svg.style.minWidth = Math.min(def.w, Math.round(def.w * (opts.minScale || 0.85))) + 'px';
    svg.style.maxWidth = Math.round(def.w * 1.12) + 'px';
    svg.appendChild(s('defs', null,
      s('marker', { id: id + '-a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, s('path', { class: 'gv-arrow', d: 'M0 0L10 5L0 10z' })),
      s('marker', { id: id + '-b', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, s('path', { class: 'gv-arrow-on', d: 'M0 0L10 5L0 10z' }))
    ));
    var gGroups = s('g'), gEdges = s('g'), gNodes = s('g'), gTop = s('g');
    svg.appendChild(gGroups); svg.appendChild(gEdges); svg.appendChild(gNodes); svg.appendChild(gTop);

    (def.groups || []).forEach(function (g) {
      gGroups.appendChild(s('g', { class: 'gv-group' },
        s('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 4 }),
        s('text', { x: g.x + 10, y: g.y + 15 }, g.label)));
    });

    def.nodes.forEach(function (n) {
      var size = sizeOf(n);
      var node = Object.assign({}, n, { W: size.w, H: size.h });
      var g = s('g', { class: 'gv-node ' + (n.type || 'plain') + (n.cls ? ' ' + n.cls : ''), transform: 'translate(' + n.x + ',' + n.y + ')', 'data-id': n.id });
      // An agent is a loop: it gets a second outline.
      g.appendChild(s('rect', { class: 'shape2', x: -size.w / 2 - 4, y: -size.h / 2 - 4, width: size.w + 8, height: size.h + 8, rx: 6 }));
      g.appendChild(shapeFor(node));
      var total = size.lines.length + (n.sub ? 1 : 0);
      size.lines.forEach(function (line, i) {
        g.appendChild(s('text', { class: 'lbl', y: (i - (total - 1) / 2) * 16 }, line));
      });
      if (n.sub) g.appendChild(s('text', { class: 'sub', y: ((total - 1) - (total - 1) / 2) * 16 }, n.sub));
      node.name = String(n.label).replace(/\n/g, ' ') + (n.sub ? ', ' + n.sub : '');
      // opts.canUse(node) lets an instrument leave some nodes out (for example Start and End).
      if (opts.interactive && (!opts.canUse || opts.canUse(n))) {
        // The focus ring is its own outline, so focus does not hide a state such as "selected" or "failed".
        g.appendChild(s('rect', { class: 'focus-ring', x: -size.w / 2 - 7, y: -size.h / 2 - 7, width: size.w + 14, height: size.h + 14, rx: 8 }));
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
        g.setAttribute('aria-label', node.name);
        g.addEventListener('click', function () { if (opts.onNode) opts.onNode(n.id, g); });
        g.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (opts.onNode) opts.onNode(n.id, g); }
          else if (opts.onKey) opts.onKey(n.id, ev);
        });
      }
      gNodes.appendChild(g);
      node.el = g;
      nodes[n.id] = node;
    });

    def.edges.forEach(function (e) {
      var a = nodes[e.from], b = nodes[e.to];
      if (!a || !b) throw new Error('Edge ' + e.from + ' > ' + e.to + ' points to a node that is not in the drawing.');
      var pts = route(a, b, e);
      var key = GE.edgeKey(e);
      var path = s('path', { d: pathD(pts), 'marker-end': 'url(#' + id + '-a)' });
      var g = s('g', { class: 'gv-edge ' + (e.kind || 'fixed') + (e.cls ? ' ' + e.cls : ''), 'data-key': key }, path);
      var text = null;
      if (e.label != null) {
        var at = labelSpot(pts);
        text = s('text', { x: e.lx != null ? e.lx : at[0], y: e.ly != null ? e.ly : at[1] - 9 }, e.label);
        g.appendChild(text);
      }
      gEdges.appendChild(g);
      edges[key] = { el: g, path: path, text: text, def: e };
    });

    var moving = null; // the tween of the token, if it is on an edge now
    var token = s('circle', { class: 'gv-token', r: 7, visibility: 'hidden' });
    gTop.appendChild(token);

    var wrap = GE.h('div', { class: 'gv-wrap' }, svg);
    host.appendChild(wrap);

    function setArrow(edge) {
      var on = edge.el.classList.contains('used') || edge.el.classList.contains('lit');
      edge.path.setAttribute('marker-end', 'url(#' + id + (on ? '-b)' : '-a)'));
    }

    var api = {
      el: wrap, svg: svg, def: def,
      node: function (nid) { return nodes[nid] && nodes[nid].el; },
      edge: function (key) { return edges[key] && edges[key].el; },
      nodeIds: function () { return Object.keys(nodes); },
      edgeKeys: function () { return Object.keys(edges); },
      mark: function (nid, cls, on) { if (nodes[nid]) nodes[nid].el.classList.toggle(cls, on !== false); },
      markEdge: function (key, cls, on) { if (edges[key]) { edges[key].el.classList.toggle(cls, on !== false); setArrow(edges[key]); } },
      setType: function (nid, type) {
        var el = nodes[nid].el;
        ['code', 'model', 'agent', 'person', 'plain'].forEach(function (t) { el.classList.remove(t); });
        el.classList.add(type || 'plain');
      },
      /** Say the state of a node to assistive technology: "Make a plan, type: agent, not correct". */
      describe: function (nid, extra) { if (nodes[nid]) nodes[nid].el.setAttribute('aria-label', nodes[nid].name + (extra ? ', ' + extra : '')); },
      setEdgeLabel: function (key, label) { if (edges[key] && edges[key].text) edges[key].text.textContent = label; },
      setEdgeKind: function (key, kind) {
        var el = edges[key].el;
        ['fixed', 'model', 'ref'].forEach(function (k) { el.classList.remove(k); });
        el.classList.add(kind);
      },
      /** Show only these nodes and edges at full strength. Call with no arguments to show all. */
      focus: function (nodeIds, edgeKeys) {
        Object.keys(nodes).forEach(function (k) { nodes[k].el.classList.remove('lit'); });
        Object.keys(edges).forEach(function (k) { edges[k].el.classList.remove('lit'); setArrow(edges[k]); });
        var any = !!(nodeIds && nodeIds.length) || !!(edgeKeys && edgeKeys.length);
        svg.classList.toggle('has-focus', any);
        (nodeIds || []).forEach(function (k) { api.mark(k, 'lit'); });
        (edgeKeys || []).forEach(function (k) { api.markEdge(k, 'lit'); });
      },
      reset: function () {
        var states = ['active', 'done', 'failed', 'lit', 'selected', 'used', 'unused'];
        Object.keys(nodes).forEach(function (k) { states.forEach(function (c) { nodes[k].el.classList.remove(c); }); });
        Object.keys(edges).forEach(function (k) { states.forEach(function (c) { edges[k].el.classList.remove(c); }); setArrow(edges[k]); });
        svg.classList.remove('has-focus');
        if (moving) moving.cancel();
        token.setAttribute('visibility', 'hidden');
      },
      /** Move the token along one edge. Gives a Promise. */
      travel: function (key, ms) {
        var edge = edges[key];
        if (!edge) return Promise.resolve();
        if (moving) moving.cancel(); // one token: a new travel ends the old one
        var len = edge.path.getTotalLength();
        token.setAttribute('visibility', 'visible');
        // A model-selected edge is not sure: the token moves from side to side on it.
        var wobble = edge.el.classList.contains('model') ? 3 : 0;
        var mine = GE.motion.tween({
          ms: Math.max(260, Math.min(ms * 1.6, ms * len / 140)), ease: 'move',
          update: function (k) {
            if (moving !== mine && moving !== null) return;
            var p = edge.path.getPointAtLength(len * k);
            var off = wobble ? Math.sin(k * 22) * wobble * Math.sin(k * Math.PI) : 0;
            token.setAttribute('cx', p.x + off); token.setAttribute('cy', p.y + off);
          }
        });
        moving = mine;
        return mine.then(function () { if (moving === mine) { moving = null; token.setAttribute('visibility', 'hidden'); } });
      }
    };
    return api;
  };

  /** The legend of the four roles and the two types of line. */
  GE.legend = function (parts) {
    parts = parts || ['code', 'model', 'agent', 'person', 'lines'];
    var names = { code: 'Code', model: 'One model call', agent: 'Agent', person: 'Person' };
    var ul = GE.h('ul', { class: 'legend', 'aria-label': 'Legend' });
    parts.forEach(function (p) {
      if (p === 'lines') {
        ul.appendChild(GE.h('li', null, GE.h('span', { class: 'ln' }), 'Fixed'));
        ul.appendChild(GE.h('li', null, GE.h('span', { class: 'ln model' }), 'A model selects'));
      } else ul.appendChild(GE.h('li', null, GE.h('span', { class: 'role role-' + p }, names[p])));
    });
    return ul;
  };
})(window.GE);

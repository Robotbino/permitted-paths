/* graph-runner.js: a small interpreter for an execution graph.

   A graph is { start, nodes: [{id, act?}], edges: [{from, to, when?, p?}], owners? }.
   - node.act(state, ctx) does the work of the node and gives {writes, note, result}.
   - An edge with `when` is a conditional edge by code: the first edge that is correct is used.
   - An edge with `p` is a conditional edge by model: the runner selects one at random, with p as the weight.
   - owners[field] is the one node that can write the field. A write by a different node is an error.

   The runner makes no decision of its own. With the same graph, the same input and the same
   seed it always gives the same steps. */
(function (GE) {
  'use strict';

  GE.edgeKey = function (edge) { return edge.id || (edge.from + '>' + edge.to); };

  GE.runGraph = function (graph, ctx) {
    ctx = ctx || {};
    var rng = ctx.rng || GE.rng(1);
    var byId = {};
    graph.nodes.forEach(function (n) { byId[n.id] = n; });
    var state = Object.assign({}, ctx.initial || {});
    var steps = [];
    var id = graph.start;
    var maxSteps = ctx.maxSteps || 80; // a budget for the full run

    while (id) {
      if (steps.length >= maxSteps) { steps.push({ node: id, writes: {}, note: 'The budget of the run is used.', result: 'FAIL', edge: null, by: null, stopped: true }); break; }
      var node = byId[id];
      if (!node) throw new Error('The graph has no node "' + id + '".');
      var out = node.act ? (node.act(state, { rng: rng, scenario: ctx.scenario }) || {}) : {};
      var writes = out.writes || {};
      Object.keys(writes).forEach(function (field) {
        var owner = graph.owners && graph.owners[field];
        if (owner && owner !== id) throw new Error('Node "' + id + '" cannot write "' + field + '". The owner is "' + owner + '".');
      });
      Object.assign(state, writes);

      var candidates = graph.edges.filter(function (e) { return e.from === id && (!e.when || e.when(state)); });
      var weighted = candidates.filter(function (e) { return e.p != null; });
      var edge = weighted.length ? rng.weighted(weighted, function (e) { return e.p; }) : (candidates[0] || null);

      steps.push({
        node: id, writes: writes, note: out.note || '', result: out.result || null,
        edge: edge ? GE.edgeKey(edge) : null, by: edge ? (edge.p != null ? 'model' : 'code') : null
      });
      id = edge ? edge.to : null;
    }
    return { steps: steps, state: state, path: steps.map(function (s) { return s.node; }) };
  };

  /** Plays the steps of a run on a graph view: one node, then the travel along the edge. */
  var players = [];
  /** Pause each run. The router calls this when the learner goes to a different part. */
  GE.pauseAll = function () { players = players.filter(function (p) { p.pause(); return !p.isStopped(); }); };

  GE.player = function (view, steps, hooks) {
    hooks = hooks || {};
    var i = -1, playing = false, busy = false, dead = false;

    function advance(animate) {
      if (busy || dead || i >= steps.length - 1) return Promise.resolve(false);
      busy = true;
      var prev = steps[i];
      var travel = prev && prev.edge && animate ? view.travel(prev.edge, hooks.speed || 520) : Promise.resolve();
      return travel.then(function () {
        busy = false;
        if (dead) return false;
        if (prev) {
          view.mark(prev.node, 'active', false);
          view.mark(prev.node, prev.result === 'FAIL' ? 'failed' : 'done', true);
          if (prev.edge) view.markEdge(prev.edge, 'used', true);
        }
        i++;
        view.mark(steps[i].node, 'failed', false);
        view.mark(steps[i].node, 'active', true);
        if (hooks.onStep) hooks.onStep(steps[i], i);
        if (i >= steps.length - 1) {
          if (steps[i].result === 'FAIL') { view.mark(steps[i].node, 'active', false); view.mark(steps[i].node, 'failed', true); }
          if (hooks.onDone) hooks.onDone();
        }
        return true;
      });
    }
    // A stopped player says nothing more: a new player owns the drawing and the buttons.
    function state(s) { if (!dead && hooks.onState) hooks.onState(s); }
    // `gen` identifies one play loop. Pause, step and stop make the current loop stale,
    // so an old loop cannot continue or pause a newer one.
    var gen = 0;
    function play() {
      if (playing || dead) return;
      playing = true; state('playing');
      var mine = ++gen;
      (function loop() {
        if (!playing || dead || mine !== gen) return;
        if (busy) { GE.wait(60).then(loop); return; } // an earlier step is still on its edge
        advance(!GE.reduced()).then(function (moved) {
          if (dead || mine !== gen) return;
          if (!moved || i >= steps.length - 1) { playing = false; state(i >= steps.length - 1 ? 'done' : 'paused'); return; }
          GE.wait(GE.reduced() ? 420 : 240).then(loop);
        });
      })();
    }
    var api = {
      play: play,
      isStopped: function () { return dead; },
      isPlaying: function () { return playing; },
      pause: function () { if (playing) { playing = false; gen++; state('paused'); } },
      step: function () { playing = false; gen++; return advance(false).then(function () { state(i >= steps.length - 1 ? 'done' : 'paused'); }); },
      stop: function () { dead = true; playing = false; gen++; }
    };
    players.push(api);
    return api;
  };
})(window.GE);

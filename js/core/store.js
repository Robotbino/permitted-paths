/* store.js: what the learner did, kept in localStorage.
   The page works when localStorage is not available: the data then lives for one visit. */
(function (GE) {
  'use strict';
  var KEY = 'permitted-paths.v1';
  var data = load();
  var listeners = [];

  function blank() { return { started: Date.now(), values: {}, gates: {}, trace: [] }; }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      var isObject = function (x) { return x && typeof x === 'object' && !Array.isArray(x); };
      if (isObject(parsed) && isObject(parsed.values) && isObject(parsed.gates) && Array.isArray(parsed.trace)) {
        // Remove a gate record that does not have the shape that the gate reads.
        Object.keys(parsed.gates).forEach(function (k) { var g = parsed.gates[k]; if (!isObject(g) || !Array.isArray(g.results) || typeof g.status !== 'string') delete parsed.gates[k]; });
        // Keep only trace events with the shape that the page reads.
        parsed.trace = parsed.trace.filter(function (e) { return isObject(e) && typeof e.type === 'string' && (e.ch == null || typeof e.ch === 'string') && (e.detail == null || typeof e.detail === 'string'); });
        return parsed;
      }
    } catch (e) { /* private window, blocked storage or bad data: start a new run */ }
    return blank();
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* keep in memory only */ }
    notify();
  }
  function notify() {
    // One listener with an error must not stop the other listeners or the caller.
    listeners.forEach(function (fn) { try { fn(data); } catch (e) { console.error('A listener of the store has an error.', e); } });
  }
  // A second tab of the course changed the stored data: use it, so the two tabs do not erase the work of each other.
  window.addEventListener('storage', function (ev) { if (ev.key === KEY || ev.key === null) { data = load(); notify(); } });

  GE.store = {
    /** Gives the stored value only if it has the same type as the fallback (array, object, text, number). */
    get: function (key, fallback) {
      if (!Object.prototype.hasOwnProperty.call(data.values, key)) return fallback;
      var v = data.values[key];
      if (fallback === null || fallback === undefined) return v;
      if (Array.isArray(fallback)) return Array.isArray(v) ? v : fallback;
      if (typeof fallback === 'object') return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback;
      return typeof v === typeof fallback ? v : fallback;
    },
    set: function (key, value) { data.values[key] = value; save(); },
    gate: function (chapter) { return data.gates[chapter]; },
    setGate: function (chapter, result) { data.gates[chapter] = result; save(); },
    gates: function () { return data.gates; },
    started: function () { return data.started; },
    onChange: function (fn) { listeners.push(fn); },
    reset: function () { data = blank(); save(); }
  };

  /* The trace: the context graph of the learner's own run. Each event is one step. */
  GE.trace = {
    add: function (type, chapter, detail) {
      var last = data.trace[data.trace.length - 1];
      if (type === 'visit' && last && last.type === 'visit' && last.ch === chapter) return;
      data.trace.push({ t: Date.now(), type: type, ch: chapter, detail: detail || null });
      if (data.trace.length > 600) data.trace.splice(0, data.trace.length - 600);
      save();
    },
    /** Record the first use of an instrument only. */
    lab: function (name, chapter) {
      var seen = data.trace.some(function (e) { return e.type === 'lab' && e.detail === name; });
      if (!seen) GE.trace.add('lab', chapter, name);
    },
    all: function () { return data.trace.slice(); }
  };
})(window.GE);

/* motion.js: one shared animation loop. Each tween joins the loop and leaves it.
   The loop stops when nothing moves and when the tab is hidden.
   With prefers-reduced-motion a tween goes to its last frame immediately. */
(function (GE) {
  'use strict';
  var subscribers = [];
  var frame = 0;

  function tick(now) {
    frame = 0;
    subscribers.slice().forEach(function (fn) { fn(now); });
    if (subscribers.length && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && subscribers.length && !document.hidden) frame = requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', start);

  function join(fn) {
    subscribers.push(fn); start();
    return function leave() { var i = subscribers.indexOf(fn); if (i >= 0) subscribers.splice(i, 1); };
  }

  var ease = {
    out: function (t) { return 1 - Math.pow(1 - t, 4); },
    move: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    linear: function (t) { return t; }
  };

  /** tween({ms, ease, update(k)}) -> Promise. k goes from 0 to 1. Promise has .cancel(). */
  function tween(opts) {
    var cancel = function () {};
    var promise = new Promise(function (resolve) {
      if (GE.reduced() || !opts.ms) { opts.update(1); return resolve(); }
      var t0 = null, fn = ease[opts.ease || 'out'], leave;
      // A hidden tab does not get frames. Do not let a run hang there.
      var guard = setTimeout(function () { finish(); }, opts.ms + 1500);
      function finish() { clearTimeout(guard); if (leave) leave(); opts.update(1); resolve(); }
      leave = join(function (now) {
        if (t0 === null) t0 = now;
        var k = Math.min(1, (now - t0) / opts.ms);
        if (k >= 1) return finish();
        opts.update(fn(k));
      });
      cancel = finish;
    });
    promise.cancel = function () { cancel(); };
    return promise;
  }

  GE.motion = { join: join, tween: tween, ease: ease };
})(window.GE);

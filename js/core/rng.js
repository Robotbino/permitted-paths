/* rng.js: a seeded random number generator (mulberry32).
   Every simulation uses it, so the same seed always gives the same run. */
(function (GE) {
  'use strict';
  GE.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      seed: seed,
      next: next,
      chance: function (p) { return next() < p; },
      int: function (n) { return Math.floor(next() * n); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      /** Pick one item; weightOf(item) gives its weight. */
      weighted: function (list, weightOf) {
        var total = list.reduce(function (sum, x) { return sum + weightOf(x); }, 0);
        var r = next() * total;
        for (var i = 0; i < list.length; i++) { r -= weightOf(list[i]); if (r < 0) return list[i]; }
        return list[list.length - 1];
      },
      shuffle: function (list) {
        var out = list.slice();
        for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
        return out;
      }
    };
  };
  GE.newSeed = function () { return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0; };
})(window.GE);

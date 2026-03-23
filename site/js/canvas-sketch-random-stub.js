// Minimal stub for canvas-sketch-util/random
// Provides the random utilities used by homepage.min.js

const random = {
  range: function(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return min + Math.random() * (max - min);
  },
  rangeFloor: function(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return Math.floor(min + Math.random() * (max - min));
  },
  chance: function(p) {
    if (p === undefined) p = 0.5;
    return Math.random() < p;
  },
  pick: function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  shuffle: function(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
  gaussian: function(mean, std) {
    if (mean === undefined) mean = 0;
    if (std === undefined) std = 1;
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  },
  sign: function(p) {
    return random.chance(p) ? 1 : -1;
  },
  weighted: function(arr, weights) {
    var sum = weights.reduce(function(a, b) { return a + b; }, 0);
    var r = Math.random() * sum;
    for (var i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  },
  setSeed: function() {},
  getSeed: function() { return Math.random() * 0xFFFFFFFF | 0; },
};

export default random;
export const { range, rangeFloor, chance, pick, shuffle, gaussian, sign, weighted, setSeed, getSeed } = random;

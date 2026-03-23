import seedRandom from "/-/seed-random@v2.2.0-MDhOzbVVynb3PynjZnep/dist=es2019,mode=imports/optimized/seed-random.js";
import SimplexNoise from "/-/simplex-noise@v2.4.0-QVY6iED1CpGbDsx8QMWE/dist=es2019,mode=imports/optimized/simplex-noise.js";
import defined2 from "/-/defined@v1.0.0-9no1qxr2v2MbTaivujA4/dist=es2019,mode=imports/optimized/defined.js";
function createRandom(defaultSeed) {
  defaultSeed = defined2(defaultSeed, null);
  var defaultRandom = Math.random;
  var currentSeed;
  var currentRandom;
  var noiseGenerator;
  var _nextGaussian = null;
  var _hasNextGaussian = false;
  setSeed(defaultSeed);
  return {
    value,
    createRandom: function(defaultSeed2) {
      return createRandom(defaultSeed2);
    },
    setSeed,
    getSeed,
    getRandomSeed,
    valueNonZero,
    permuteNoise,
    noise1D,
    noise2D,
    noise3D,
    noise4D,
    sign,
    boolean,
    chance,
    range,
    rangeFloor,
    pick,
    shuffle,
    onCircle,
    insideCircle,
    onSphere,
    insideSphere,
    quaternion,
    weighted,
    weightedSet,
    weightedSetIndex,
    gaussian
  };
  function setSeed(seed, opt) {
    if (typeof seed === "number" || typeof seed === "string") {
      currentSeed = seed;
      currentRandom = seedRandom(currentSeed, opt);
    } else {
      currentSeed = void 0;
      currentRandom = defaultRandom;
    }
    noiseGenerator = createNoise();
    _nextGaussian = null;
    _hasNextGaussian = false;
  }
  function value() {
    return currentRandom();
  }
  function valueNonZero() {
    var u = 0;
    while (u === 0)
      u = value();
    return u;
  }
  function getSeed() {
    return currentSeed;
  }
  function getRandomSeed() {
    var seed = String(Math.floor(Math.random() * 1e6));
    return seed;
  }
  function createNoise() {
    return new SimplexNoise(currentRandom);
  }
  function permuteNoise() {
    noiseGenerator = createNoise();
  }
  function noise1D(x, frequency, amplitude) {
    if (!isFinite(x))
      throw new TypeError("x component for noise() must be finite");
    frequency = defined2(frequency, 1);
    amplitude = defined2(amplitude, 1);
    return amplitude * noiseGenerator.noise2D(x * frequency, 0);
  }
  function noise2D(x, y, frequency, amplitude) {
    if (!isFinite(x))
      throw new TypeError("x component for noise() must be finite");
    if (!isFinite(y))
      throw new TypeError("y component for noise() must be finite");
    frequency = defined2(frequency, 1);
    amplitude = defined2(amplitude, 1);
    return amplitude * noiseGenerator.noise2D(x * frequency, y * frequency);
  }
  function noise3D(x, y, z, frequency, amplitude) {
    if (!isFinite(x))
      throw new TypeError("x component for noise() must be finite");
    if (!isFinite(y))
      throw new TypeError("y component for noise() must be finite");
    if (!isFinite(z))
      throw new TypeError("z component for noise() must be finite");
    frequency = defined2(frequency, 1);
    amplitude = defined2(amplitude, 1);
    return amplitude * noiseGenerator.noise3D(x * frequency, y * frequency, z * frequency);
  }
  function noise4D(x, y, z, w, frequency, amplitude) {
    if (!isFinite(x))
      throw new TypeError("x component for noise() must be finite");
    if (!isFinite(y))
      throw new TypeError("y component for noise() must be finite");
    if (!isFinite(z))
      throw new TypeError("z component for noise() must be finite");
    if (!isFinite(w))
      throw new TypeError("w component for noise() must be finite");
    frequency = defined2(frequency, 1);
    amplitude = defined2(amplitude, 1);
    return amplitude * noiseGenerator.noise4D(x * frequency, y * frequency, z * frequency, w * frequency);
  }
  function sign() {
    return boolean() ? 1 : -1;
  }
  function boolean() {
    return value() > 0.5;
  }
  function chance(n) {
    n = defined2(n, 0.5);
    if (typeof n !== "number")
      throw new TypeError("expected n to be a number");
    return value() < n;
  }
  function range(min, max) {
    if (max === void 0) {
      max = min;
      min = 0;
    }
    if (typeof min !== "number" || typeof max !== "number") {
      throw new TypeError("Expected all arguments to be numbers");
    }
    return value() * (max - min) + min;
  }
  function rangeFloor(min, max) {
    if (max === void 0) {
      max = min;
      min = 0;
    }
    if (typeof min !== "number" || typeof max !== "number") {
      throw new TypeError("Expected all arguments to be numbers");
    }
    return Math.floor(range(min, max));
  }
  function pick(array) {
    if (array.length === 0)
      return void 0;
    return array[rangeFloor(0, array.length)];
  }
  function shuffle(arr) {
    if (!Array.isArray(arr)) {
      throw new TypeError("Expected Array, got " + typeof arr);
    }
    var rand;
    var tmp;
    var len = arr.length;
    var ret = arr.slice();
    while (len) {
      rand = Math.floor(value() * len--);
      tmp = ret[len];
      ret[len] = ret[rand];
      ret[rand] = tmp;
    }
    return ret;
  }
  function onCircle(radius, out) {
    radius = defined2(radius, 1);
    out = out || [];
    var theta = value() * 2 * Math.PI;
    out[0] = radius * Math.cos(theta);
    out[1] = radius * Math.sin(theta);
    return out;
  }
  function insideCircle(radius, out) {
    radius = defined2(radius, 1);
    out = out || [];
    onCircle(1, out);
    var r = radius * Math.sqrt(value());
    out[0] *= r;
    out[1] *= r;
    return out;
  }
  function onSphere(radius, out) {
    radius = defined2(radius, 1);
    out = out || [];
    var u = value() * Math.PI * 2;
    var v = value() * 2 - 1;
    var phi = u;
    var theta = Math.acos(v);
    out[0] = radius * Math.sin(theta) * Math.cos(phi);
    out[1] = radius * Math.sin(theta) * Math.sin(phi);
    out[2] = radius * Math.cos(theta);
    return out;
  }
  function insideSphere(radius, out) {
    radius = defined2(radius, 1);
    out = out || [];
    var u = value() * Math.PI * 2;
    var v = value() * 2 - 1;
    var k = value();
    var phi = u;
    var theta = Math.acos(v);
    var r = radius * Math.cbrt(k);
    out[0] = r * Math.sin(theta) * Math.cos(phi);
    out[1] = r * Math.sin(theta) * Math.sin(phi);
    out[2] = r * Math.cos(theta);
    return out;
  }
  function quaternion(out) {
    out = out || [];
    var u1 = value();
    var u2 = value();
    var u3 = value();
    var sq1 = Math.sqrt(1 - u1);
    var sq2 = Math.sqrt(u1);
    var theta1 = Math.PI * 2 * u2;
    var theta2 = Math.PI * 2 * u3;
    var x = Math.sin(theta1) * sq1;
    var y = Math.cos(theta1) * sq1;
    var z = Math.sin(theta2) * sq2;
    var w = Math.cos(theta2) * sq2;
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
  }
  function weightedSet(set) {
    set = set || [];
    if (set.length === 0)
      return null;
    return set[weightedSetIndex(set)].value;
  }
  function weightedSetIndex(set) {
    set = set || [];
    if (set.length === 0)
      return -1;
    return weighted(set.map(function(s) {
      return s.weight;
    }));
  }
  function weighted(weights) {
    weights = weights || [];
    if (weights.length === 0)
      return -1;
    var totalWeight = 0;
    var i;
    for (i = 0; i < weights.length; i++) {
      totalWeight += weights[i];
    }
    if (totalWeight <= 0)
      throw new Error("Weights must sum to > 0");
    var random = value() * totalWeight;
    for (i = 0; i < weights.length; i++) {
      if (random < weights[i]) {
        return i;
      }
      random -= weights[i];
    }
    return 0;
  }
  function gaussian(mean, standardDerivation) {
    mean = defined2(mean, 0);
    standardDerivation = defined2(standardDerivation, 1);
    if (_hasNextGaussian) {
      _hasNextGaussian = false;
      var result = _nextGaussian;
      _nextGaussian = null;
      return mean + standardDerivation * result;
    } else {
      var v1 = 0;
      var v2 = 0;
      var s = 0;
      do {
        v1 = value() * 2 - 1;
        v2 = value() * 2 - 1;
        s = v1 * v1 + v2 * v2;
      } while (s >= 1 || s === 0);
      var multiplier = Math.sqrt(-2 * Math.log(s) / s);
      _nextGaussian = v2 * multiplier;
      _hasNextGaussian = true;
      return mean + standardDerivation * (v1 * multiplier);
    }
  }
}
var __VIRTUAL_FILE = createRandom();
export default __VIRTUAL_FILE;

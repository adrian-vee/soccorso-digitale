// Local stub for canvas-sketch-util/random
// Includes SimplexNoise for 3D canvas effects

// ── SimplexNoise (adapted from Jonas Wagner's implementation, public domain) ──
var _grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
var _p = [];
for(var _i=0;_i<256;_i++) _p[_i]=Math.floor(Math.random()*256);
var _perm = new Array(512), _permMod12 = new Array(512);
for(var _i=0;_i<512;_i++){_perm[_i]=_p[_i&255];_permMod12[_i]=_perm[_i]%12;}

function _dot3(g,x,y,z){return g[0]*x+g[1]*y+g[2]*z;}

function _simplex3(xin,yin,zin){
  var n0,n1,n2,n3;
  var F3=1/3,G3=1/6;
  var s=(xin+yin+zin)*F3,i=Math.floor(xin+s),j=Math.floor(yin+s),k=Math.floor(zin+s);
  var t=(i+j+k)*G3,X0=i-t,Y0=j-t,Z0=k-t;
  var x0=xin-X0,y0=yin-Y0,z0=zin-Z0;
  var i1,j1,k1,i2,j2,k2;
  if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}}
  else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}}
  var x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
  var x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
  var x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
  var ii=i&255,jj=j&255,kk=k&255;
  var gi0=_permMod12[ii+_perm[jj+_perm[kk]]];
  var gi1=_permMod12[ii+i1+_perm[jj+j1+_perm[kk+k1]]];
  var gi2=_permMod12[ii+i2+_perm[jj+j2+_perm[kk+k2]]];
  var gi3=_permMod12[ii+1+_perm[jj+1+_perm[kk+1]]];
  var t0=0.6-x0*x0-y0*y0-z0*z0;
  if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*_dot3(_grad3[gi0],x0,y0,z0);}
  var t1=0.6-x1*x1-y1*y1-z1*z1;
  if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*_dot3(_grad3[gi1],x1,y1,z1);}
  var t2=0.6-x2*x2-y2*y2-z2*z2;
  if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*_dot3(_grad3[gi2],x2,y2,z2);}
  var t3=0.6-x3*x3-y3*y3-z3*z3;
  if(t3<0)n3=0;else{t3*=t3;n3=t3*t3*_dot3(_grad3[gi3],x3,y3,z3);}
  return 32*(n0+n1+n2+n3);
}

// ── Main random API (matching canvas-sketch-util/random) ──
var _seed = Date.now();
function _seededRand() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}

const random = {
  // Noise
  noise3D: function(x, y, z) { return _simplex3(x, y, z); },
  noise2D: function(x, y) { return _simplex3(x, y, 0); },

  // Seed
  setSeed: function(s) { if (s != null) _seed = s; },
  getSeed: function() { return _seed; },
  getRandomSeed: function() { return Math.floor(Math.random() * 0xFFFFFF); },

  // Core
  value: function() { return Math.random(); },
  valueNonZero: function() { var v; do { v = Math.random(); } while(v === 0); return v; },

  // Range
  range: function(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return min + Math.random() * (max - min);
  },
  rangeFloor: function(min, max) {
    if (max === undefined) { max = min; min = 0; }
    return Math.floor(min + Math.random() * (max - min));
  },

  // Boolean
  chance: function(p) { return Math.random() < (p == null ? 0.5 : p); },
  sign: function(p) { return random.chance(p) ? 1 : -1; },
  boolean: function(p) { return random.chance(p); },

  // Array
  pick: function(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle: function(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  },
  weighted: function(arr, weights) {
    var sum = weights.reduce(function(a, b) { return a + b; }, 0);
    var r = Math.random() * sum;
    for (var i = 0; i < arr.length; i++) {
      r -= weights[i]; if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  },
  weightedSet: function(arr) {
    return random.weighted(arr.map(function(o){return o.value;}), arr.map(function(o){return o.weight;}));
  },

  // Distribution
  gaussian: function(mean, std) {
    if (mean === undefined) mean = 0;
    if (std === undefined) std = 1;
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },

  // Quaternion / on-sphere
  onCircle: function(radius) {
    var theta = Math.random() * Math.PI * 2;
    return [Math.cos(theta) * (radius||1), Math.sin(theta) * (radius||1)];
  },
  insideCircle: function(radius) {
    var r = Math.sqrt(Math.random()) * (radius||1);
    var theta = Math.random() * Math.PI * 2;
    return [Math.cos(theta) * r, Math.sin(theta) * r];
  },
  onSphere: function(radius) {
    var u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2;
    var f = Math.sqrt(1 - u * u);
    return [f * Math.cos(t) * (radius||1), f * Math.sin(t) * (radius||1), u * (radius||1)];
  },
  insideSphere: function(radius) {
    var u = Math.pow(Math.random(), 1/3);
    var v = random.onSphere(1);
    return v.map(function(x){return x*u*(radius||1);});
  },

  // Quaternion random rotation
  quaternion: function() {
    var u1=Math.random(),u2=Math.random(),u3=Math.random();
    var s=Math.sqrt(1-u1),t=Math.sqrt(u1);
    return [s*Math.sin(2*Math.PI*u2),s*Math.cos(2*Math.PI*u2),t*Math.sin(2*Math.PI*u3),t*Math.cos(2*Math.PI*u3)];
  },
};

export default random;
export const {
  noise3D, noise2D,
  setSeed, getSeed, getRandomSeed,
  value, valueNonZero,
  range, rangeFloor,
  chance, sign, boolean,
  pick, shuffle, weighted, weightedSet,
  gaussian,
  onCircle, insideCircle, onSphere, insideSphere,
  quaternion,
} = random;

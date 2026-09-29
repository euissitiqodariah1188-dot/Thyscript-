'use strict';

/**
 * ThyMathLib - ThyScript Standard Math Library
 * Provides comprehensive math operations: linear algebra, calculus, statistics,
 * FFT, ML activations, number theory, and more.
 */

let math;
try {
  math = require('mathjs');
} catch {
  math = null;
}

class ThyMathLib {
  // ─── Constants ────────────────────────────────────────────────────────────
  static PI    = Math.PI;
  static E     = Math.E;
  static PHI   = (1 + Math.sqrt(5)) / 2;
  static SQRT2 = Math.SQRT2;
  static LN2   = Math.LN2;
  static LN10  = Math.LN10;
  static TAU   = Math.PI * 2;
  static INF   = Infinity;
  static NAN   = NaN;

  // ─── Expression Evaluation ────────────────────────────────────────────────

  /**
   * Evaluate a math expression string using mathjs (or fallback to Function).
   * @param {string} expr
   * @returns {*}
   */
  calculate(expr) {
    if (math) {
      return math.evaluate(expr);
    }
    // Safe-ish fallback: only allow math-like expressions
    const allowed = /^[0-9+\-*/().^%\s,e a-zA-Z]+$/;
    if (!allowed.test(expr)) throw new Error(`ThyMathLib: Unsafe expression: ${expr}`);
    return Function(`"use strict"; with(Math){ return (${expr}); }`)(); // eslint-disable-line no-new-func
  }

  // ─── Matrix / Vector / Tensor ─────────────────────────────────────────────

  /**
   * Create a mathjs matrix from a 2D array.
   * @param {number[][]} data
   * @returns {object}
   */
  matrix(data) {
    if (math) return math.matrix(data);
    return { type: 'matrix', data, rows: data.length, cols: data[0]?.length ?? 0 };
  }

  /**
   * Create a vector (1D array wrapper).
   * @param {number[]} data
   * @returns {object}
   */
  vector(data) {
    if (!Array.isArray(data)) throw new TypeError('ThyMathLib.vector: expected array');
    return { type: 'vector', data, length: data.length };
  }

  /**
   * Create a tensor-like structure.
   * @param {number[]} shape  e.g. [2,3,4]
   * @param {number[]} data   flat data array
   * @returns {object}
   */
  tensor(shape, data) {
    const size = shape.reduce((a, b) => a * b, 1);
    if (data && data.length !== size) throw new RangeError(`ThyMathLib.tensor: data length ${data.length} doesn't match shape ${shape}`);
    return { type: 'tensor', shape, data: data ?? new Float64Array(size), size };
  }

  // ─── Interpolation & Clamping ─────────────────────────────────────────────

  /** Linear interpolation between a and b by factor t. */
  lerp(a, b, t) { return a + (b - a) * t; }

  /** Clamp v to [min, max]. */
  clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  // ─── Vector Operations ────────────────────────────────────────────────────

  /** Normalize a vector (returns plain array). */
  normalize(v) {
    const arr = Array.isArray(v) ? v : v.data;
    const mag = this.magnitude(arr);
    if (mag === 0) throw new Error('ThyMathLib.normalize: zero-length vector');
    return arr.map(x => x / mag);
  }

  /** Dot product of two vectors. */
  dot(a, b) {
    const av = Array.isArray(a) ? a : a.data;
    const bv = Array.isArray(b) ? b : b.data;
    if (av.length !== bv.length) throw new RangeError('ThyMathLib.dot: dimension mismatch');
    return av.reduce((sum, x, i) => sum + x * bv[i], 0);
  }

  /** Cross product of two 3D vectors. */
  cross(a, b) {
    const av = Array.isArray(a) ? a : a.data;
    const bv = Array.isArray(b) ? b : b.data;
    if (av.length !== 3 || bv.length !== 3) throw new RangeError('ThyMathLib.cross: only 3D supported');
    return [
      av[1] * bv[2] - av[2] * bv[1],
      av[2] * bv[0] - av[0] * bv[2],
      av[0] * bv[1] - av[1] * bv[0],
    ];
  }

  /** Euclidean magnitude (L2 norm) of a vector. */
  magnitude(v) {
    const arr = Array.isArray(v) ? v : v.data;
    return Math.sqrt(arr.reduce((s, x) => s + x * x, 0));
  }

  /** Euclidean distance between two points (arrays). */
  distance(a, b) {
    const av = Array.isArray(a) ? a : a.data;
    const bv = Array.isArray(b) ? b : b.data;
    if (av.length !== bv.length) throw new RangeError('ThyMathLib.distance: dimension mismatch');
    return Math.sqrt(av.reduce((s, x, i) => s + (x - bv[i]) ** 2, 0));
  }

  // ─── Matrix Operations ────────────────────────────────────────────────────

  /** Matrix determinant (plain 2D array). Uses LU decomposition. */
  determinant(m) {
    const data = Array.isArray(m) ? m : m.data;
    if (math) return math.det(data);
    return this._det(data.map(r => [...r]));
  }

  _det(m) {
    const n = m.length;
    if (n === 1) return m[0][0];
    if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
    let sign = 1, det = 0;
    for (let col = 0; col < n; col++) {
      const sub = m.slice(1).map(r => r.filter((_, c) => c !== col));
      det += sign * m[0][col] * this._det(sub);
      sign *= -1;
    }
    return det;
  }

  /** Matrix inverse (uses mathjs or Gauss-Jordan). */
  inverse(m) {
    const data = Array.isArray(m) ? m : m.data;
    if (math) return math.inv(data);
    return this._gaussJordanInverse(data.map(r => [...r]));
  }

  _gaussJordanInverse(m) {
    const n = m.length;
    const aug = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
      }
      [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
      const d = aug[col][col];
      if (Math.abs(d) < 1e-12) throw new Error('ThyMathLib.inverse: matrix is singular');
      for (let j = 0; j < 2 * n; j++) aug[col][j] /= d;
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const f = aug[row][col];
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
      }
    }
    return aug.map(r => r.slice(n));
  }

  /** Transpose a 2D matrix. */
  transpose(m) {
    const data = Array.isArray(m) ? m : m.data;
    if (math) return math.transpose(data);
    const rows = data.length, cols = data[0].length;
    return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => data[r][c]));
  }

  // ─── Calculus ─────────────────────────────────────────────────────────────

  /** Numerical gradient (central difference). */
  gradient(fn, x, h = 1e-7) { return (fn(x + h) - fn(x - h)) / (2 * h); }

  /** Numerical integration using Simpson's 1/3 rule. */
  integrate(fn, a, b, steps = 1000) {
    if (steps % 2 !== 0) steps++;
    const h = (b - a) / steps;
    let sum = fn(a) + fn(b);
    for (let i = 1; i < steps; i++) {
      sum += fn(a + i * h) * (i % 2 === 0 ? 2 : 4);
    }
    return (h / 3) * sum;
  }

  /** Numerical differentiation (central difference). */
  differentiate(fn, x, h = 1e-7) { return this.gradient(fn, x, h); }

  // ─── Linear System Solver ─────────────────────────────────────────────────

  /** Solve Ax = b using Gaussian elimination with partial pivoting. */
  solve(A, b) {
    const n = A.length;
    const M = A.map((r, i) => [...r, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
      }
      [M[col], M[pivot]] = [M[pivot], M[col]];
      if (Math.abs(M[col][col]) < 1e-12) throw new Error('ThyMathLib.solve: singular matrix');
      for (let row = col + 1; row < n; row++) {
        const f = M[row][col] / M[col][col];
        for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = M[i][n];
      for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
      x[i] /= M[i][i];
    }
    return x;
  }

  // ─── FFT ─────────────────────────────────────────────────────────────────

  /** Cooley-Tukey radix-2 FFT. Input must be power-of-2 length. Returns [{re,im}]. */
  fft(signal) {
    const n = signal.length;
    if (n === 1) return [{ re: signal[0].re ?? signal[0], im: signal[0].im ?? 0 }];
    if ((n & (n - 1)) !== 0) throw new RangeError('ThyMathLib.fft: length must be power of 2');
    const even = this.fft(signal.filter((_, i) => i % 2 === 0));
    const odd  = this.fft(signal.filter((_, i) => i % 2 !== 0));
    const result = new Array(n);
    for (let k = 0; k < n / 2; k++) {
      const angle = -2 * Math.PI * k / n;
      const tRe = Math.cos(angle) * odd[k].re - Math.sin(angle) * odd[k].im;
      const tIm = Math.cos(angle) * odd[k].im + Math.sin(angle) * odd[k].re;
      result[k]         = { re: even[k].re + tRe, im: even[k].im + tIm };
      result[k + n / 2] = { re: even[k].re - tRe, im: even[k].im - tIm };
    }
    return result;
  }

  /** Inverse FFT. */
  ifft(spectrum) {
    const conj = spectrum.map(s => ({ re: s.re, im: -(s.im ?? 0) }));
    const fwdResult = this.fft(conj);
    const n = fwdResult.length;
    return fwdResult.map(s => ({ re: s.re / n, im: -s.im / n }));
  }

  // ─── Trigonometric & Transcendental ───────────────────────────────────────

  sin(x)   { return Math.sin(x); }
  cos(x)   { return Math.cos(x); }
  tan(x)   { return Math.tan(x); }
  asin(x)  { return Math.asin(x); }
  acos(x)  { return Math.acos(x); }
  atan(x)  { return Math.atan(x); }
  atan2(y, x) { return Math.atan2(y, x); }
  sinh(x)  { return Math.sinh(x); }
  cosh(x)  { return Math.cosh(x); }
  tanh(x)  { return Math.tanh(x); }
  log(x)   { return Math.log(x); }
  log2(x)  { return Math.log2(x); }
  log10(x) { return Math.log10(x); }
  exp(x)   { return Math.exp(x); }
  pow(x, y){ return Math.pow(x, y); }
  sqrt(x)  { return Math.sqrt(x); }
  cbrt(x)  { return Math.cbrt(x); }
  abs(x)   { return Math.abs(x); }
  ceil(x)  { return Math.ceil(x); }
  floor(x) { return Math.floor(x); }
  round(x) { return Math.round(x); }
  trunc(x) { return Math.trunc(x); }
  sign(x)  { return Math.sign(x); }
  hypot(...args) { return Math.hypot(...args); }

  // ─── Seeded Random ────────────────────────────────────────────────────────

  /**
   * Seeded pseudo-random generator (mulberry32).
   * @param {number} seed
   * @returns {function} - call to get next random in [0,1)
   */
  random(seed = Date.now()) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ─── Statistics ───────────────────────────────────────────────────────────

  /**
   * Compute descriptive statistics for an array.
   * @param {number[]} data
   * @returns {{ mean, median, std, variance, min, max, count }}
   */
  stats(data) {
    if (!data || data.length === 0) throw new RangeError('ThyMathLib.stats: empty dataset');
    const n = data.length;
    const sorted = [...data].sort((a, b) => a - b);
    const mean = data.reduce((s, x) => s + x, 0) / n;
    const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const mid = Math.floor(n / 2);
    const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return { mean, median, std, variance, min: sorted[0], max: sorted[n - 1], count: n };
  }

  // ─── Combinatorics ────────────────────────────────────────────────────────

  /** Number of permutations P(n, k). */
  permutations(n, k) { return this.factorial(n) / this.factorial(n - k); }

  /** Number of combinations C(n, k). */
  combinations(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
  }

  // ─── Number Theory ────────────────────────────────────────────────────────

  /** Check if n is prime. */
  isPrime(n) {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }

  /** Return the nth prime (1-indexed). */
  prime(n) {
    if (n < 1) throw new RangeError('ThyMathLib.prime: n must be >= 1');
    let count = 0, num = 1;
    while (count < n) { num++; if (this.isPrime(num)) count++; }
    return num;
  }

  /** Fibonacci number (iterative). */
  fibonacci(n) {
    if (n < 0) throw new RangeError('ThyMathLib.fibonacci: n must be >= 0');
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return b;
  }

  /** Greatest common divisor (Euclidean). */
  gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }

  /** Least common multiple. */
  lcm(a, b) { return Math.abs(a * b) / this.gcd(a, b); }

  /** Factorial (iterative, returns BigInt for n > 18). */
  factorial(n) {
    if (n < 0) throw new RangeError('ThyMathLib.factorial: n must be >= 0');
    if (n <= 1) return 1;
    if (n > 18) {
      let r = 1n;
      for (let i = 2n; i <= BigInt(n); i++) r *= i;
      return r;
    }
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // ─── ML Activations ───────────────────────────────────────────────────────

  /** Sigmoid activation: 1 / (1 + e^-x). */
  sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  /** ReLU activation: max(0, x). */
  relu(x) { return Math.max(0, x); }

  /** Softmax of an array (numerically stable). */
  softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }
}

module.exports = ThyMathLib;

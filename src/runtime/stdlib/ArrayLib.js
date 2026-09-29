'use strict';
/**
 * ThyScript Array Library
 * High-performance array and collection manipulation functions
 */

class ThyArrayLib {
  // ─── Functional Iterators ──────────────────────────────────────────────────
  static map(arr, fn) { return arr.map(fn); }
  static filter(arr, fn) { return arr.filter(fn); }
  static reduce(arr, fn, init) { return init !== undefined ? arr.reduce(fn, init) : arr.reduce(fn); }
  static forEach(arr, fn) { arr.forEach(fn); }
  static find(arr, fn) { return arr.find(fn); }
  static findIndex(arr, fn) { return arr.findIndex(fn); }
  static some(arr, fn) { return arr.some(fn); }
  static every(arr, fn) { return arr.every(fn); }
  static includes(arr, val) { return arr.includes(val); }

  // ─── Sorting & Shuffling ───────────────────────────────────────────────────
  static sort(arr, fn) { return [...arr].sort(fn); }
  static sortBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    return [...arr].sort((a, b) => {
      const va = fn(a), vb = fn(b);
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
  }
  static sortDesc(arr) { return [...arr].sort((a, b) => b - a); }
  static shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ─── Transformations ───────────────────────────────────────────────────────
  static flatten(arr, depth = 1) { return arr.flat(depth); }
  static flatMap(arr, fn) { return arr.flatMap(fn); }
  static chunk(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
  static zip(...arrays) {
    const maxLen = Math.max(...arrays.map(a => a.length));
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push(arrays.map(a => a[i]));
    }
    return result;
  }
  static unzip(arr) {
    if (!arr.length) return [];
    return arr[0].map((_, i) => arr.map(row => row[i]));
  }

  // ─── Set Operations ────────────────────────────────────────────────────────
  static unique(arr) { return [...new Set(arr)]; }
  static uniqueBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    const seen = new Set();
    return arr.filter(item => {
      const val = fn(item);
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  static intersect(a, b) {
    const setB = new Set(b);
    return a.filter(x => setB.has(x));
  }
  static union(a, b) { return [...new Set([...a, ...b])]; }
  static difference(a, b) {
    const setB = new Set(b);
    return a.filter(x => !setB.has(x));
  }

  // ─── Grouping & Aggregation ────────────────────────────────────────────────
  static groupBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    return arr.reduce((acc, item) => {
      const k = fn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  }
  static countBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    return arr.reduce((acc, item) => {
      const k = fn(item);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }
  static partitionBy(arr, fn) {
    const pass = [], fail = [];
    for (const item of arr) {
      (fn(item) ? pass : fail).push(item);
    }
    return [pass, fail];
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────
  static first(arr, n = 1) { return n === 1 ? arr[0] : arr.slice(0, n); }
  static last(arr, n = 1) { return n === 1 ? arr[arr.length - 1] : arr.slice(-n); }
  static nth(arr, n) { return n < 0 ? arr[arr.length + n] : arr[n]; }
  static take(arr, n) { return arr.slice(0, n); }
  static drop(arr, n) { return arr.slice(n); }
  static dropRight(arr, n) { return arr.slice(0, -n); }

  // ─── Math & Statistics ─────────────────────────────────────────────────────
  static sum(arr) { return arr.reduce((acc, x) => acc + x, 0); }
  static avg(arr) { return arr.length ? arr.reduce((acc, x) => acc + x, 0) / arr.length : 0; }
  static min(arr) { return Math.min(...arr); }
  static max(arr) { return Math.max(...arr); }
  static minBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    return arr.reduce((min, item) => fn(item) < fn(min) ? item : min, arr[0]);
  }
  static maxBy(arr, key) {
    const fn = typeof key === 'function' ? key : (item) => item[key];
    return arr.reduce((max, item) => fn(item) > fn(max) ? item : max, arr[0]);
  }

  // ─── Generation & Manipulation ─────────────────────────────────────────────
  static range(start, end, step = 1) {
    if (end === undefined) { end = start; start = 0; }
    const result = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) result.push(i);
    } else {
      for (let i = start; i > end; i += step) result.push(i);
    }
    return result;
  }
  static rotate(arr, n) {
    const len = arr.length;
    if (!len) return arr;
    const offset = ((n % len) + len) % len;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  }
  static reverse(arr) { return [...arr].reverse(); }
  static compact(arr) { return arr.filter(Boolean); }

  // ─── 2D Matrix Operations ──────────────────────────────────────────────────
  static matrix2D(rows, cols, fillVal = 0) {
    return Array.from({ length: rows }, () => new Array(cols).fill(fillVal));
  }
  static matrixTranspose(mat) {
    if (!mat.length) return [];
    return mat[0].map((_, c) => mat.map(row => row[c]));
  }
  static matrixMultiply(a, b) {
    const rowsA = a.length, colsA = a[0].length, colsB = b[0].length;
    const result = ThyArrayLib.matrix2D(rowsA, colsB, 0);
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  // ─── Algorithms ────────────────────────────────────────────────────────────
  static binarySearch(arr, target, compareFn) {
    let low = 0, high = arr.length - 1;
    const cmp = compareFn || ((a, b) => a < b ? -1 : a > b ? 1 : 0);
    while (low <= high) {
      const mid = (low + high) >> 1;
      const c = cmp(arr[mid], target);
      if (c === 0) return mid;
      if (c < 0) low = mid + 1;
      else high = mid - 1;
    }
    return -1;
  }

  static slidingWindow(arr, size, step = 1) {
    const result = [];
    for (let i = 0; i <= arr.length - size; i += step) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  static movingAverage(arr, windowSize) {
    const result = [];
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= windowSize) sum -= arr[i - windowSize];
      if (i >= windowSize - 1) result.push(sum / windowSize);
    }
    return result;
  }
}

module.exports = ThyArrayLib;

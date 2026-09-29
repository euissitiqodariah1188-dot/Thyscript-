'use strict';

/**
 * MemoryManager.js — ThyScript Memory Management & Heap Tracking
 *
 * Tracks object allocations, monitors heap health, triggers GC, and
 * can produce V8 heap snapshots for offline analysis.
 */

const v8 = require('v8');
const { EventEmitter } = require('events');

// Default limits
const DEFAULT_LIMIT_MB    = 512;          // warn above 80% of this
const DEFAULT_CHECK_MS    = 5000;         // periodic check interval
const HIGH_MEMORY_PCT     = 0.80;         // 80% threshold

class MemoryManager extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.limitMB=512]   - heap limit in megabytes
   * @param {number} [opts.checkMs=5000]  - interval for periodic checks
   * @param {boolean} [opts.autoCheck=true] - start periodic checks automatically
   */
  constructor(opts = {}) {
    super();

    this._limitBytes   = (opts.limitMB  ?? DEFAULT_LIMIT_MB)  * 1024 * 1024;
    this._checkMs      = opts.checkMs   ?? DEFAULT_CHECK_MS;
    this._autoCheck    = opts.autoCheck ?? true;

    /** @type {Map<string, WeakRef|{ref:any}>} */
    this._tracked      = new Map();

    /** allocation counter */
    this._allocated    = 0;
    /** release counter */
    this._released     = 0;

    /** periodic check timer */
    this._timer        = null;

    /** high-memory callbacks */
    this._highMemCbs   = [];

    if (this._autoCheck) this._startPeriodicCheck();
  }

  // ─── Periodic check ────────────────────────────────────────────────────────

  _startPeriodicCheck() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const warning = this.checkLeak();
      if (warning) {
        this.emit('highMemory', warning);
        this._highMemCbs.forEach(cb => {
          try { cb(warning); } catch {}
        });
      }
    }, this._checkMs);

    // Do not keep the process alive just for memory monitoring
    if (this._timer.unref) this._timer.unref();
  }

  _stopPeriodicCheck() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  startMonitoring(intervalMs) {
    if (intervalMs) this._checkMs = intervalMs;
    this._startPeriodicCheck();
    return this;
  }

  stopMonitoring() {
    this._stopPeriodicCheck();
    return this;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Track an object allocation.
   * Uses WeakRef when available so tracking does not prevent GC.
   *
   * @param {string} name  - identifier for this allocation
   * @param {object} ref   - the object to track
   */
  track(name, ref) {
    if (ref !== null && typeof ref === 'object' && typeof WeakRef !== 'undefined') {
      this._tracked.set(name, { type: 'weak', ref: new WeakRef(ref) });
    } else {
      this._tracked.set(name, { type: 'strong', ref });
    }
    this._allocated++;
    this.emit('track', name);
  }

  /**
   * Release a tracked reference.
   * @param {string} name
   */
  release(name) {
    if (this._tracked.has(name)) {
      this._tracked.delete(name);
      this._released++;
      this.emit('release', name);
      return true;
    }
    return false;
  }

  /**
   * Check how many tracked objects are still alive (WeakRef targets not GC'd).
   * @returns {number}
   */
  liveCount() {
    let alive = 0;
    for (const [, entry] of this._tracked) {
      if (entry.type === 'strong') { alive++; continue; }
      const deref = entry.ref.deref();
      if (deref !== undefined) alive++;
    }
    return alive;
  }

  /**
   * Get combined memory statistics.
   * @returns {{heapUsed:number, heapTotal:number, external:number, rss:number,
   *            allocated:number, released:number, live:number,
   *            limitBytes:number, usagePct:number, v8HeapStats:object}}
   */
  getStats() {
    const mu       = process.memoryUsage();
    const v8Stats  = v8.getHeapStatistics();
    const usagePct = mu.heapUsed / this._limitBytes;

    return {
      heapUsed:   mu.heapUsed,
      heapTotal:  mu.heapTotal,
      external:   mu.external,
      rss:        mu.rss,
      arrayBuffers: mu.arrayBuffers ?? 0,
      allocated:  this._allocated,
      released:   this._released,
      live:       this.liveCount(),
      limitBytes: this._limitBytes,
      usagePct:   Math.min(1, usagePct),
      v8HeapStats,
    };
  }

  /**
   * Check for a potential memory leak (heap > threshold).
   * @returns {string|null} warning message or null if healthy
   */
  checkLeak() {
    const mu      = process.memoryUsage();
    const pct     = mu.heapUsed / this._limitBytes;
    const usedMB  = (mu.heapUsed  / 1024 / 1024).toFixed(1);
    const limitMB = (this._limitBytes / 1024 / 1024).toFixed(0);

    if (pct >= HIGH_MEMORY_PCT) {
      return `Heap usage is ${(pct * 100).toFixed(1)}% (${usedMB} MB / ${limitMB} MB limit). Consider calling gc() or releasing references.`;
    }
    return null;
  }

  /**
   * Set the memory limit in bytes.
   * @param {number} bytes
   */
  setLimit(bytes) {
    if (typeof bytes !== 'number' || bytes <= 0) {
      throw new RangeError('Memory limit must be a positive number of bytes.');
    }
    this._limitBytes = bytes;
  }

  /**
   * Register a callback for when memory usage is high.
   * @param {function(string):void} callback
   */
  onHighMemory(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    this._highMemCbs.push(callback);
    // Also wire up the EventEmitter listener for symmetry
    this.on('highMemory', callback);
  }

  /**
   * Trigger garbage collection.
   * Only available when Node.js is started with --expose-gc.
   * @returns {boolean} true if GC was triggered
   */
  gc() {
    if (typeof global.gc === 'function') {
      global.gc();
      this.emit('gc');
      return true;
    }
    return false;
  }

  /**
   * Write a V8 heap snapshot to a file.
   * @param {string} [filename] - output path (defaults to heap-TIMESTAMP.heapsnapshot)
   * @returns {string} the path where the snapshot was written
   */
  snapshot(filename) {
    const outPath = filename || `heap-${Date.now()}.heapsnapshot`;
    const snapshotStream = v8.writeHeapSnapshot(outPath);
    this.emit('snapshot', snapshotStream || outPath);
    return snapshotStream || outPath;
  }

  /**
   * Stop the periodic memory checker and clean up.
   */
  destroy() {
    this._stopPeriodicCheck();
    this._tracked.clear();
    this._highMemCbs = [];
    this.removeAllListeners();
  }

  // ─── Diagnostic helpers ────────────────────────────────────────────────────

  /**
   * Human-readable memory report.
   * @returns {string}
   */
  report() {
    const s = this.getStats();
    const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
    return [
      '┌─ MemoryManager Report ───────────────────────────────┐',
      `│  Heap Used      : ${mb(s.heapUsed).padEnd(12)}                     │`,
      `│  Heap Total     : ${mb(s.heapTotal).padEnd(12)}                     │`,
      `│  External       : ${mb(s.external).padEnd(12)}                     │`,
      `│  RSS            : ${mb(s.rss).padEnd(12)}                     │`,
      `│  Limit          : ${mb(s.limitBytes).padEnd(12)}                     │`,
      `│  Usage          : ${(s.usagePct * 100).toFixed(1).padEnd(6)} %                        │`,
      `│  Tracked Allocs : ${String(s.allocated).padEnd(12)}                     │`,
      `│  Tracked Rel.   : ${String(s.released).padEnd(12)}                     │`,
      `│  Live Objects   : ${String(s.live).padEnd(12)}                     │`,
      '└──────────────────────────────────────────────────────┘',
    ].join('\n');
  }

  /**
   * List all currently tracked allocation names.
   * @returns {string[]}
   */
  list() {
    return Array.from(this._tracked.keys());
  }

  // ─── V8 heap statistics helpers ───────────────────────────────────────────

  /**
   * Get V8 heap space statistics (each space: new_space, old_space, etc.)
   * @returns {object[]}
   */
  heapSpaces() {
    return v8.getHeapSpaceStatistics();
  }

  /**
   * Get V8 heap code statistics.
   * @returns {object}
   */
  codeStats() {
    return v8.getHeapCodeStatistics();
  }
}

module.exports = MemoryManager;

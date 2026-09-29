'use strict';
/**
 * ThyScript Runtime Engine
 * Central runtime orchestrator for ThyScript execution.
 * Manages memory, V8 garbage collection, server preprocessing,
 * mathematical preprocessing, multi-core clustering, and standard library bindings.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const cluster = require('cluster');
const os = require('os');
const v8 = require('v8');
const vm = require('vm');
const { performance } = require('perf_hooks');

const MathLib = require('./stdlib/MathLib');
const StringLib = require('./stdlib/StringLib');
const ArrayLib = require('./stdlib/ArrayLib');
const FileLib = require('./stdlib/FileLib');
const MemoryManager = require('../memory/MemoryManager');
const ServerEngine = require('../server/ServerEngine');
const SecurityEngine = require('../server/SecurityEngine');
const HTMLCSSEngine = require('../server/HTMLCSSEngine');
const DatabaseEngine = require('../database/DatabaseEngine');

class ThyRuntime {
  constructor(options = {}) {
    this.options = Object.assign({
      cores: Math.min(4, os.cpus().length || 4),
      enableClustering: false,
      memoryLimitMB: 512,
      saveDir: process.cwd(),
      verbose: false,
    }, options);

    this.memoryManager = new MemoryManager({
      limitMB: this.options.memoryLimitMB,
      onHighMemory: (stats) => {
        if (this.options.verbose) {
          console.warn(`[ThyScript Runtime] High memory usage: ${stats.heapUsedMB} MB / ${this.options.memoryLimitMB} MB`);
        }
        this.runGarbageCollector();
      },
    });

    this.serverEngine = new ServerEngine();
    this.securityEngine = new SecurityEngine();
    this.htmlCssEngine = new HTMLCSSEngine();
    this.databaseEngine = new DatabaseEngine();
    this.mathLib = new MathLib();           // instance methods
    this.stringLib = new StringLib();       // instance methods
    this.arrayLib = ArrayLib;               // static methods → expose the class
    this.fileLib = FileLib;                 // static methods → expose the class

    this._stateStore = new Map();
    this._initialized = false;
  }

  /**
   * Initialize all runtime subsystems
   */
  async init() {
    if (this._initialized) return this;

    // Start memory monitoring
    this.memoryManager.startMonitoring(5000);

    // Initialize 4-core cluster if requested
    if (this.options.enableClustering && cluster.isPrimary) {
      const numCores = this.options.cores;
      for (let i = 0; i < numCores; i++) {
        cluster.fork();
      }
      cluster.on('exit', (worker, code, signal) => {
        if (this.options.verbose) {
          console.log(`[ThyScript Cluster] Worker ${worker.process.pid} exited. Respawning...`);
        }
        cluster.fork();
      });
    }

    this._initialized = true;
    return this;
  }

  /**
   * Run garbage collection (uses V8 global.gc if available, else clears internal caches)
   */
  runGarbageCollector() {
    if (global.gc) {
      try {
        global.gc();
      } catch (_) {}
    }
    // Clean internal state store of stale entries
    if (this._stateStore.size > 10000) {
      this._stateStore.clear();
    }
  }

  /**
   * Prompt user for input via readline (async)
   */
  async promptInput(promptText = '') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(promptText ? `${promptText} ` : '> ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Persist variable or state to disk (.thysave file)
   */
  saveState(key, value) {
    this._stateStore.set(key, value);
    const savePath = path.join(this.options.saveDir, `${key}.thysave`);
    try {
      fs.writeFileSync(savePath, JSON.stringify(value, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.warn(`[ThyScript] Failed to persist state '${key}': ${e.message}`);
      return false;
    }
  }

  /**
   * Load persisted variable from disk
   */
  loadState(key) {
    if (this._stateStore.has(key)) return this._stateStore.get(key);
    const savePath = path.join(this.options.saveDir, `${key}.thysave`);
    if (fs.existsSync(savePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(savePath, 'utf8'));
        this._stateStore.set(key, data);
        return data;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  /**
   * Free an object or variable from memory (hint for garbage collection)
   */
  freeVariable(obj) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.length = 0;
      } else {
        for (const k of Object.keys(obj)) {
          delete obj[k];
        }
      }
    }
    return null;
  }

  /**
   * High-speed math preprocessing and evaluation (target: sub-1ms)
   */
  calculate(expr) {
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') return expr;
    try {
      return (new Function('Math', `return (${expr});`))(Math);
    } catch (e) {
      return this.mathLib.calculate(expr);
    }
  }

  /**
   * Print helper with formatting support
   */
  print(...args) {
    const formatted = args.map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (_) {
          return String(arg);
        }
      }
      return String(arg);
    });
    console.log(...formatted);
  }

  /**
   * Build execution sandbox context with all ThyScript standard library functions
   */
  buildContext(customContext = {}) {
    const runtime = this;

    return {
      // Core I/O
      print: (...args) => runtime.print(...args),
      input: (prompt) => runtime.promptInput(prompt),
      save: (key, val) => runtime.saveState(key, val),
      load: (key) => runtime.loadState(key),
      free: (val) => runtime.freeVariable(val),
      calculate: (expr) => runtime.calculate(expr),

      // Internal compiler bindings
      __thy_print: (...args) => runtime.print(...args),
      __thy_input: (prompt) => runtime.promptInput(prompt),
      __thy_save: (key, val) => runtime.saveState(key, val),
      __thy_load: (key) => runtime.loadState(key),
      __thy_free: (val) => runtime.freeVariable(val),
      __thy_calculate: (expr) => runtime.calculate(expr),
      __thy_sleep: (ms) => new Promise(r => setTimeout(r, ms)),
      __thy_timer: () => performance.now(),

      // Standard library packages
      Math: Math,
      math: runtime.mathLib,
      string: runtime.stringLib,
      array: runtime.arrayLib,
      file: runtime.fileLib,
      memory: runtime.memoryManager,
      server: runtime.serverEngine,
      security: runtime.securityEngine,
      html: runtime.htmlCssEngine,
      database: runtime.databaseEngine,

      // ThyScript v3 feature hub — hundreds of helper utilities
      v3: require('../v3/FeatureHub'),

      // Global constructors
      Float64Array,
      Float32Array,
      Int32Array,
      Uint8Array,
      ArrayBuffer,
      Map,
      Set,
      Promise,
      Date,
      RegExp,
      JSON,
      Buffer,

      // Injected custom context
      ...customContext,
    };
  }

  /**
   * Clean up runtime resources
   */
  destroy() {
    this.memoryManager.stopMonitoring();
    this.serverEngine.stop();
  }
}

module.exports = ThyRuntime;

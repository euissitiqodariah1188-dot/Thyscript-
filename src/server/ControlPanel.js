'use strict';
/**
 * ThyScript Control Panel Engine
 * Turns the host computer into a live, remote-accessible ThyScript server
 * with on-the-fly compilation, execution, live web IDE, system monitor,
 * and service orchestrator without needing manual disk compilation.
 */

const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { performance } = require('perf_hooks');

const Lexer = require('../lexer/Lexer');
const Parser = require('../parser/Parser');
const JITCompiler = require('../compiler/JITCompiler');
const ThyRuntime = require('../runtime/ThyRuntime');
const ErrorDetector = require('../errors/ErrorDetector');

class ControlPanel {
  constructor(options = {}) {
    this.options = Object.assign({
      port: 7777,
      host: '0.0.0.0',
      workspaceDir: process.cwd(),
      authToken: options.authToken || null,
      cors: true,
      openBrowser: false,
    }, options);

    this.app = express();
    this.server = null;
    this.runtime = null;
    this.activeServices = new Map(); // id -> { name, port, startTime, status, logs }
    this.runHistory = [];
    this.startTime = Date.now();
  }

  /**
   * Get all local network IP addresses
   */
  getNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({ interface: name, address: iface.address });
        }
      }
    }
    return addresses;
  }

  /**
   * Get current live hardware and process metrics
   */
  getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();

    return {
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
      cpu: {
        model: cpus[0] ? cpus[0].model : 'Unknown',
        cores: cpus.length,
        speed: cpus[0] ? cpus[0].speed : 0,
        loadAvg: os.loadavg(),
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: usedMem,
        totalMB: +(totalMem / (1024 * 1024)).toFixed(1),
        usedMB: +(usedMem / (1024 * 1024)).toFixed(1),
        freeMB: +(freeMem / (1024 * 1024)).toFixed(1),
        usagePercent: +((usedMem / totalMem) * 100).toFixed(1),
        processHeapUsedMB: +(memUsage.heapUsed / (1024 * 1024)).toFixed(2),
        processHeapTotalMB: +(memUsage.heapTotal / (1024 * 1024)).toFixed(2),
        processRssMB: +(memUsage.rss / (1024 * 1024)).toFixed(2),
      },
      server: {
        nodeVersion: process.version,
        thyscriptVersion: '3.0.0',
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        activeServicesCount: this.activeServices.size,
        historyCount: this.runHistory.length,
      }
    };
  }

  /**
   * Scan workspace for ThyScript files
   */
  getWorkspaceFiles(dir = this.options.workspaceDir) {
    const results = [];
    const validExts = new Set(['.thy', '.tson', '.tyoml']);

    const scan = (currentDir, relBase = '') => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.join(relBase, entry.name).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            scan(fullPath, relPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (validExts.has(ext)) {
              const stat = fs.statSync(fullPath);
              results.push({
                name: entry.name,
                path: relPath,
                fullPath,
                ext,
                sizeBytes: stat.size,
                modifiedAt: stat.mtime.toISOString(),
              });
            }
          }
        }
      } catch (_) {}
    };

    scan(dir);
    return results;
  }

  /**
   * Execute ThyScript source code on the fly in memory (Zero Compile Step on disk)
   */
  async executeOnTheFly(source, filename = '<control-panel>') {
    const logs = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Capture execution stdout/stderr
    const capture = (type, ...args) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ');
      logs.push({ type, message: msg, time: new Date().toLocaleTimeString() });
    };

    const t0 = performance.now();
    let lexTime = 0, parseTime = 0, compileTime = 0, execTime = 0;
    let tokens = [], ast = null, compiledJs = '';

    try {
      // 1. Lexing
      const tLex0 = performance.now();
      const lexer = new Lexer(source, filename);
      tokens = lexer.tokenize();
      lexTime = +(performance.now() - tLex0).toFixed(2);

      // 2. Parsing
      const tParse0 = performance.now();
      const parser = new Parser(tokens, source, filename);
      const parseResult = parser.parse();
      ast = parseResult.ast || parseResult;
      parseTime = +(performance.now() - tParse0).toFixed(2);

      // 3. Error Detector Scan
      const detector = new ErrorDetector();
      const scanResult = detector.scan(tokens, ast, source, filename);

      // 4. JIT Compile to in-memory JS
      const tCompile0 = performance.now();
      const compiler = new JITCompiler(ast, source, filename);
      compiledJs = compiler.compile();
      compileTime = +(performance.now() - tCompile0).toFixed(2);

      // 5. Initialize Runtime & Custom Sandbox
      if (!this.runtime) {
        this.runtime = new ThyRuntime({ verbose: false });
        await this.runtime.init();
      }

      const memBefore = process.memoryUsage().heapUsed;

      // Custom context with log redirection
      const customContext = {
        print: (...args) => capture('log', ...args),
        __thy_print: (...args) => capture('log', ...args),
      };

      const context = this.runtime.buildContext(customContext);

      // Hook console and process.stdout/stderr temporarily during execution
      const originalStdout = process.stdout.write;
      const originalStderr = process.stderr.write;

      process.stdout.write = (chunk, enc, cb) => {
        const s = String(chunk);
        if (s.trim()) capture('log', s.trimEnd());
        return originalStdout.call(process.stdout, chunk, enc, cb);
      };
      process.stderr.write = (chunk, enc, cb) => {
        const s = String(chunk);
        if (s.trim()) capture('error', s.trimEnd());
        return originalStderr.call(process.stderr, chunk, enc, cb);
      };

      console.log = (...args) => { originalLog(...args); capture('log', ...args); };
      console.warn = (...args) => { originalWarn(...args); capture('warn', ...args); };
      console.error = (...args) => { originalError(...args); capture('error', ...args); };

      let execResult;
      try {
        const tExec0 = performance.now();
        execResult = await compiler.execute(compiledJs, context);
        execTime = +(performance.now() - tExec0).toFixed(2);
      } finally {
        process.stdout.write = originalStdout;
        process.stderr.write = originalStderr;
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }

      const memAfter = process.memoryUsage().heapUsed;
      const totalTime = +(performance.now() - t0).toFixed(2);

      const record = {
        id: Date.now().toString(36),
        filename,
        success: true,
        result: execResult !== undefined ? String(execResult) : null,
        logs,
        warnings: scanResult.warnings || [],
        timings: {
          lexMs: lexTime,
          parseMs: parseTime,
          compileMs: compileTime,
          execMs: execTime,
          totalMs: totalTime,
        },
        memoryDeltaKB: +((memAfter - memBefore) / 1024).toFixed(1),
        timestamp: new Date().toISOString(),
      };

      this.runHistory.unshift(record);
      if (this.runHistory.length > 50) this.runHistory.pop();

      return record;
    } catch (err) {
      // Restore console on failure
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;

      const totalTime = +(performance.now() - t0).toFixed(2);
      const record = {
        id: Date.now().toString(36),
        filename,
        success: false,
        error: {
          message: err.message,
          stack: err.stack,
          line: err.line || null,
          column: err.column || null,
        },
        logs,
        timings: {
          lexMs: lexTime,
          parseMs: parseTime,
          compileMs: compileTime,
          execMs: execTime,
          totalMs: totalTime,
        },
        timestamp: new Date().toISOString(),
      };

      this.runHistory.unshift(record);
      if (this.runHistory.length > 50) this.runHistory.pop();

      return record;
    }
  }

  /**
   * Setup Express routes and endpoints
   */
  setupRoutes() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // CORS handler
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });

    // Optional Token Authentication Middleware
    const authMiddleware = (req, res, next) => {
      if (!this.options.authToken) return next();
      const token = req.headers['authorization'] || req.query.token;
      if (token === this.options.authToken || token === `Bearer ${this.options.authToken}`) {
        return next();
      }
      return res.status(401).json({ success: false, message: 'Unauthorized. Invalid or missing token.' });
    };

    // ─── API: System Metrics ───────────────────────────────────────
    this.app.get('/api/system', (req, res) => {
      res.json({
        success: true,
        metrics: this.getSystemMetrics(),
        networks: this.getNetworkAddresses(),
      });
    });

    // ─── API: File Explorer ─────────────────────────────────────────
    this.app.get('/api/files', authMiddleware, (req, res) => {
      try {
        const files = this.getWorkspaceFiles();
        res.json({ success: true, count: files.length, files });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    this.app.get('/api/files/read', authMiddleware, (req, res) => {
      try {
        const relPath = req.query.path;
        if (!relPath) return res.status(400).json({ success: false, message: 'path query parameter is required' });
        const absPath = path.resolve(this.options.workspaceDir, relPath);
        if (!absPath.startsWith(path.resolve(this.options.workspaceDir))) {
          return res.status(403).json({ success: false, message: 'Access denied: Path outside workspace' });
        }
        if (!fs.existsSync(absPath)) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }
        const content = fs.readFileSync(absPath, 'utf8');
        res.json({ success: true, path: relPath, content });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    this.app.post('/api/files/save', authMiddleware, (req, res) => {
      try {
        const { filePath, content } = req.body;
        if (!filePath) return res.status(400).json({ success: false, message: 'filePath is required' });
        const absPath = path.resolve(this.options.workspaceDir, filePath);
        if (!absPath.startsWith(path.resolve(this.options.workspaceDir))) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, content || '', 'utf8');
        res.json({ success: true, message: 'File saved successfully', path: filePath });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // ─── API: On-The-Fly Code Runner (Zero Compile Step on Disk) ──
    this.app.post('/api/run-code', authMiddleware, async (req, res) => {
      try {
        const { code, name } = req.body;
        if (typeof code !== 'string') {
          return res.status(400).json({ success: false, message: 'code string is required' });
        }
        const record = await this.executeOnTheFly(code, name || '<browser-repl>');
        res.json(record);
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    this.app.post('/api/run-file', authMiddleware, async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ success: false, message: 'filePath is required' });
        const workspaceRoot = path.resolve(this.options.workspaceDir);
        const absPath = path.resolve(workspaceRoot, filePath);
        // Confine file access to the workspace (mirrors /api/files/read & save)
        if (absPath !== workspaceRoot && !absPath.startsWith(workspaceRoot + path.sep)) {
          return res.status(403).json({ success: false, message: 'Access denied: Path outside workspace' });
        }
        if (!fs.existsSync(absPath)) {
          return res.status(404).json({ success: false, message: 'File not found' });
        }
        const source = fs.readFileSync(absPath, 'utf8');
        const record = await this.executeOnTheFly(source, path.basename(absPath));
        res.json(record);
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // ─── API: Run History ──────────────────────────────────────────
    this.app.get('/api/history', authMiddleware, (req, res) => {
      res.json({ success: true, history: this.runHistory });
    });

    // ─── API: Install npm packages (use ALL npm libraries) ──────────
    this.app.post('/api/install', authMiddleware, (req, res) => {
      const { packages, saveDev } = req.body || {};
      const list = (Array.isArray(packages) ? packages : [packages])
        .map(p => (p || '').trim()).filter(Boolean);
      if (list.length === 0) {
        return res.status(400).json({ success: false, message: 'Provide at least one package name' });
      }
      const flag = saveDev ? '--save-dev' : '--save';
      const cmd = 'npm install ' + list.map(p => `"${p}"`).join(' ') + ' ' + flag;
      exec(cmd, { cwd: this.options.workspaceDir, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          return res.status(500).json({ success: false, message: stderr.split('\n').filter(Boolean).slice(0, 8).join(' ') || err.message });
        }
        const okOut = (stdout || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 12);
        res.json({ success: true, installed: list, output: okOut, hint: 'Use  import "<pkg>"  in your ThyScript code.' });
      });
    });

    // ─── Web UI: Main Control Panel Dashboard ───────────────────────
    this.app.get('/', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(this.renderDashboardHtml());
    });
  }

  /**
   * HTML & CSS & Client JS for the Web Control Panel
   */
  renderDashboardHtml() {
    const netAddresses = this.getNetworkAddresses();
    const netHtml = netAddresses.map(n => `<li><span class="tag">${n.interface}</span> <strong>http://${n.address}:${this.options.port}</strong></li>`).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ThyScript Server Control Panel</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #090a10;
            --bg-card: rgba(18, 20, 32, 0.7);
            --bg-card-hover: rgba(28, 31, 48, 0.8);
            --border-subtle: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(99, 102, 241, 0.4);
            --primary: #6366f1;
            --primary-glow: #818cf8;
            --accent-cyan: #06b6d4;
            --accent-green: #10b981;
            --accent-orange: #f59e0b;
            --accent-red: #ef4444;
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
            --font-mono: 'JetBrains Mono', monospace;
            --font-sans: 'Inter', sans-serif;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: var(--bg-base);
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 40%);
            color: var(--text-main);
            font-family: var(--font-sans);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Top Navigation Header */
        header {
            background: rgba(15, 17, 28, 0.85);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-subtle);
            padding: 16px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .brand .logo-icon {
            font-size: 26px;
            background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
        }
        .brand h1 {
            font-size: 19px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .brand span.badge {
            background: rgba(99, 102, 241, 0.2);
            color: var(--primary-glow);
            border: 1px solid rgba(99, 102, 241, 0.35);
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            font-family: var(--font-mono);
        }
        .header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .status-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 500;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

        /* Main Workspace Layout */
        .main-layout {
            display: grid;
            grid-template-columns: 280px 1fr 340px;
            gap: 20px;
            padding: 24px;
            flex: 1;
            max-width: 1800px;
            margin: 0 auto;
            width: 100%;
        }

        /* Glass Cards */
        .panel-card {
            background: var(--bg-card);
            backdrop-filter: blur(25px);
            border: 1px solid var(--border-subtle);
            border-radius: 18px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        .card-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-dim);
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .card-header span.title {
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Left Sidebar: File Tree & Templates */
        .file-list {
            padding: 12px;
            overflow-y: auto;
            flex: 1;
            list-style: none;
        }
        .file-item {
            padding: 10px 14px;
            border-radius: 10px;
            margin-bottom: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.15s ease;
            font-size: 13px;
            color: var(--text-dim);
            font-family: var(--font-mono);
        }
        .file-item:hover {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-main);
        }
        .file-item.active {
            background: rgba(99, 102, 241, 0.18);
            border: 1px solid rgba(99, 102, 241, 0.4);
            color: #fff;
        }
        .file-item .file-size {
            font-size: 11px;
            opacity: 0.6;
        }

        .templates-box {
            padding: 16px;
            border-top: 1px solid var(--border-subtle);
            background: rgba(0, 0, 0, 0.2);
        }
        .templates-box h4 {
            font-size: 12px;
            color: var(--text-dim);
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        .template-btn {
            width: 100%;
            text-align: left;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-subtle);
            padding: 8px 12px;
            border-radius: 8px;
            color: var(--text-main);
            font-size: 12px;
            cursor: pointer;
            margin-bottom: 6px;
            transition: all 0.15s;
        }
        .template-btn:hover {
            background: rgba(99, 102, 241, 0.2);
            border-color: var(--primary);
        }
        .npm-input {
            flex: 1;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            color: var(--text-main);
            font-family: var(--font-mono);
            font-size: 12px;
            padding: 6px 10px;
            outline: none;
        }
        .npm-input:focus { border-color: var(--primary); }

        /* Center Column: Live Editor & Console */
        .editor-container {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        .editor-toolbar {
            padding: 12px 20px;
            background: rgba(10, 12, 20, 0.6);
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .editor-actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            border: none;
            outline: none;
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }
        .btn-run {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }
        .btn-run:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-main);
            border: 1px solid var(--border-subtle);
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }

        textarea.code-editor {
            flex: 1;
            min-height: 380px;
            background: transparent;
            border: none;
            outline: none;
            color: #f1f5f9;
            font-family: var(--font-mono);
            font-size: 14px;
            line-height: 1.6;
            padding: 20px;
            resize: none;
            white-space: pre;
        }

        /* Console Output Box */
        .console-container {
            border-top: 1px solid var(--border-subtle);
            background: rgba(5, 7, 12, 0.95);
            display: flex;
            flex-direction: column;
            height: 260px;
        }
        .console-header {
            padding: 10px 18px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-dim);
            font-family: var(--font-mono);
        }
        .console-output {
            flex: 1;
            padding: 14px 18px;
            overflow-y: auto;
            font-family: var(--font-mono);
            font-size: 13px;
            line-height: 1.5;
        }
        .log-line { margin-bottom: 4px; word-break: break-all; }
        .log-line.log { color: #e2e8f0; }
        .log-line.warn { color: var(--accent-orange); }
        .log-line.error { color: var(--accent-red); font-weight: 600; }
        .log-line.success { color: #34d399; font-weight: 600; }
        .log-time { color: #64748b; margin-right: 8px; font-size: 11px; }

        /* Right Sidebar: Real Hardware & Network Info */
        .metric-group {
            padding: 18px;
            border-bottom: 1px solid var(--border-subtle);
        }
        .metric-group:last-child { border-bottom: none; }
        .metric-title {
            font-size: 12px;
            color: var(--text-dim);
            margin-bottom: 12px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .metric-label { color: #94a3b8; }
        .metric-val { font-family: var(--font-mono); font-weight: 600; color: #fff; }

        .progress-bar {
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 6px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--accent-cyan));
            transition: width 0.3s ease;
        }

        .network-list {
            list-style: none;
            font-size: 12px;
            font-family: var(--font-mono);
        }
        .network-list li {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .tag {
            background: rgba(99, 102, 241, 0.2);
            color: var(--primary-glow);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
        }

        /* Timing Badges */
        .timing-pill {
            display: inline-block;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-subtle);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-family: var(--font-mono);
            color: #38bdf8;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <div class="logo-icon">⚡</div>
            <div>
                <h1>ThyScript Control Panel</h1>
            </div>
            <span class="badge">v3.0.0 HOST SERVER</span>
        </div>
        <div class="header-actions">
            <div class="status-pill">
                <div class="status-dot"></div>
                <span>LIVE SERVER ONLINE</span>
            </div>
        </div>
    </header>

    <div class="main-layout">
        <!-- Left: Workspace & Templates -->
        <aside class="panel-card">
            <div class="card-header">
                <span class="title">📁 Workspace Files</span>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="loadFiles()">↻</button>
            </div>
            <ul class="file-list" id="fileList">
                <li style="padding: 20px; text-align: center; color: #64748b;">Loading workspace...</li>
            </ul>

            <div class="templates-box">
                <h4>⚡ Quick Starters</h4>
                <button class="template-btn" onclick="loadStarter('calc')">🧮 Fast Math & Arithmetic</button>
                <button class="template-btn" onclick="loadStarter('oop')">🏛️ OOP Classes & Methods</button>
                <button class="template-btn" onclick="loadStarter('server')">🌐 REST API & Web Server</button>
                <button class="template-btn" onclick="loadStarter('func')">λ Recursion & High-Order Func</button>
            </div>

            <div class="templates-box" style="border-top: 1px solid var(--border-subtle);">
                <h4>📦 Install Any npm Library</h4>
                <p style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
                    Install any package from npm and use it instantly with <code style="font-family: var(--font-mono); color: #38bdf8;">import "name"</code>
                </p>
                <div style="display: flex; gap: 6px;">
                    <input id="npmPkgInput" class="npm-input" placeholder="e.g. axios lodash dayjs" onkeydown="if(event.key==='Enter')installPkg()">
                    <button class="btn btn-run" style="padding: 6px 10px; font-size: 12px;" onclick="installPkg()">Install</button>
                </div>
                <div id="npmInstallStatus" style="margin-top: 8px; font-size: 11px; font-family: var(--font-mono); color: #94a3b8;"></div>
            </div>
        </aside>

        <!-- Center: Live Editor & Console -->
        <main class="panel-card editor-container">
            <div class="editor-toolbar">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span id="currentFileName" style="font-family: var(--font-mono); font-size: 13px; color: #cbd5e1;">scratchpad.thy</span>
                    <span id="timingBadge" class="timing-pill" style="display: none;">0ms</span>
                </div>
                <div class="editor-actions">
                    <button class="btn btn-secondary" onclick="saveCurrentFile()">💾 Save to Host</button>
                    <button class="btn btn-secondary" onclick="clearConsole()">🧹 Clear Logs</button>
                    <button class="btn btn-run" onclick="runCode()">⚡ RUN (ZERO COMPILE)</button>
                </div>
            </div>

            <textarea id="codeEditor" class="code-editor" spellcheck="false" placeholder="Tulis kode ThyScript di sini..."></textarea>

            <div class="console-container">
                <div class="console-header">
                    <span>EXECUTION CONSOLE & LOGS</span>
                    <span id="consoleStatus" style="color: #64748b;">Ready</span>
                </div>
                <div class="console-output" id="consoleOut">
                    <div class="log-line log"><span class="log-time">[System]</span> ThyScript Live Execution Sandbox initialized. Click RUN to execute instantly in host memory.</div>
                </div>
            </div>
        </main>

        <!-- Right: Hardware Monitor & Remote Access -->
        <aside class="panel-card">
            <div class="card-header">
                <span class="title">🖥️ Server Hardware</span>
                <span id="uptimeText" style="font-family: var(--font-mono); font-size: 11px;">0s</span>
            </div>

            <!-- RAM Metrics -->
            <div class="metric-group">
                <div class="metric-title">System RAM Memory</div>
                <div class="metric-row">
                    <span class="metric-label">Used / Total:</span>
                    <span class="metric-val" id="memText">0 / 0 GB</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="memProgress" style="width: 0%;"></div>
                </div>
                <div class="metric-row" style="margin-top: 8px; font-size: 11px;">
                    <span class="metric-label">Heap Used:</span>
                    <span class="metric-val" id="heapText" style="color: #38bdf8;">0 MB</span>
                </div>
            </div>

            <!-- CPU Metrics -->
            <div class="metric-group">
                <div class="metric-title">Host CPU & Cores</div>
                <div class="metric-row">
                    <span class="metric-label">Cores:</span>
                    <span class="metric-val" id="cpuCores">0 Cores</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Model:</span>
                    <span class="metric-val" id="cpuModel" style="font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px;">-</span>
                </div>
            </div>

            <!-- Remote Access URLs -->
            <div class="metric-group" style="flex: 1;">
                <div class="metric-title">🌐 Remote Access URLs</div>
                <p style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">
                    Komputer utama ini sekarang menjadi Server ThyScript. Buka URL ini di HP / Laptop lain dalam jaringan WiFi/LAN yang sama:
                </p>
                <ul class="network-list">
                    <li><span class="tag">Localhost</span> <strong>http://localhost:${this.options.port}</strong></li>
                    ${netHtml}
                </ul>
            </div>
        </aside>
    </div>

    <script>
        const editor = document.getElementById('codeEditor');
        const consoleOut = document.getElementById('consoleOut');
        const consoleStatus = document.getElementById('consoleStatus');
        const timingBadge = document.getElementById('timingBadge');
        let currentFilePath = null;

        // Starters dictionary
        const starters = {
            calc: \`// ⚡ Fast Arithmetic & Math
const table a = 1250
const table b = 48
const table sum = calculate(a + b)
const table product = calculate(a * b)
const table power = calculate(2 ** 16)

print("A + B = " + sum)
print("A * B = " + product)
print("2^16 = " + power)

// Array calculations
const table values = [10, 20, 30, 40, 50, 100]
const table total = 0
for v in values:
    add v in total
end()
print("Total sum: " + total)
\`,
            oop: \`// 🏛️ OOP Classes & Methods
public class(Worker):
    const table name = "Unknown"
    const table tasksCompleted = 0

    func completeTask(taskName):
        add 1 in tasksCompleted
        print(name + " completed: " + taskName + " (Total: " + tasksCompleted + ")")
    end()
end()

const table dev = new Worker()
change(dev.name to("Antigravity Dev"))
dev.completeTask("JIT Compiler Optimization")
dev.completeTask("Remote Control Panel Engine")
\`,
            server: \`// 🌐 Express REST API Server
server(5050):
    print("⚡ Mini service live on port 5050!")
end()

route get "/api/ping":
    response.json({ message: "pong from ThyScript!", time: Date.now() })
end()

print("Open http://localhost:5050/api/ping to test!")
\`,
            func: \`// λ High-Order & Recursive Functions
func factorial(n):
    if(n <= 1):
        return 1
    end()
    return calculate(n * factorial(n - 1))
end()

print("5! = " + factorial(5))
print("10! = " + factorial(10))
\`
        };

        // Load starter into editor
        function loadStarter(key) {
            editor.value = starters[key] || '';
            currentFilePath = null;
            document.getElementById('currentFileName').innerText = key + '_starter.thy';
        }

        // Add log entry to console
        function appendLog(type, msg, time) {
            const row = document.createElement('div');
            row.className = 'log-line ' + type;
            const t = time || new Date().toLocaleTimeString();
            row.innerHTML = '<span class="log-time">[' + t + ']</span> ' + escapeHtml(msg);
            consoleOut.appendChild(row);
            consoleOut.scrollTop = consoleOut.scrollHeight;
        }

        function clearConsole() {
            consoleOut.innerHTML = '';
            consoleStatus.innerText = 'Cleared';
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Run code on the fly
        async function runCode() {
            const code = editor.value.trim();
            if (!code) return;

            consoleStatus.innerText = '⚡ Executing in memory...';
            appendLog('log', '── Running on-the-fly without disk compile... ──');

            const t0 = performance.now();
            try {
                const res = await fetch('/api/run-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, name: currentFilePath || 'scratchpad.thy' })
                });
                const data = await res.json();

                if (data.success) {
                    (data.logs || []).forEach(l => appendLog(l.type, l.message, l.time));
                    if (data.result !== null && data.result !== undefined) {
                        appendLog('success', '=> Return: ' + data.result);
                    }
                    const total = data.timings ? data.timings.totalMs : (performance.now() - t0).toFixed(1);
                    timingBadge.style.display = 'inline-block';
                    timingBadge.innerText = total + 'ms';
                    consoleStatus.innerText = 'Finished (' + total + 'ms)';
                    appendLog('success', '✔ Finished successfully in ' + total + 'ms (Memory Delta: ' + data.memoryDeltaKB + ' KB)');
                } else {
                    (data.logs || []).forEach(l => appendLog(l.type, l.message, l.time));
                    appendLog('error', '✖ Error: ' + (data.error ? data.error.message : 'Execution failed'));
                    consoleStatus.innerText = 'Failed';
                }
            } catch (err) {
                appendLog('error', 'Network/Server Error: ' + err.message);
                consoleStatus.innerText = 'Error';
            }
        }

        // Save current code to host file
        async function saveCurrentFile() {
            let target = currentFilePath;
            if (!target) {
                target = prompt('Enter filename to save in workspace (e.g. my_script.thy):', 'script.thy');
                if (!target) return;
                currentFilePath = target;
                document.getElementById('currentFileName').innerText = target;
            }
            try {
                const res = await fetch('/api/files/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: target, content: editor.value })
                });
                const data = await res.json();
                if (data.success) {
                    appendLog('success', 'Saved ' + target + ' to host disk successfully.');
                    loadFiles();
                } else {
                    appendLog('error', 'Save error: ' + data.message);
                }
            } catch (e) {
                appendLog('error', 'Save failed: ' + e.message);
            }
        }

        // Install npm package from the browser
        async function installPkg() {
            const input = document.getElementById('npmPkgInput');
            const status = document.getElementById('npmInstallStatus');
            const raw = (input.value || '').trim();
            if (!raw) return;
            const pkgs = raw.split(/\\s+/).filter(Boolean);
            status.style.color = '#f59e0b';
            status.innerText = '⏳ Installing ' + pkgs.join(', ') + ' ...';
            try {
                const res = await fetch('/api/install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ packages: pkgs })
                });
                const data = await res.json();
                if (data.success) {
                    status.style.color = '#34d399';
                    status.innerText = '✅ Installed: ' + data.installed.join(', ') + '. Now use  import "' + data.installed[0] + '"';
                    appendLog('success', '📦 npm installed: ' + data.installed.join(', '));
                    input.value = '';
                } else {
                    status.style.color = '#ef4444';
                    status.innerText = '❌ ' + (data.message || 'Install failed');
                    appendLog('error', 'npm install failed: ' + (data.message || ''));
                }
            } catch (err) {
                status.style.color = '#ef4444';
                status.innerText = '❌ ' + err.message;
            }
        }

        // Load files from host workspace
        async function loadFiles() {
            try {
                const res = await fetch('/api/files');
                const data = await res.json();
                const list = document.getElementById('fileList');
                list.innerHTML = '';

                if (data.files && data.files.length) {
                    data.files.forEach(f => {
                        const li = document.createElement('li');
                        li.className = 'file-item' + (currentFilePath === f.path ? ' active' : '');
                        li.innerHTML = '<span>' + f.name + '</span><span class="file-size">' + (f.sizeBytes / 1024).toFixed(1) + ' KB</span>';
                        li.onclick = () => openFile(f.path);
                        list.appendChild(li);
                    });
                } else {
                    list.innerHTML = '<li style="padding: 14px; text-align: center; color: #64748b;">No .thy files found</li>';
                }
            } catch (err) {
                console.error(err);
            }
        }

        // Open file content into editor
        async function openFile(relPath) {
            try {
                const res = await fetch('/api/files/read?path=' + encodeURIComponent(relPath));
                const data = await res.json();
                if (data.success) {
                    editor.value = data.content;
                    currentFilePath = relPath;
                    document.getElementById('currentFileName').innerText = relPath;
                    loadFiles();
                    appendLog('log', 'Opened ' + relPath);
                }
            } catch (e) {
                appendLog('error', 'Failed to read file: ' + e.message);
            }
        }

        // Update hardware metrics
        async function refreshMetrics() {
            try {
                const res = await fetch('/api/system');
                const data = await res.json();
                if (data.success && data.metrics) {
                    const m = data.metrics;
                    document.getElementById('memText').innerText = m.memory.usedMB + ' / ' + m.memory.totalMB + ' MB';
                    document.getElementById('memProgress').style.width = m.memory.usagePercent + '%';
                    document.getElementById('heapText').innerText = m.memory.processHeapUsedMB + ' MB';
                    document.getElementById('cpuCores').innerText = m.cpu.cores + ' Cores';
                    document.getElementById('cpuModel').innerText = m.cpu.model;
                    document.getElementById('uptimeText').innerText = m.server.uptimeSeconds + 's uptime';
                }
            } catch (_) {}
        }

        // Keyboard shortcuts: Ctrl+Enter to run, Ctrl+S to save
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runCode();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCurrentFile();
            }
        });

        // Init on page load
        loadStarter('calc');
        loadFiles();
        refreshMetrics();
        setInterval(refreshMetrics, 2000);
    </script>
</body>
</html>`;
  }

  /**
   * Start the Control Panel Server
   */
  start(port = this.options.port, host = this.options.host) {
    this.setupRoutes();
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, host, () => {
          this.options.port = this.server.address().port;
          resolve(this);
        });
        this.server.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Stop the Control Panel Server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = ControlPanel;

'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

// Express with built-in high-speed native HTTP fallback
let express;
try {
  express = require('express');
} catch (e) {
  express = () => {
    const routes = [];
    const middlewares = [];
    const app = {
      use(fn) { middlewares.push(fn); return app; },
      get(route, fn) { routes.push({ method: 'GET', route, fn }); return app; },
      post(route, fn) { routes.push({ method: 'POST', route, fn }); return app; },
      put(route, fn) { routes.push({ method: 'PUT', route, fn }); return app; },
      delete(route, fn) { routes.push({ method: 'DELETE', route, fn }); return app; },
      set() { return app; },
      listen(port, cb) {
        const server = http.createServer((req, res) => {
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };
          res.send = (body) => {
            if (typeof body === 'object') return res.json(body);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(String(body));
          };
          res.status = (code) => { res.statusCode = code; return res; };
          const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          req.path = parsedUrl.pathname;
          req.query = Object.fromEntries(parsedUrl.searchParams);
          let bodyData = '';
          req.on('data', chunk => { bodyData += chunk; });
          req.on('end', () => {
            try { req.body = JSON.parse(bodyData); } catch (_) { req.body = bodyData; }
            let i = 0;
            const next = () => {
              if (i < middlewares.length) {
                middlewares[i++](req, res, next);
              } else {
                const match = routes.find(r => (r.method === req.method || r.method === 'ALL') && (r.route === req.path || r.route === '*'));
                if (match) {
                  match.fn(req, res);
                } else {
                  res.statusCode = 404;
                  res.end('Not Found');
                }
              }
            };
            next();
          });
        });
        server.listen(port, cb);
        return server;
      }
    };
    return app;
  };
  express.json = () => (req, res, next) => next();
  express.urlencoded = () => (req, res, next) => next();
  express.static = (dir) => (req, res, next) => next();
}

// Optional dependencies with graceful fallback
let socketIo, compression, cors;
try { socketIo = require('socket.io'); } catch (e) { socketIo = null; }
try { compression = require('compression'); } catch (e) { compression = (req, res, next) => next(); }
try { cors = require('cors'); } catch (e) { cors = (opts) => (req, res, next) => next(); }

/**
 * ThyScript ServerEngine
 * High-performance HTTP/HTTPS/WebSocket server built on Express.
 */
class ServerEngine {
  constructor() {
    this.app = null;
    this.server = null;
    this.io = null;
    this.isRunning = false;
    this.startTime = null;

    // Metrics
    this.metrics = {
      totalRequests: 0,
      activeRequests: 0,
      totalErrors: 0,
      totalLatencyMs: 0,
      requestsPerSecond: 0,
      statusCodes: {},
      routes: {},
    };

    // Rate limiting store
    this._rateLimitStore = new Map(); // key -> { count, resetAt }

    // XSS patterns
    this._xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=/gi,
      /<iframe[\s\S]*?>/gi,
      /<object[\s\S]*?>/gi,
      /<embed[\s\S]*?>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    // SQL injection patterns
    this._sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/gi,
      /('|")\s*;\s*--/gi,
      /\/\*[\s\S]*?\*\//g,
      /\bOR\b\s+\d+\s*=\s*\d+/gi,
      /\bAND\b\s+\d+\s*=\s*\d+/gi,
    ];

    // Request queue for high-load scenarios
    this._requestQueue = [];
    this._queueMaxSize = 1000;
    this._queueProcessing = false;
    this._queueConcurrency = 50;
    this._activeQueuedRequests = 0;

    // SSE clients
    this._sseClients = new Map(); // clientId -> res

    // WebSocket rooms
    this._rooms = new Map(); // roomName -> Set<socket>

    // Blocked IPs
    this._blockedIPs = new Set();

    // Metrics ticker
    this._metricsInterval = null;
    this._lastRequestCount = 0;
  }

  // ─────────────────────────────────────────────
  // Core Setup
  // ─────────────────────────────────────────────

  /**
   * Creates the Express application and HTTP server.
   * @param {number} port - Default port.
   * @param {object} options - Options: { maxBodySize, trustProxy, queueMaxSize, queueConcurrency }
   * @returns {ServerEngine}
   */
  create(port = 3000, options = {}) {
    this.defaultPort = port;
    this.options = Object.assign({
      maxBodySize: '10mb',
      trustProxy: false,
      queueMaxSize: 1000,
      queueConcurrency: 50,
      enableRequestQueue: false,
    }, options);

    this._queueMaxSize = this.options.queueMaxSize;
    this._queueConcurrency = this.options.queueConcurrency;

    this.app = express();

    if (this.options.trustProxy) {
      this.app.set('trust proxy', 1);
    }

    // Body parsers
    this.app.use(express.json({ limit: this.options.maxBodySize }));
    this.app.use(express.urlencoded({ extended: true, limit: this.options.maxBodySize }));

    // Built-in preprocessing middleware
    this.app.use(this._preprocessRequest.bind(this));

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        memory: process.memoryUsage(),
        version: process.version,
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      const uptime = this.startTime ? (Date.now() - this.startTime) : 1;
      res.json({
        ...this.metrics,
        uptime,
        avgLatencyMs: this.metrics.totalRequests > 0
          ? (this.metrics.totalLatencyMs / this.metrics.totalRequests).toFixed(3)
          : 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        pid: process.pid,
      });
    });

    // Custom error handler
    this.app.use(this._errorHandler.bind(this));

    this.server = http.createServer(this.app);
    return this;
  }

  // ─────────────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────────────

  /**
   * Adds an Express middleware function.
   * @param {function} fn - Express middleware (req, res, next).
   * @returns {ServerEngine}
   */
  addMiddleware(fn) {
    if (!this.app) this.create();
    this.app.use(fn);
    return this;
  }

  /**
   * Enables CORS support.
   * @param {object} options - cors() options.
   * @returns {ServerEngine}
   */
  enableCORS(options = {}) {
    if (!this.app) this.create();
    const defaultOptions = {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      optionsSuccessStatus: 200,
    };
    this.app.use(cors(Object.assign(defaultOptions, options)));
    return this;
  }

  /**
   * Enables gzip/deflate compression.
   * @returns {ServerEngine}
   */
  enableCompression() {
    if (!this.app) this.create();
    this.app.use(compression());
    return this;
  }

  /**
   * Serves static files from a directory.
   * @param {string} dir - Absolute or relative directory path.
   * @param {string} [mountPath='/'] - URL prefix.
   * @param {object} [options={}] - express.static options.
   * @returns {ServerEngine}
   */
  enableStaticFiles(dir, mountPath = '/', options = {}) {
    if (!this.app) this.create();
    const staticOptions = Object.assign({
      maxAge: '1d',
      etag: true,
      lastModified: true,
    }, options);
    this.app.use(mountPath, express.static(path.resolve(dir), staticOptions));
    return this;
  }

  /**
   * Upgrades the server to HTTPS.
   * @param {string|Buffer} cert - Path to cert file or cert Buffer.
   * @param {string|Buffer} key - Path to key file or key Buffer.
   * @returns {ServerEngine}
   */
  enableSSL(cert, key) {
    if (!this.app) this.create();
    const certData = typeof cert === 'string' ? fs.readFileSync(cert) : cert;
    const keyData = typeof key === 'string' ? fs.readFileSync(key) : key;
    this.server = https.createServer({ cert: certData, key: keyData }, this.app);
    return this;
  }

  // ─────────────────────────────────────────────
  // Routing
  // ─────────────────────────────────────────────

  /**
   * Adds a route to the Express application.
   * @param {string} method - HTTP method (get, post, put, delete, patch, etc.)
   * @param {string} routePath - Route path.
   * @param {...function} handlers - Route handler(s).
   * @returns {ServerEngine}
   */
  addRoute(method, routePath, ...handlers) {
    if (!this.app) this.create();
    const m = method.toLowerCase();
    if (typeof this.app[m] !== 'function') {
      throw new Error(`Invalid HTTP method: ${method}`);
    }
    // Wrap handlers for metrics tracking
    const wrappedHandlers = handlers.map((handler, idx) => {
      if (idx < handlers.length - 1) return handler; // pass-through for middleware chain
      return (req, res, next) => {
        const routeKey = `${method.toUpperCase()} ${routePath}`;
        this.metrics.routes[routeKey] = (this.metrics.routes[routeKey] || 0) + 1;
        return handler(req, res, next);
      };
    });
    this.app[m](routePath, ...wrappedHandlers);
    return this;
  }

  // ─────────────────────────────────────────────
  // WebSocket
  // ─────────────────────────────────────────────

  /**
   * Enables Socket.IO WebSocket support.
   * @param {object} options - Socket.IO server options.
   * @returns {ServerEngine}
   */
  enableWebSocket(options = {}) {
    if (!socketIo) throw new Error('socket.io is not installed. Run: npm install socket.io');
    if (!this.server) this.create();

    const ioOptions = Object.assign({
      cors: { origin: '*', methods: ['GET', 'POST'] },
      pingTimeout: 60000,
      pingInterval: 25000,
    }, options);

    this.io = new socketIo.Server(this.server, ioOptions);

    this.io.on('connection', (socket) => {
      this.metrics.totalRequests++;

      socket.on('join-room', (room) => {
        this._joinRoom(socket, room);
      });

      socket.on('leave-room', (room) => {
        this._leaveRoom(socket, room);
      });

      socket.on('room-message', ({ room, message }) => {
        this._broadcastToRoom(room, 'message', message, socket.id);
      });

      socket.on('disconnect', () => {
        this._rooms.forEach((sockets, room) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) this._rooms.delete(room);
        });
      });
    });

    return this;
  }

  // ─────────────────────────────────────────────
  // WebSocket Room Management
  // ─────────────────────────────────────────────

  _joinRoom(socket, room) {
    socket.join(room);
    if (!this._rooms.has(room)) this._rooms.set(room, new Set());
    this._rooms.get(room).add(socket.id);
    socket.emit('joined-room', { room, members: this._rooms.get(room).size });
    socket.to(room).emit('user-joined', { room, socketId: socket.id });
  }

  _leaveRoom(socket, room) {
    socket.leave(room);
    if (this._rooms.has(room)) {
      this._rooms.get(room).delete(socket.id);
      if (this._rooms.get(room).size === 0) this._rooms.delete(room);
    }
    socket.to(room).emit('user-left', { room, socketId: socket.id });
  }

  _broadcastToRoom(room, event, data, excludeSocketId = null) {
    if (!this.io) return;
    if (excludeSocketId) {
      this.io.to(room).except(excludeSocketId).emit(event, data);
    } else {
      this.io.to(room).emit(event, data);
    }
  }

  /**
   * Broadcast to all sockets in a room.
   * @param {string} room
   * @param {string} event
   * @param {*} data
   */
  broadcastToRoom(room, event, data) {
    this._broadcastToRoom(room, event, data);
    return this;
  }

  /**
   * Returns info about all active WebSocket rooms.
   * @returns {object}
   */
  getRooms() {
    const result = {};
    this._rooms.forEach((sockets, room) => {
      result[room] = { members: sockets.size, socketIds: [...sockets] };
    });
    return result;
  }

  // ─────────────────────────────────────────────
  // Server-Sent Events (SSE)
  // ─────────────────────────────────────────────

  /**
   * Sets up an SSE endpoint.
   * Clients connect via GET to `sseRoutePath`.
   * Use `sendSSE(clientId, event, data)` to push events.
   * @param {string} [sseRoutePath='/events'] - SSE endpoint path.
   * @returns {ServerEngine}
   */
  enableSSE(sseRoutePath = '/events') {
    if (!this.app) this.create();
    this.app.get(sseRoutePath, (req, res) => {
      const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      });

      res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

      this._sseClients.set(clientId, res);

      req.on('close', () => {
        this._sseClients.delete(clientId);
      });
    });
    return this;
  }

  /**
   * Sends an SSE event to a specific client.
   * @param {string} clientId
   * @param {string} event
   * @param {*} data
   */
  sendSSE(clientId, event, data) {
    const client = this._sseClients.get(clientId);
    if (client) {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * Broadcasts an SSE event to all connected SSE clients.
   * @param {string} event
   * @param {*} data
   */
  broadcastSSE(event, data) {
    this._sseClients.forEach((client) => {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }

  // ─────────────────────────────────────────────
  // Request Preprocessing
  // ─────────────────────────────────────────────

  _preprocessRequest(req, res, next) {
    const startMs = Date.now();
    const ip = req.ip || req.connection.remoteAddress || '';

    // Block listed IPs
    if (this._blockedIPs.has(ip)) {
      res.status(403).json({ error: 'Forbidden', message: 'Your IP has been blocked.' });
      return;
    }

    // Rate limiting (100 req / 60s per IP by default)
    const rateLimitKey = `preprocess:${ip}`;
    const allowed = this._checkRateLimit(rateLimitKey, 100, 60000);
    if (!allowed) {
      res.status(429).json({ error: 'Too Many Requests', retryAfter: 60 });
      return;
    }

    // XSS sanitization on query strings and body
    if (req.query) req.query = this._sanitizeObject(req.query);
    if (req.body && typeof req.body === 'object') req.body = this._sanitizeObject(req.body);

    // SQL injection detection
    const combined = JSON.stringify(req.query) + JSON.stringify(req.body || {});
    if (this._detectSQLInjection(combined)) {
      this.metrics.totalErrors++;
      res.status(400).json({ error: 'Bad Request', message: 'Malicious input detected.' });
      return;
    }

    // Track metrics
    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    res.on('finish', () => {
      const latency = Date.now() - startMs;
      this.metrics.totalLatencyMs += latency;
      this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1);
      const code = String(res.statusCode);
      this.metrics.statusCodes[code] = (this.metrics.statusCodes[code] || 0) + 1;
      if (res.statusCode >= 500) this.metrics.totalErrors++;
    });

    // Request queue for high-load
    if (this.options.enableRequestQueue) {
      if (this._activeQueuedRequests >= this._queueConcurrency) {
        if (this._requestQueue.length >= this._queueMaxSize) {
          res.status(503).json({ error: 'Service Unavailable', message: 'Server queue is full.' });
          return;
        }
        this._requestQueue.push({ req, res, next, startMs });
        return;
      }
      this._activeQueuedRequests++;
      const origEnd = res.end.bind(res);
      res.end = (...args) => {
        this._activeQueuedRequests--;
        this._processQueue();
        return origEnd(...args);
      };
    }

    next();
  }

  _processQueue() {
    if (this._requestQueue.length === 0) return;
    if (this._activeQueuedRequests >= this._queueConcurrency) return;
    const { req, res, next } = this._requestQueue.shift();
    this._activeQueuedRequests++;
    const origEnd = res.end.bind(res);
    res.end = (...args) => {
      this._activeQueuedRequests--;
      this._processQueue();
      return origEnd(...args);
    };
    next();
  }

  _checkRateLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const entry = this._rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      this._rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
  }

  _sanitizeObject(obj) {
    if (typeof obj === 'string') return this._sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map((v) => this._sanitizeObject(v));
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [k, v] of Object.entries(obj)) {
        sanitized[k] = this._sanitizeObject(v);
      }
      return sanitized;
    }
    return obj;
  }

  _sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  _detectSQLInjection(input) {
    return this._sqlPatterns.some((p) => p.test(input));
  }

  _errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    this.metrics.totalErrors++;
    const statusCode = err.status || err.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;
    console.error('[ServerEngine] Error:', err.message, err.stack);
    res.status(statusCode).json({
      error: http.STATUS_CODES[statusCode] || 'Error',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /**
   * Starts listening on the given port.
   * @param {number} [port] - Overrides the port given in create().
   * @returns {Promise<ServerEngine>}
   */
  start(port, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      const listenPort = port || this.defaultPort || 3000;
      if (!this.server) this.create(listenPort);
      const listenHost = host || '0.0.0.0';
      this.server.listen(listenPort, listenHost, () => {
        this.isRunning = true;
        this.startTime = Date.now();
        this._startMetricsTicker();
        console.log(`[ServerEngine] Server running on http://${listenHost}:${listenPort} (PID ${process.pid})`);
        resolve(this);
      });
      this.server.on('error', reject);
    });
  }

  /**
   * Gracefully shuts down the server.
   * @param {number} [timeout=5000] - Grace period in ms.
   * @returns {Promise<void>}
   */
  stop(timeout = 5000) {
    return new Promise((resolve) => {
      if (!this.server || !this.isRunning) {
        resolve();
        return;
      }
      clearInterval(this._metricsInterval);
      console.log('[ServerEngine] Shutting down gracefully...');
      const timer = setTimeout(() => {
        console.warn('[ServerEngine] Forcing shutdown after timeout.');
        resolve();
      }, timeout);
      this.server.close(() => {
        clearTimeout(timer);
        this.isRunning = false;
        console.log('[ServerEngine] Server stopped.');
        resolve();
      });
    });
  }

  // ─────────────────────────────────────────────
  // Clustering
  // ─────────────────────────────────────────────

  /**
   * Starts the server using Node.js cluster module for multi-core usage.
   * Call this INSTEAD of start() when you want clustering.
   * @param {number} [workers] - Number of workers. Defaults to CPU count.
   * @param {number} [port] - Port to listen on.
   * @returns {ServerEngine}
   */
  cluster(workers, port) {
    const numWorkers = workers || os.cpus().length;
    const listenPort = port || this.defaultPort || 3000;

    if (cluster.isPrimary) {
      console.log(`[ServerEngine] Primary PID ${process.pid} starting ${numWorkers} workers`);
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }
      cluster.on('exit', (worker, code, signal) => {
        console.warn(`[ServerEngine] Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
      });
    } else {
      this.start(listenPort).catch((err) => {
        console.error('[ServerEngine] Worker failed to start:', err.message);
        process.exit(1);
      });
    }
    return this;
  }

  // ─────────────────────────────────────────────
  // Metrics Ticker
  // ─────────────────────────────────────────────

  _startMetricsTicker() {
    let prev = this.metrics.totalRequests;
    this._metricsInterval = setInterval(() => {
      const current = this.metrics.totalRequests;
      this.metrics.requestsPerSecond = (current - prev);
      prev = current;
    }, 1000);
    if (this._metricsInterval.unref) this._metricsInterval.unref();
  }

  /**
   * Returns current performance metrics snapshot.
   * @returns {object}
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      avgLatencyMs: this.metrics.totalRequests > 0
        ? +(this.metrics.totalLatencyMs / this.metrics.totalRequests).toFixed(3)
        : 0,
      queueLength: this._requestQueue.length,
      sseClients: this._sseClients.size,
      wsRooms: this._rooms.size,
    };
  }

  // ─────────────────────────────────────────────
  // IP Blocking
  // ─────────────────────────────────────────────

  blockIP(ip) { this._blockedIPs.add(ip); return this; }
  unblockIP(ip) { this._blockedIPs.delete(ip); return this; }
  isBlockedIP(ip) { return this._blockedIPs.has(ip); }
}

module.exports = ServerEngine;

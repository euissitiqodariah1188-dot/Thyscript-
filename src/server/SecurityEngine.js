'use strict';

const crypto = require('crypto');

// Optional dependencies with graceful fallback implementations using native crypto
let bcrypt, jwt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = {
    hash: async (password, saltRounds = 10) => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password, salt, 64).toString('hex');
      return `pbkdf2$${salt}$${hash}`;
    },
    compare: async (password, storedHash) => {
      if (!storedHash) return false;
      if (storedHash.startsWith('pbkdf2$')) {
        const parts = storedHash.split('$');
        const salt = parts[1];
        const hash = parts[2];
        const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(attempt));
      }
      return false;
    },
  };
}
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  jwt = {
    sign: (payload, secret, options = {}) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ ...payload, exp: options.expiresIn ? Math.floor(Date.now() / 1000) + 86400 : undefined })).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      return `${header}.${body}.${sig}`;
    },
    verify: (token, secret) => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token structure');
      const expectedSig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
      if (parts[2] !== expectedSig) throw new Error('Invalid signature');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
      return payload;
    },
  };
}

/**
 * ThyScript SecurityEngine
 * Comprehensive security utilities for ThyScript servers.
 */
class SecurityEngine {
  constructor() {
    // CSRF token store: token -> { createdAt, used }
    this._csrfStore = new Map();
    this._csrfTTL = 3600000; // 1 hour

    // Rate limit store: key -> { count, resetAt }
    this._rateLimitStore = new Map();

    // Blocked IPs
    this._blockedIPs = new Set();

    // Honeypot log
    this._honeypotLog = [];

    // XSS patterns
    this._xssPatterns = [
      { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, name: 'script-tag' },
      { pattern: /javascript\s*:/gi, name: 'js-protocol' },
      { pattern: /on\w+\s*=\s*["'][^"']*["']/gi, name: 'inline-event' },
      { pattern: /<iframe[\s\S]*?>/gi, name: 'iframe' },
      { pattern: /<object[\s\S]*?>/gi, name: 'object' },
      { pattern: /<embed[\s\S]*?>/gi, name: 'embed' },
      { pattern: /eval\s*\(/gi, name: 'eval' },
      { pattern: /expression\s*\(/gi, name: 'css-expression' },
      { pattern: /vbscript\s*:/gi, name: 'vbscript' },
      { pattern: /<link[\s\S]*?>/gi, name: 'link-tag' },
    ];

    // SQL injection patterns
    this._sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE|CAST|CONVERT|DECLARE|FETCH|CURSOR|KILL|GRANT|REVOKE)\b)/gi,
      /('|")\s*;\s*--/gi,
      /\/\*[\s\S]*?\*\//g,
      /\bOR\b\s+\d+\s*=\s*\d+/gi,
      /\bAND\b\s+\d+\s*=\s*\d+/gi,
      /\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/gi,
      /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE)\s/gi,
      /'\s*--/g,
      /xp_cmdshell/gi,
      /information_schema/gi,
      /sys\.(tables|columns|objects)/gi,
    ];

    // Code injection patterns
    this._codeInjectionPatterns = [
      /\$\{[\s\S]*?\}/g,          // Template literals
      /`[\s\S]*?`/g,               // Backtick strings
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /new\s+Function/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /require\s*\(/gi,
      /child_process/gi,
      /process\.exit/gi,
      /os\.system/gi,
      /__proto__/gi,
      /constructor\s*\[/gi,
      /prototype\s*\[/gi,
    ];
  }

  // ─────────────────────────────────────────────
  // Password Hashing
  // ─────────────────────────────────────────────

  /**
   * Hashes a password using bcrypt.
   * @param {string} password
   * @param {number} [saltRounds=12]
   * @returns {Promise<string>}
   */
  async hashPassword(password, saltRounds = 12) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifies a password against a bcrypt hash.
   * @param {string} password
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    if (!password || !hash) return false;
    return bcrypt.compare(password, hash);
  }

  // ─────────────────────────────────────────────
  // JWT
  // ─────────────────────────────────────────────

  /**
   * Generates a signed JWT.
   * @param {object} payload
   * @param {string} secret
   * @param {object} [options] - jsonwebtoken sign options (e.g. { expiresIn: '1h' })
   * @returns {string}
   */
  generateToken(payload, secret, options = { expiresIn: '24h' }) {
    if (!payload || !secret) throw new Error('payload and secret are required');
    return jwt.sign(payload, secret, options);
  }

  /**
   * Verifies and decodes a JWT.
   * @param {string} token
   * @param {string} secret
   * @returns {{ valid: boolean, payload: object|null, error: string|null }}
   */
  verifyToken(token, secret) {
    try {
      const payload = jwt.verify(token, secret);
      return { valid: true, payload, error: null };
    } catch (err) {
      return { valid: false, payload: null, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // AES-256-GCM Encryption
  // ─────────────────────────────────────────────

  /**
   * Encrypts data with AES-256-GCM.
   * @param {string|Buffer} data
   * @param {string|Buffer} key - 32-byte key (hex string or Buffer)
   * @returns {{ iv: string, tag: string, ciphertext: string }}
   */
  encrypt(data, key) {
    const keyBuf = this._normalizeKey(key);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const encrypted = Buffer.concat([cipher.update(dataStr, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    };
  }

  /**
   * Decrypts AES-256-GCM encrypted data.
   * @param {{ iv: string, tag: string, ciphertext: string }} encrypted
   * @param {string|Buffer} key
   * @returns {string}
   */
  decrypt(encrypted, key) {
    const keyBuf = this._normalizeKey(key);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  _normalizeKey(key) {
    if (Buffer.isBuffer(key)) {
      if (key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key');
      return key;
    }
    if (typeof key === 'string') {
      // Treat as hex string if 64 chars, otherwise derive via SHA-256
      if (key.length === 64) return Buffer.from(key, 'hex');
      return crypto.createHash('sha256').update(key).digest();
    }
    throw new Error('Key must be a Buffer or string');
  }

  // ─────────────────────────────────────────────
  // Hashing
  // ─────────────────────────────────────────────

  /**
   * Returns SHA-256 hash of data as hex string.
   * @param {string|Buffer} data
   * @returns {string}
   */
  hashSHA256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Returns MD5 hash of data as hex string.
   * @param {string|Buffer} data
   * @returns {string}
   */
  hashMD5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Returns HMAC-SHA256 signature.
   * @param {string} data
   * @param {string} key
   * @returns {string}
   */
  hmacSHA256(data, key) {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  // ─────────────────────────────────────────────
  // Key & UUID Generation
  // ─────────────────────────────────────────────

  /**
   * Generates a cryptographically secure random key.
   * @param {number} [length=32] - Length in bytes.
   * @param {'hex'|'base64'|'buffer'} [encoding='hex']
   * @returns {string|Buffer}
   */
  generateKey(length = 32, encoding = 'hex') {
    const buf = crypto.randomBytes(length);
    if (encoding === 'buffer') return buf;
    return buf.toString(encoding);
  }

  /**
   * Generates a UUID v4.
   * @returns {string}
   */
  generateUUID() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (crypto.randomBytes(1)[0] & 0xff) % 16;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  }

  // ─────────────────────────────────────────────
  // Input Sanitization & Detection
  // ─────────────────────────────────────────────

  /**
   * Sanitizes a string to prevent XSS.
   * @param {string} input
   * @returns {string}
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    let result = input;
    // Remove dangerous patterns
    for (const { pattern } of this._xssPatterns) {
      result = result.replace(pattern, '');
    }
    // HTML entity encode
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    return result;
  }

  /**
   * Detects SQL injection patterns in input.
   * @param {string} input
   * @returns {{ detected: boolean, patterns: string[] }}
   */
  detectSQLInjection(input) {
    if (typeof input !== 'string') return { detected: false, patterns: [] };
    const found = [];
    for (const pattern of this._sqlPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(input)) found.push(pattern.toString());
    }
    return { detected: found.length > 0, patterns: found };
  }

  /**
   * Detects code injection patterns in input.
   * @param {string} input
   * @returns {{ detected: boolean, patterns: string[] }}
   */
  detectCodeInjection(input) {
    if (typeof input !== 'string') return { detected: false, patterns: [] };
    const found = [];
    for (const pattern of this._codeInjectionPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(input)) found.push(pattern.toString());
    }
    return { detected: found.length > 0, patterns: found };
  }

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────

  /**
   * Validates an email address.
   * @param {string} email
   * @returns {boolean}
   */
  validateEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim()) && email.length <= 254;
  }

  /**
   * Validates a URL.
   * @param {string} url
   * @param {string[]} [allowedProtocols=['http:', 'https:']]
   * @returns {boolean}
   */
  validateURL(url, allowedProtocols = ['http:', 'https:']) {
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return allowedProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Rate Limiting
  // ─────────────────────────────────────────────

  /**
   * Checks and enforces rate limiting.
   * @param {string} key - Identifier (e.g. IP, user ID).
   * @param {number} maxRequests - Max requests per window.
   * @param {number} windowMs - Window in milliseconds.
   * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
   */
  rateLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const entry = this._rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      const newEntry = { count: 1, resetAt: now + windowMs };
      this._rateLimitStore.set(key, newEntry);
      return { allowed: true, remaining: maxRequests - 1, resetAt: newEntry.resetAt };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
  }

  /**
   * Returns an Express middleware that enforces rate limiting.
   * @param {number} maxRequests
   * @param {number} windowMs
   * @param {function} [keyFn] - function(req) -> key. Defaults to IP.
   */
  rateLimitMiddleware(maxRequests, windowMs, keyFn) {
    return (req, res, next) => {
      const key = keyFn ? keyFn(req) : (req.ip || req.connection.remoteAddress);
      const result = this.rateLimit(key, maxRequests, windowMs);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        });
        return;
      }
      next();
    };
  }

  // ─────────────────────────────────────────────
  // CSRF
  // ─────────────────────────────────────────────

  /**
   * Creates a CSRF token and stores it.
   * @returns {string} CSRF token.
   */
  createCSRFToken() {
    const token = this.generateKey(32, 'hex');
    this._csrfStore.set(token, { createdAt: Date.now(), used: false });
    // Clean up expired tokens periodically
    if (this._csrfStore.size % 100 === 0) this._cleanCSRFStore();
    return token;
  }

  /**
   * Verifies a CSRF token (single-use).
   * @param {string} token
   * @returns {boolean}
   */
  verifyCSRFToken(token) {
    const entry = this._csrfStore.get(token);
    if (!entry) return false;
    if (entry.used) return false;
    if (Date.now() - entry.createdAt > this._csrfTTL) {
      this._csrfStore.delete(token);
      return false;
    }
    entry.used = true;
    return true;
  }

  _cleanCSRFStore() {
    const now = Date.now();
    for (const [token, entry] of this._csrfStore) {
      if (entry.used || now - entry.createdAt > this._csrfTTL) {
        this._csrfStore.delete(token);
      }
    }
  }

  /**
   * Returns an Express middleware that validates CSRF tokens.
   * Expects token in header 'X-CSRF-Token' or body field '_csrf'.
   * @param {string[]} [skipMethods=['GET','HEAD','OPTIONS']]
   */
  csrfMiddleware(skipMethods = ['GET', 'HEAD', 'OPTIONS']) {
    return (req, res, next) => {
      if (skipMethods.includes(req.method.toUpperCase())) return next();
      const token = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
      if (!token || !this.verifyCSRFToken(token)) {
        res.status(403).json({ error: 'Forbidden', message: 'Invalid or missing CSRF token.' });
        return;
      }
      next();
    };
  }

  // ─────────────────────────────────────────────
  // IP Blocking
  // ─────────────────────────────────────────────

  /**
   * Blocks an IP address.
   * @param {string} ip
   * @returns {SecurityEngine}
   */
  blockIP(ip) {
    this._blockedIPs.add(ip);
    return this;
  }

  /**
   * Unblocks an IP address.
   * @param {string} ip
   * @returns {SecurityEngine}
   */
  unblockIP(ip) {
    this._blockedIPs.delete(ip);
    return this;
  }

  /**
   * Checks if an IP is blocked.
   * @param {string} ip
   * @returns {boolean}
   */
  isBlockedIP(ip) {
    return this._blockedIPs.has(ip);
  }

  /**
   * Returns an Express middleware that blocks listed IPs.
   */
  blockIPMiddleware() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || '';
      if (this.isBlockedIP(ip)) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
        return;
      }
      next();
    };
  }

  // ─────────────────────────────────────────────
  // Honeypot
  // ─────────────────────────────────────────────

  /**
   * Returns Express middleware that redirects injection attempts to a fake handler.
   * @param {function} fakeServerHandler - Express handler (req, res) for suspicious requests.
   * @param {object} [options]
   * @param {boolean} [options.detectSQL=true]
   * @param {boolean} [options.detectCode=true]
   * @param {boolean} [options.detectXSS=true]
   * @returns {function}
   */
  honeypot(fakeServerHandler, options = { detectSQL: true, detectCode: true, detectXSS: true }) {
    return (req, res, next) => {
      const combined = [
        JSON.stringify(req.query),
        JSON.stringify(req.body || {}),
        req.url,
      ].join(' ');

      let suspicious = false;

      if (options.detectSQL !== false) {
        const { detected } = this.detectSQLInjection(combined);
        if (detected) suspicious = true;
      }

      if (!suspicious && options.detectCode !== false) {
        const { detected } = this.detectCodeInjection(combined);
        if (detected) suspicious = true;
      }

      if (!suspicious && options.detectXSS !== false) {
        const xssFound = this._xssPatterns.some(({ pattern }) => {
          pattern.lastIndex = 0;
          return pattern.test(combined);
        });
        if (xssFound) suspicious = true;
      }

      if (suspicious) {
        const ip = req.ip || req.connection.remoteAddress;
        const logEntry = {
          timestamp: new Date().toISOString(),
          ip,
          method: req.method,
          url: req.url,
          query: req.query,
          body: req.body,
        };
        this._honeypotLog.push(logEntry);
        console.warn('[SecurityEngine] Honeypot triggered:', logEntry);
        this.blockIP(ip);
        if (typeof fakeServerHandler === 'function') {
          return fakeServerHandler(req, res);
        }
        return res.status(200).send('OK'); // Fake success
      }

      next();
    };
  }

  /**
   * Returns the honeypot activity log.
   * @returns {object[]}
   */
  getHoneypotLog() {
    return [...this._honeypotLog];
  }

  // ─────────────────────────────────────────────
  // Content Security Policy
  // ─────────────────────────────────────────────

  /**
   * Returns an Express middleware that sets CSP headers.
   * @param {object} [options] - CSP directives.
   * @returns {function}
   */
  contentSecurityPolicy(options = {}) {
    const directives = Object.assign({
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    }, options);

    const cspString = Object.entries(directives)
      .map(([key, val]) => `${key} ${Array.isArray(val) ? val.join(' ') : val}`)
      .join('; ');

    return (req, res, next) => {
      res.setHeader('Content-Security-Policy', cspString);
      next();
    };
  }

  // ─────────────────────────────────────────────
  // Helmet-like Security Headers
  // ─────────────────────────────────────────────

  /**
   * Returns an Express middleware that sets comprehensive security headers.
   * @param {object} [options]
   * @returns {function}
   */
  helmet(options = {}) {
    return (req, res, next) => {
      // Prevent MIME sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Clickjacking protection
      res.setHeader('X-Frame-Options', options.frameOptions || 'DENY');
      // XSS filter (legacy browsers)
      res.setHeader('X-XSS-Protection', '1; mode=block');
      // HSTS
      if (options.hsts !== false) {
        res.setHeader(
          'Strict-Transport-Security',
          options.hstsHeader || 'max-age=31536000; includeSubDomains; preload'
        );
      }
      // Referrer policy
      res.setHeader('Referrer-Policy', options.referrerPolicy || 'strict-origin-when-cross-origin');
      // Permissions policy
      res.setHeader(
        'Permissions-Policy',
        options.permissionsPolicy || 'geolocation=(), microphone=(), camera=()'
      );
      // Remove X-Powered-By
      res.removeHeader('X-Powered-By');
      // DNS prefetch control
      res.setHeader('X-DNS-Prefetch-Control', 'off');
      // Expect-CT
      if (options.expectCT) {
        res.setHeader('Expect-CT', 'max-age=86400, enforce');
      }
      // Cache control for sensitive routes
      if (options.noCache) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    };
  }

  // ─────────────────────────────────────────────
  // Constant-time comparison (prevent timing attacks)
  // ─────────────────────────────────────────────

  /**
   * Compares two strings in constant time to prevent timing attacks.
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

module.exports = SecurityEngine;

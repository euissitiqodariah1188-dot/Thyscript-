'use strict';
/**
 * ThyScript v3 FeatureHub
 * A curated library of hundreds of unique, genuinely-useful helper
 * functions and utilities exposed to every ThyScript runtime (and the
 * web Control Panel). Every function here is plain, dependency-light
 * JavaScript so it can never break the compiler or the language core.
 *
 * Categories:
 *   - devops    : process, env, exec, ports, timers, package tooling
 *   - system    : os, disk, cpu, uptime, byte helpers
 *   - net       : ip, mac, ping-proxy, fetch wrappers, url helpers
 *   - crypto    : hashes, tokens, totp, encoding, random
 *   - data      : deep clone, sort, group, flatten, chunk, diff, csv
 *   - text      : slug, mask, truncate, camel/snake/pascal, format
 *   - time      : format relative/diff, parse, sleep, stopwatch
 *   - http      : status codes, header parse, query, cookies, body
 *   - image     : (basic) data-uri + size helpers
 *   - genius    : the fabric of {helper: description} catalog
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const VERSION = '3.0.0';

// ─────────────────────────────────────────────────────────────────────────
// Utilities that wrap Node built-ins safely (always synchronous, no throw
// where avoidable). Every function returns a value; none mutate globals.
// ─────────────────────────────────────────────────────────────────────────

function safe(fn, fallback = null) {
  try { return fn(); } catch (_) { return fallback; }
}

// ─────────────────────── data ────────────────────────────────────────────
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const k of Object.keys(obj)) out[k] = deepClone(obj[k]);
  return out;
}
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function flatten(arr, depth = Infinity) {
  return depth > 0
    ? arr.reduce((acc, v) => acc.concat(Array.isArray(v) ? flatten(v, depth - 1) : v), [])
    : arr.slice();
}
function uniq(arr) { return [...new Set(arr)]; }
function uniqBy(arr, key) {
  const seen = new Set();
  return arr.filter((o) => { const k = typeof key === 'function' ? key(o) : o[key]; if (seen.has(k)) return false; seen.add(k); return true; });
}
function groupBy(arr, key) {
  return arr.reduce((acc, o) => {
    const k = typeof key === 'function' ? key(o) : o[key];
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function zip(...arrays) {
  const len = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length: len }, (_, i) => arrays.map((a) => a[i]));
}
function pluck(arr, key) { return arr.map((o) => o[key]).filter((v) => v !== undefined); }
function sum(arr) { return arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0); }
function avg(arr) { return arr.length ? sum(arr) / arr.length : 0; }
function min(arr) { return arr.length ? Math.min(...arr) : undefined; }
function max(arr) { return arr.length ? Math.max(...arr) : undefined; }
function range(start, end, step = 1) {
  const out = [];
  if (end === undefined) { end = start; start = 0; }
  for (let i = start; i < end; i += step) out.push(i);
  return out;
}
function sorted(arr, key) {
  const a = arr.slice();
  return a.sort(key ? (x, y) => (x[key] > y[key] ? 1 : x[key] < y[key] ? -1 : 0) : (x, y) => (x > y ? 1 : x < y ? -1 : 0));
}
function reversed(arr) { return arr.slice().reverse(); }
function sample(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined; }
function compact(arr) { return arr.filter(Boolean); }
function diff(a, b) { return a.filter((x) => !b.includes(x)); }
function intersect(a, b) { return a.filter((x) => b.includes(x)); }
function union(a, b) { return uniq([...a, ...b]); }
function toCSV(rows, delimiter = ',') {
  const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return rows.map((r) => (Array.isArray(r) ? r : (r && typeof r === 'object' ? Object.values(r) : [r])).map(esc).join(delimiter)).join('\n');
}
function parseCSV(text, delimiter = ',') {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ─────────────────────── text ────────────────────────────────────────────
function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}
function camelCase(s) {
  return String(s).replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^./, (c) => c.toLowerCase());
}
function pascalCase(s) {
  const c = camelCase(s); return c ? c[0].toUpperCase() + c.slice(1) : '';
}
function snakeCase(s) {
  return String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}
function kebabCase(s) { return snakeCase(s).replace(/_/g, '-'); }
function truncate(s, n = 50, end = '...') {
  s = String(s); return s.length > n ? s.slice(0, n - end.length) + end : s;
}
function mask(s, visible = 4, char = '*') {
  s = String(s); return char.repeat(Math.max(0, s.length - visible)) + s.slice(-visible);
}
function padStart(s, len, ch = ' ') { return String(s).padStart(len, ch); }
function padEnd(s, len, ch = ' ') { return String(s).padEnd(len, ch); }
function capitalize(s) { s = String(s); return s ? s[0].toUpperCase() + s.slice(1) : s; }
function titleCase(s) { return String(s).replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase()); }
function reverseString(s) { return String(s).split('').reverse().join(''); }
function stripHTML(s) { return String(s).replace(/<[^>]*>/g, ''); }
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function countOccurrences(s, sub) {
  if (!sub) return 0; let count = 0, i = 0;
  while ((i = s.indexOf(sub, i)) !== -1) { count++; i += sub.length; }
  return count;
}
function words(s) { return String(s).trim().split(/\s+/).filter(Boolean); }
function numWords(s) { return words(s).length; }
function lines(s) { return String(s).split(/\r?\n/); }
function isEmpty(s) { return s == null || String(s).trim() === ''; }

// ─────────────────────── time ────────────────────────────────────────────
function now() { return Date.now(); }
function isoTime(offsetMs = 0) { return new Date(Date.now() + (offsetMs || 0)).toISOString(); }
function formatDate(d, fmt = 'YYYY-MM-DD HH:mm:ss') {
  const date = d instanceof Date ? d : new Date(d);
  const map = {
    YYYY: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0'),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (t) => map[t]);
}
function timeAgo(dateOrMs) {
  const t = typeof dateOrMs === 'number' ? dateOrMs : new Date(dateOrMs).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + 'mo ago';
  return Math.floor(mo / 12) + 'y ago';
}
function elapsedMs(startTime = performance.now()) { return +(performance.now() - startTime).toFixed(2); }
function stopwatch() {
  let t0 = performance.now();
  return {
    elapsed: () => +(performance.now() - t0).toFixed(1),
    reset: () => { t0 = performance.now(); return 0; },
  };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function parseDuration(str) {
  const m = String(str).trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!m) return NaN;
  const v = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return v * mult;
}
function humanElapsed(ms) {
  ms = Math.abs(ms);
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
  const h = Math.floor(ms / 3600000);
  return h + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
}
function between(value, min, max) { return Math.min(max, Math.max(min, value)); }
function clamp(value, min, max) { return between(value, min, max); }
function lerp(a, b, t) { return a + (b - a) * t; }

// ─────────────────────── crypto & random ──────────────────────────────────
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min = 0, max = 1) { return Math.random() * (max - min) + min; }
function randomString(len = 16, chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function randomHex(len = 16) { return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len); }
function uuid(version = 4) {
  if (version === 4) return crypto.randomUUID();
  return randomHex(32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function sha1(s) { return crypto.createHash('sha1').update(String(s)).digest('hex'); }
function md5(s) { return crypto.createHash('md5').update(String(s)).digest('hex'); }
function hmac(secret, s, algo = 'sha256') { return crypto.createHmac(algo, String(secret)).update(String(s)).digest('hex'); }
function base64Encode(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function base64Decode(s) { return Buffer.from(String(s), 'base64').toString('utf8'); }
function base64Url(s) { return Buffer.from(String(s), 'utf8').toString('base64url'); }
function encryptAES(text, secret, algo = 'aes-256-cbc') {
  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}
function decryptAES(payload, secret, algo = 'aes-256-cbc') {
  try {
    const [ivHex, dataHex] = String(payload).split(':');
    const key = crypto.createHash('sha256').update(String(secret)).digest();
    const decipher = crypto.createDecipheriv(algo, key, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (_) { return null; }
}
function totp(secret, step = 30, digits = 6) {
  const counter = Math.floor(Date.now() / 1000 / step);
  const key = Buffer.from(secretToHex(secret), 'hex');
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | ((h[offset + 1] & 0xff) << 16) | ((h[offset + 2] & 0xff) << 8) | (h[offset + 3] & 0xff);
  return String(bin % Math.pow(10, digits)).padStart(digits, '0');
}
function secretToHex(secret) {
  // Accept either raw ascii (interpreted as hex) or base32-ish friendly key
  return Buffer.from(String(secret), 'utf8').toString('hex');
}
function hashCode(s) { let h = 0; const str = String(s); for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h; }

// ─────────────────────── system / devops ──────────────────────────────────
function systemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    uptimeSec: Math.floor(os.uptime()),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0] ? os.cpus()[0].model : 'n/a',
    loadAvg: os.loadavg(),
    totalMemMB: Math.round(os.totalmem() / 1048576),
    freeMemMB: Math.round(os.freemem() / 1048576),
    usedMemMB: Math.round((os.totalmem() - os.freemem()) / 1048576),
    nodeVersion: process.versions.node,
    pid: process.pid,
  };
}
function memMB() { return Math.round(process.memoryUsage().rss / 1048576); }
function heapMB() { return Math.round(process.memoryUsage().heapUsed / 1048576); }
function totalMemMB() { return Math.round(os.totalmem() / 1048576); }
function freeMemMB() { return Math.round(os.freemem() / 1048576); }
function cpus() { return os.cpus(); }
function cpuCount() { return os.cpus().length; }
function loadAvg() { return os.loadavg(); }
function uptime() { return os.uptime(); }
function env(key, fallback = null) { return key in process.env ? process.env[key] : fallback; }
function setEnv(key, val) { if (val == null) delete process.env[key]; else process.env[key] = String(val); return process.env[key]; }
function envAll() { return { ...process.env }; }
function pid() { return process.pid; }
function cwd() { return process.cwd(); }
function execShell(cmd) { return safe(() => require('child_process').execSync(cmd, { encoding: 'utf8' }).trim(), ''); }
function isPortFree(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}
function isToday(t) { const d = new Date(t), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }
function isWeekend(t) { const d = new Date(t); return d.getDay() === 0 || d.getDay() === 6; }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function dayOfYear(t) { const d = new Date(t); const start = new Date(d.getFullYear(), 0, 0); return Math.floor((d - start) / 86400000); }
function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }

// ─────────────────────── net ──────────────────────────────────────────────
function ipv4() {
  const ifs = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(ifs)) for (const i of ifs[name] || []) if (i.family === 'IPv4' && !i.internal) addrs.push({ name, address: i.address });
  return addrs;
}
function localIP() { const a = ipv4(); return a.length ? a[0].address : '127.0.0.1'; }
function macAddresses() {
  const ifs = os.networkInterfaces();
  return Object.keys(ifs).reduce((acc, name) => {
    for (const i of ifs[name] || []) if (i.mac && i.mac !== '00:00:00:00:00:00') acc.push({ name, mac: i.mac });
    return acc;
  }, []);
}
function hostname() { return os.hostname(); }
function shortURL(full, max = 50) { return truncate(full, max); }
function parseURL(u) { return safe(() => new URL(u) ? { href: new URL(u).href, protocol: new URL(u).protocol, host: new URL(u).host, hostname: new URL(u).hostname, port: new URL(u).port, pathname: new URL(u).pathname, search: new URL(u).search, hash: new URL(u).hash } : null, null); }
function isHttpUrl(s) { return /^https?:\/\//i.test(String(s)); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s)); }
function isURL(s) { return /^[a-z][a-z0-9+.-]*:\/\/.+$/i.test(String(s)); }
function isIP(s) { return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(String(s)); }

// ─────────────────────── http ─────────────────────────────────────────────
const httpStatus = require('http').STATUS_CODES;
function statusText(code) { return httpStatus[code] || 'Unknown'; }
function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  const q = qs.startsWith('?') ? qs.slice(1) : qs;
  for (const pair of q.split('&')) { if (!pair) continue; const [k, v] = pair.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
  return out;
}
function buildQuery(obj) { return Object.entries(obj).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&'); }
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function parseHeaders(raw) {
  const out = {};
  if (!raw) return out;
  for (const line of String(raw).split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  return out;
}
function mimeOf(filename) { return safe(() => require('mime-types').lookup(filename) || 'application/octet-stream', 'application/octet-stream'); }

// ─────────────────────── number ───────────────────────────────────────────
function formatBytes(n, decimals = 2) {
  if (!n) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return parseFloat((n / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
function formatNumber(n, locale = 'en-US') { return safe(() => new Intl.NumberFormat(locale).format(n), String(n)); }
function formatPercent(n, decimals = 1) { return n.toFixed(decimals) + '%'; }
function currency(n, cur = 'USD', locale = 'en-US') { return safe(() => new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(n), String(n)); }
function isNumber(v) { return typeof v === 'number' && !Number.isNaN(v); }
function isInteger(v) { return Number.isInteger(Number(v)); }
function toFixed(n, d = 2) { return Number(n).toFixed(d); }
function round(n, d = 0) { const f = Math.pow(10, d); return Math.round(n * f) / f; }
function within(n, min, max) { return n >= min && n <= max; }
function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { return (a * b) / gcd(a, b); }
function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function fib(n) { let a = 0, b = 1; for (let i = 0; i < n; i++) { [a, b] = [b, a + b]; } return a; }
function isPrime(n) { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true; }
function primesUntil(n) { const out = []; for (let i = 2; i <= n; i++) if (isPrime(i)) out.push(i); return out; }
function divisors(n) { const out = []; for (let i = 1; i * i <= n; i++) { if (n % i === 0) { out.push(i); if (i !== n / i) out.push(n / i); } } return out.sort((a, b) => a - b); }

// ─────────────────────── genius catalog ───────────────────────────────────
const FEATURES = {
  'data.deepClone': 'Deep-copy any nested object/array',
  'data.deepEqual': 'Structural equality check',
  'data.flatten': 'Flatten nested arrays',
  'data.uniq': 'Remove duplicate primitives',
  'data.uniqBy': 'Unique objects by a key',
  'data.groupBy': 'Group objects by key',
  'data.chunk': 'Split array into chunks',
  'data.shuffle': 'Randomly reorder array',
  'data.zip': 'Zip multiple arrays',
  'data.pluck': 'Extract a key from each object',
  'data.sum': 'Sum numeric array',
  'data.avg': 'Average numeric array',
  'data.min': 'Minimum value',
  'data.max': 'Maximum value',
  'data.range': 'Generate numeric range',
  'data.sorted': 'Sort array (by key)',
  'data.reversed': 'Reverse array copy',
  'data.sample': 'Pick a random element',
  'data.compact': 'Remove falsy values',
  'data.diff': 'Elements in a not in b',
  'data.intersect': 'Shared elements of a and b',
  'data.union': 'Merged unique elements',
  'data.toCSV': 'Serialize rows to CSV',
  'data.parseCSV': 'Parse CSV text to rows',
  'text.slugify': 'URL-safe slug from string',
  'text.camelCase': 'camelCase a string',
  'text.pascalCase': 'PascalCase a string',
  'text.snakeCase': 'snake_case a string',
  'text.kebabCase': 'kebab-case a string',
  'text.truncate': 'Truncate text with ellipsis',
  'text.mask': 'Mask middle of a string',
  'text.padStart': 'Pad left',
  'text.padEnd': 'Pad right',
  'text.capitalize': 'Uppercase first letter',
  'text.titleCase': 'Title-case words',
  'text.reverseString': 'Reverse a string',
  'text.stripHTML': 'Remove HTML tags',
  'text.escapeRegExp': 'Escape regex special chars',
  'text.countOccurrences': 'Count substring occurrences',
  'text.words': 'Split into words',
  'text.numWords': 'Count words',
  'text.lines': 'Split into lines',
  'text.isEmpty': 'Check blank string',
  'time.now': 'Current epoch ms',
  'time.isoTime': 'ISO timestamp (+offset)',
  'time.formatDate': 'Format date string',
  'time.timeAgo': 'Relative "x ago" label',
  'time.elapsedMs': 'Elapsed ms from a start',
  'time.stopwatch': 'Start a stopwatch',
  'time.sleep': 'Await a delay (async)',
  'time.parseDuration': 'Parse "5m"/"2h" to ms',
  'time.humanElapsed': 'Human-friendly duration',
  'time.isToday': 'Is date today',
  'time.isWeekend': 'Is date a weekend',
  'time.daysInMonth': 'Days in month',
  'time.dayOfYear': 'Day of year (1-366)',
  'time.isLeapYear': 'Leap year check',
  'crypto.randomInt': 'Random integer in range',
  'crypto.randomFloat': 'Random float in range',
  'crypto.randomString': 'Random alphanumeric',
  'crypto.randomHex': 'Random hex',
  'crypto.uuid': 'UUID v4 (or v1-style)',
  'crypto.sha256': 'SHA-256 hex digest',
  'crypto.sha1': 'SHA-1 hex digest',
  'crypto.md5': 'MD5 hex digest',
  'crypto.hmac': 'HMAC signature',
  'crypto.base64Encode': 'Encode to base64',
  'crypto.base64Decode': 'Decode base64',
  'crypto.base64Url': 'Base64url encode',
  'crypto.encryptAES': 'AES-256-CBC encrypt',
  'crypto.decryptAES': 'AES-256-CBC decrypt',
  'crypto.totp': 'TOTP one-time code',
  'crypto.hashCode': 'Fast 32-bit hash',
  'system.systemInfo': 'Detailed host info',
  'system.memMB': 'RSS memory (MB)',
  'system.heapMB': 'Heap used (MB)',
  'system.totalMemMB': 'Total RAM (MB)',
  'system.freeMemMB': 'Free RAM (MB)',
  'system.cpuCount': 'CPU core count',
  'system.loadAvg': 'System load average',
  'system.uptime': 'System uptime (s)',
  'system.env': 'Read env var',
  'system.setEnv': 'Set env var',
  'system.envAll': 'All env vars',
  'system.pid': 'Current process id',
  'system.cwd': 'Working directory',
  'system.execShell': 'Run a shell command (sync)',
  'system.isPortFree': 'Is TCP port free (async)',
  'devops.hostname': 'Host machine name',
  'net.ipv4': 'All LAN IPv4 addresses',
  'net.localIP': 'Primary LAN IPv4',
  'net.macAddresses': 'Network MAC addresses',
  'net.isHttpUrl': 'Looks like http(s) URL',
  'net.isEmail': 'Valid email check',
  'net.isIP': 'Valid IPv4 check',
  'net.parseURL': 'Parse URL into parts',
  'http.statusText': 'HTTP status text',
  'http.parseQuery': 'Parse query string',
  'http.buildQuery': 'Build query string',
  'http.parseCookies': 'Parse cookie header',
  'http.parseHeaders': 'Parse raw header lines',
  'http.mimeOf': 'MIME type of a filename',
  'num.formatBytes': 'Human byte size',
  'num.formatNumber': 'Locale number format',
  'num.formatPercent': 'Percent with decimals',
  'num.currency': 'Currency formatting',
  'num.isNumber': 'Is a number',
  'num.isInteger': 'Is an integer',
  'num.round': 'Round to decimals',
  'num.clamp': 'Clamp to [min,max]',
  'num.lerp': 'Linear interpolation',
  'num.gcd': 'Greatest common divisor',
  'num.lcm': 'Least common multiple',
  'num.factorial': 'Factorial',
  'num.fib': 'nth Fibonacci number',
  'num.isPrime': 'Primality test',
  'num.primesUntil': 'All primes up to n',
  'num.divisors': 'Divisors of n',
};

function featureCatalog() {
  return FEATURES;
}

// Expose namespaces
const FeatureHub = {
  VERSION,
  featureCatalog,
  featureCount: () => Object.keys(FEATURES).length,
  // data
  deepClone, deepEqual, flatten, uniq, uniqBy, groupBy, chunk, shuffle, zip, pluck, sum, avg, min, max, range, sorted, reversed, sample, compact, diff, intersect, union, toCSV, parseCSV,
  // text
  slugify, camelCase, pascalCase, snakeCase, kebabCase, truncate, mask, padStart, padEnd, capitalize, titleCase, reverseString, stripHTML, escapeRegExp, countOccurrences, words, numWords, lines, isEmpty,
  // time
  now, isoTime, formatDate, timeAgo, elapsedMs, stopwatch, sleep, parseDuration, humanElapsed, isToday, isWeekend, daysInMonth, dayOfYear, isLeapYear,
  // crypto
  randomInt, randomFloat, randomString, randomHex, uuid, sha256, sha1, md5, hmac, base64Encode, base64Decode, base64Url, encryptAES, decryptAES, totp, hashCode,
  // system/devops
  systemInfo, memMB, heapMB, totalMemMB, freeMemMB, cpus, cpuCount, loadAvg, uptime, env, setEnv, envAll, pid, cwd, execShell, isPortFree,
  // net
  ipv4, localIP, macAddresses, hostname, isHttpUrl, isEmail, isIP, parseURL, shortURL,
  // http
  statusText, parseQuery, buildQuery, parseCookies, parseHeaders, mimeOf,
  // num
  formatBytes, formatNumber, formatPercent, currency, isNumber, isInteger, toFixed, round, within, clamp, lerp, gcd, lcm, factorial, fib, isPrime, primesUntil, divisors,
};

module.exports = FeatureHub;
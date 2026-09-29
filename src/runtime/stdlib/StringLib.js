'use strict';

/**
 * ThyStringLib - ThyScript Standard String Library
 * Provides rich string manipulation: formatting, encoding, compression,
 * fuzzy matching, CSV/JSON, regex, NLP basics, and more.
 */

const zlib = require('zlib');
const { promisify } = require('util');

const gzipAsync   = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

class ThyStringLib {
  // ─── Basic Ops ────────────────────────────────────────────────────────────

  trim(str)              { return str.trim(); }
  trimStart(str)         { return str.trimStart(); }
  trimEnd(str)           { return str.trimEnd(); }
  upper(str)             { return str.toUpperCase(); }
  lower(str)             { return str.toLowerCase(); }
  replace(str, from, to) { return str.split(from).join(to); }
  split(str, sep, limit) { return limit !== undefined ? str.split(sep, limit) : str.split(sep); }
  join(arr, sep = '')    { return arr.join(sep); }
  slice(str, start, end) { return str.slice(start, end); }
  indexOf(str, sub, pos) { return str.indexOf(sub, pos); }
  lastIndexOf(str, sub)  { return str.lastIndexOf(sub); }
  includes(str, sub)     { return str.includes(sub); }
  startsWith(str, prefix){ return str.startsWith(prefix); }
  endsWith(str, suffix)  { return str.endsWith(suffix); }
  padStart(str, len, ch) { return str.padStart(len, ch); }
  padEnd(str, len, ch)   { return str.padEnd(len, ch); }
  repeat(str, n)         { return str.repeat(n); }

  /** Reverse a string. */
  reverse(str) { return [...str].reverse().join(''); }

  // ─── Formatting ───────────────────────────────────────────────────────────

  /**
   * printf-style format: %s (string), %d (int), %f (float), %j (json).
   * @param {string} template
   * @param {...*} args
   * @returns {string}
   */
  format(template, ...args) {
    let i = 0;
    return template.replace(/%([sdfj%])/g, (_, spec) => {
      if (spec === '%') return '%';
      const arg = args[i++];
      if (spec === 's') return String(arg ?? '');
      if (spec === 'd') return String(Math.round(Number(arg)));
      if (spec === 'f') return Number(arg).toFixed(6);
      if (spec === 'j') return JSON.stringify(arg);
      return _;
    });
  }

  /**
   * Template interpolation using {{key}} placeholders.
   * @param {string} template
   * @param {object} obj
   * @returns {string}
   */
  interpolate(template, obj) {
    return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (_, key) => {
      const parts = key.trim().split('.');
      let val = obj;
      for (const p of parts) val = val?.[p];
      return val == null ? '' : String(val);
    });
  }

  // ─── Case Conversions ─────────────────────────────────────────────────────

  /** Convert camelCase to snake_case. */
  camelToSnake(str) {
    return str
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase();
  }

  /** Convert snake_case to camelCase. */
  snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  /** Capitalize first letter. */
  capitalize(str) {
    if (!str) return str;
    return str[0].toUpperCase() + str.slice(1).toLowerCase();
  }

  /** Title case every word. */
  titleCase(str) {
    return str.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }

  // ─── Truncation ───────────────────────────────────────────────────────────

  /**
   * Truncate a string to len characters, appending suffix if needed.
   * @param {string} str
   * @param {number} len
   * @param {string} suffix
   * @returns {string}
   */
  truncate(str, len, suffix = '...') {
    if (str.length <= len) return str;
    return str.slice(0, len - suffix.length) + suffix;
  }

  // ─── Counts ───────────────────────────────────────────────────────────────

  wordCount(str)  { return str.trim() === '' ? 0 : str.trim().split(/\s+/).length; }
  charCount(str)  { return str.length; }
  lineCount(str)  { return str.split('\n').length; }

  // ─── Encoding ─────────────────────────────────────────────────────────────

  /** Encode string to base64. */
  toBase64(str) { return Buffer.from(str, 'utf8').toString('base64'); }

  /** Decode base64 string. */
  fromBase64(b64) { return Buffer.from(b64, 'base64').toString('utf8'); }

  // ─── HTML Entities ────────────────────────────────────────────────────────

  /** Escape HTML special characters. */
  escape(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Unescape HTML entities. */
  unescape(str) {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // ─── Slugify ─────────────────────────────────────────────────────────────

  /**
   * Convert a string to a URL-safe slug.
   * @param {string} str
   * @returns {string}
   */
  slugify(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-');
  }

  // ─── Edit Distance ────────────────────────────────────────────────────────

  /**
   * Levenshtein edit distance between two strings.
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // ─── Fuzzy Match ─────────────────────────────────────────────────────────

  /**
   * Fuzzy match: returns a similarity score in [0, 1].
   * Uses normalised Levenshtein distance.
   * @param {string} needle
   * @param {string} haystack
   * @returns {number}
   */
  fuzzyMatch(needle, haystack) {
    needle = needle.toLowerCase();
    haystack = haystack.toLowerCase();
    if (needle === haystack) return 1;
    if (needle.length === 0) return 0;
    const dist = this.levenshtein(needle, haystack);
    return 1 - dist / Math.max(needle.length, haystack.length);
  }

  // ─── CSV ─────────────────────────────────────────────────────────────────

  /**
   * Parse a CSV string into a 2D array. Handles quoted fields.
   * @param {string} str
   * @param {string} delimiter
   * @returns {string[][]}
   */
  parseCSV(str, delimiter = ',') {
    const rows = [];
    const lines = str.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let inQuote = false, cell = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === delimiter && !inQuote) {
          row.push(cell); cell = '';
        } else {
          cell += ch;
        }
      }
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  /**
   * Convert 2D array to CSV string. Quotes fields containing delimiter/newline.
   * @param {string[][]} data
   * @param {string} delimiter
   * @returns {string}
   */
  stringifyCSV(data, delimiter = ',') {
    return data.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return s.includes(delimiter) || s.includes('\n') || s.includes('"')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(delimiter)
    ).join('\n');
  }

  // ─── JSON ─────────────────────────────────────────────────────────────────

  /**
   * Parse JSON string with error context.
   * @param {string} str
   * @returns {*}
   */
  parseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      throw new SyntaxError(`ThyStringLib.parseJSON: ${e.message}`);
    }
  }

  /**
   * Stringify to JSON, optionally pretty-printed.
   * @param {*} val
   * @param {boolean} pretty
   * @returns {string}
   */
  stringifyJSON(val, pretty = false) {
    return pretty ? JSON.stringify(val, null, 2) : JSON.stringify(val);
  }

  // ─── Compression ─────────────────────────────────────────────────────────

  /**
   * Compress a string using gzip. Returns a Buffer.
   * @param {string} str
   * @returns {Promise<Buffer>}
   */
  async compress(str) {
    return gzipAsync(Buffer.from(str, 'utf8'));
  }

  /**
   * Decompress a gzip Buffer to string.
   * @param {Buffer} buf
   * @returns {Promise<string>}
   */
  async decompress(buf) {
    const out = await gunzipAsync(buf);
    return out.toString('utf8');
  }

  // ─── Regex ────────────────────────────────────────────────────────────────

  /**
   * Return all regex matches in str.
   * @param {string} str
   * @param {RegExp|string} pattern
   * @param {string} flags
   * @returns {RegExpMatchArray[]}
   */
  regexMatch(str, pattern, flags = 'g') {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
    return [...str.matchAll(re)];
  }

  /**
   * Test if str matches pattern.
   * @param {string} str
   * @param {RegExp|string} pattern
   * @returns {boolean}
   */
  regexTest(str, pattern) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return re.test(str);
  }

  /**
   * Replace using regex.
   * @param {string} str
   * @param {RegExp|string} pattern
   * @param {string|function} replacement
   * @param {string} flags
   * @returns {string}
   */
  regexReplace(str, pattern, replacement, flags = 'g') {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags);
    return str.replace(re, replacement);
  }

  // ─── Tokenize ────────────────────────────────────────────────────────────

  /**
   * Split string into word tokens (strips punctuation).
   * @param {string} str
   * @returns {string[]}
   */
  tokenize(str) {
    return str.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
  }

  // ─── Sentiment ───────────────────────────────────────────────────────────

  static _positiveWords = new Set([
    'good','great','excellent','amazing','wonderful','fantastic','happy',
    'love','best','awesome','beautiful','nice','perfect','superb','joy',
    'brilliant','delightful','outstanding','positive','success','win',
    'helpful','innovative','effective','enjoy','like','fun','exciting',
  ]);

  static _negativeWords = new Set([
    'bad','terrible','awful','horrible','hate','worst','ugly','poor',
    'failure','sad','angry','frustrating','boring','waste','broken',
    'useless','annoying','negative','wrong','error','problem','fail',
    'difficult','confusing','disappointing','slow','crash','bug',
  ]);

  /**
   * Simple bag-of-words sentiment analysis.
   * @param {string} str
   * @returns {{ score: number, label: 'positive'|'negative'|'neutral', pos: number, neg: number }}
   */
  sentiment(str) {
    const tokens = this.tokenize(str);
    let pos = 0, neg = 0;
    for (const t of tokens) {
      if (ThyStringLib._positiveWords.has(t)) pos++;
      if (ThyStringLib._negativeWords.has(t)) neg++;
    }
    const score = pos - neg;
    const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    return { score, label, pos, neg };
  }
}

module.exports = ThyStringLib;

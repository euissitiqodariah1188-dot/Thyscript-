'use strict';
/**
 * ThyScript Error Detector
 * High-speed static code analysis and error detection engine.
 * Scans tokens and AST for syntax and semantic bugs,
 * providing pinpoint code location pointers and actionable fix suggestions.
 */

const ErrorMessages = require('./ErrorMessages');

class ErrorDetector {
  constructor(options = {}) {
    this.options = Object.assign({
      maxErrors: 20,
      warnUnused: true,
      strictTypes: false,
    }, options);
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Complete scan of tokens, AST, and raw source
   * @param {Array} tokens - Tokens from Lexer
   * @param {Object} ast - AST from Parser
   * @param {string} source - Raw source code
   * @param {string} filename - Source filename
   * @returns {Object} { errors: [], warnings: [], isValid: boolean }
   */
  scan(tokens = [], ast = null, source = '', filename = '<anonymous>') {
    this.errors = [];
    this.warnings = [];

    // Pass 1: Token-level syntax scan
    if (tokens && tokens.length > 0) {
      this.detectSyntaxErrors(tokens, source, filename);
    }

    // Pass 2: AST-level semantic scan
    if (ast) {
      this.detectSemanticErrors(ast, source, filename);
    }

    return {
      errors: this.errors,
      warnings: this.warnings,
      isValid: this.errors.length === 0,
    };
  }

  /**
   * Fast token stream validation
   */
  detectSyntaxErrors(tokens, source, filename) {
    const bracketStack = [];
    const parenStack = [];
    const braceStack = [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      // Bracket balancing
      if (tok.type === 'LPAREN') parenStack.push(tok);
      else if (tok.type === 'RPAREN') {
        if (parenStack.length === 0) {
          this._addError('THY-004', [')'], tok.line, tok.col, filename, source, 'Remove unmatched closing parenthesis');
        } else {
          parenStack.pop();
        }
      } else if (tok.type === 'LBRACKET') bracketStack.push(tok);
      else if (tok.type === 'RBRACKET') {
        if (bracketStack.length === 0) {
          this._addError('THY-004', [']'], tok.line, tok.col, filename, source, 'Remove unmatched closing square bracket');
        } else {
          bracketStack.pop();
        }
      } else if (tok.type === 'LBRACE') braceStack.push(tok);
      else if (tok.type === 'RBRACE') {
        if (braceStack.length === 0) {
          this._addError('THY-004', ['}'], tok.line, tok.col, filename, source, 'Remove unmatched closing curly brace');
        } else {
          braceStack.pop();
        }
      }

      // Check for consecutive operators e.g. ++ without operand or ** /
      if (tok.type === 'PLUS' && tokens[i + 1] && tokens[i + 1].type === 'STAR') {
        this._addError('THY-001', ['*'], tok.line, tok.col, filename, source, 'Unexpected * following + operator');
      }

      // Stop scanning if max errors reached
      if (this.errors.length >= this.options.maxErrors) break;
    }

    // Report unclosed brackets
    while (parenStack.length > 0) {
      const tok = parenStack.pop();
      this._addError('THY-004', ['('], tok.line, tok.col, filename, source, 'Add matching closing parenthesis )');
    }
    while (bracketStack.length > 0) {
      const tok = bracketStack.pop();
      this._addError('THY-004', ['['], tok.line, tok.col, filename, source, 'Add matching closing bracket ]');
    }
    while (braceStack.length > 0) {
      const tok = braceStack.pop();
      this._addError('THY-004', ['{'], tok.line, tok.col, filename, source, 'Add matching closing brace }');
    }
  }

  /**
   * Semantic AST validation
   */
  detectSemanticErrors(ast, source, filename) {
    const declaredVars = new Set();
    const declaredFuncs = new Set();
    const usedVars = new Set();

    // Standard builtins known to ThyScript
    const builtins = new Set([
      'print', 'calculate', 'input', 'save', 'free', 'change', 'to', 'add',
      'Math', 'Date', 'JSON', 'String', 'Number', 'Boolean', 'Array', 'Object',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'console', 'process', 'require',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'crypto', 'Buffer',
      'request', 'response', 'req', 'res', 'window', 'document', 'history', 'calc',
      'math', 'string', 'array', 'file', 'memory', 'server', 'security', 'html',
      'database', 'v3',
    ]);

    const traverse = (node) => {
      if (!node || typeof node !== 'object') return;

      // Variable declaration: const table name = ...
      if (node.type === 'VarDecl' || node.type === 'VariableDeclaration') {
        const name = node.name || (node.id && node.id.name);
        if (name) {
          if (declaredVars.has(name)) {
            this._addWarning('THY-202', [name], node.line || 1, 1, filename, source, `Variable '${name}' is already declared.`);
          }
          declaredVars.add(name);
        }
      }

      // Function declaration
      if (node.type === 'FunctionDecl' || node.type === 'FunctionDeclaration') {
        if (node.name) declaredFuncs.add(node.name);
        if (Array.isArray(node.params)) {
          for (const p of node.params) {
            const pname = typeof p === 'string' ? p : p.name;
            if (pname) declaredVars.add(pname);
          }
        }
      }

      // Class declaration
      if (node.type === 'ClassDecl' || node.type === 'ClassDeclaration') {
        if (node.name) declaredVars.add(node.name);
        const stmts = Array.isArray(node.body) ? node.body : (node.body && node.body.body ? node.body.body : []);
        for (const s of stmts) {
          if (s.name) declaredVars.add(s.name);
        }
      }

      // Variable reference
      if (node.type === 'Identifier') {
        usedVars.add(node.name);
        if (!declaredVars.has(node.name) &&
            !declaredFuncs.has(node.name) &&
            !builtins.has(node.name) &&
            !node.isDeclaration &&
            !node.isProperty) {
          // Check for similar declared name
          const suggestion = this._findClosestMatch(node.name, [...declaredVars, ...builtins]);
          if (suggestion) {
            this._addWarning('THY-201', [node.name], node.line || 1, node.col || 1, filename, source,
              `Did you mean '${suggestion}'?`);
          }
        }
      }

      // Check division by zero: calculate(x / 0)
      if (node.type === 'BinaryExpr' && node.operator === '/') {
        if (node.right && node.right.type === 'Literal' && node.right.value === 0) {
          this._addError('THY-801', ['0'], node.line || 1, node.col || 1, filename, source,
            'Division by zero is undefined. Check denominator.');
        }
      }

      // Traverse children
      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          val.forEach(traverse);
        } else if (val && typeof val === 'object') {
          traverse(val);
        }
      }
    };

    traverse(ast);

    // Unused variables check
    if (this.options.warnUnused) {
      for (const v of declaredVars) {
        if (!usedVars.has(v) && !builtins.has(v)) {
          this.warnings.push({
            code: 'THY-204',
            message: `Variable '${v}' is declared but never read.`,
            suggestion: `Consider removing '${v}' or prefixing with '_' if intentionally unused.`,
            filename,
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Helper to format an error object
   */
  _addError(code, args, line, col, filename, source, suggestion) {
    const template = ErrorMessages.get(code, ...args);
    this.errors.push({
      code,
      type: 'SyntaxError',
      message: template ? template.message : (args[0] || 'Unknown error'),
      suggestion: suggestion || (template ? template.suggestion : ''),
      line,
      column: col,
      filename,
      severity: 'error',
    });
  }

  /**
   * Helper to format a warning object
   */
  _addWarning(code, args, line, col, filename, source, suggestion) {
    const template = ErrorMessages.get(code, ...args);
    this.warnings.push({
      code,
      type: 'Warning',
      message: template ? template.message : (args[0] || 'Warning'),
      suggestion: suggestion || (template ? template.suggestion : ''),
      line,
      column: col,
      filename,
      severity: 'warning',
    });
  }

  /**
   * Simple Levenshtein distance for typo suggestions
   */
  _findClosestMatch(word, candidates) {
    let minDistance = 3;
    let closest = null;
    for (const c of candidates) {
      const d = this._levenshtein(word.toLowerCase(), c.toLowerCase());
      if (d < minDistance) {
        minDistance = d;
        closest = c;
      }
    }
    return closest;
  }

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  /**
   * Formats error for console display with code pointer
   */
  formatError(err, source = '') {
    const lines = source ? source.split('\n') : [];
    let output = `[${err.code || 'THY-ERR'}] ${err.type || 'Error'}: ${err.message}\n`;
    output += `  at ${err.filename || '<anonymous>'}:${err.line || 1}:${err.column || 1}\n`;
    if (err.line && lines[err.line - 1]) {
      const codeLine = lines[err.line - 1];
      const pointer = ' '.repeat(Math.max(0, (err.column || 1) - 1)) + '^';
      output += `\n  ${String(err.line).padStart(4)} | ${codeLine}\n`;
      output += `       | ${pointer}\n`;
    }
    if (err.suggestion) {
      output += `  💡 Fix: ${err.suggestion}\n`;
    }
    return output;
  }

  formatWarning(warn) {
    return `[${warn.code || 'THY-WARN'}] Warning: ${warn.message} (${warn.filename || ''}:${warn.line || 1})\n  💡 ${warn.suggestion || ''}`;
  }
}

module.exports = ErrorDetector;

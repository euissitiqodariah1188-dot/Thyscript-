'use strict';
/**
 * ThyScript Lexer
 * Tokenizes ThyScript source code into a stream of tokens
 * Supports all ThyScript syntax including HTML blocks, math ops, and keywords
 */

const TokenType = require('./TokenTypes');

class Lexer {
  constructor(source, filename = '<anonymous>') {
    this.source = source;
    this.filename = filename;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];
  }

  error(msg) {
    const err = { message: msg, line: this.line, col: this.col, filename: this.filename };
    this.errors.push(err);
    throw new Error(`[ThyScript Lexer] ${this.filename}:${this.line}:${this.col} - ${msg}`);
  }

  peek(offset = 0) { return this.source[this.pos + offset]; }
  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }
  isEOF() { return this.pos >= this.source.length; }

  skipWhitespaceAndComments() {
    while (!this.isEOF()) {
      const ch = this.peek();
      // Skip whitespace (not newlines - they may be significant)
      if (ch === ' ' || ch === '\r' || ch === '\t') { this.advance(); continue; }
      // Single line comment //
      if (ch === '/' && this.peek(1) === '/') {
        while (!this.isEOF() && this.peek() !== '\n') this.advance();
        continue;
      }
      // Block comment /* */
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (!this.isEOF()) {
          if (this.peek() === '*' && this.peek(1) === '/') { this.advance(); this.advance(); break; }
          this.advance();
        }
        continue;
      }
      break;
    }
  }

  readString(quote) {
    this.advance(); // consume opening quote
    let str = '';
    while (!this.isEOF() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '\\': str += '\\'; break;
          case '"': str += '"'; break;
          case "'": str += "'"; break;
          case '`': str += '`'; break;
          default: str += '\\' + esc;
        }
      } else {
        str += this.advance();
      }
    }
    if (this.isEOF()) this.error('Unterminated string literal');
    this.advance(); // consume closing quote
    return str;
  }

  readTemplateLiteral() {
    this.advance(); // consume `
    let parts = [];
    let current = '';
    while (!this.isEOF() && this.peek() !== '`') {
      if (this.peek() === '$' && this.peek(1) === '{') {
        if (current) parts.push({ type: 'str', value: current });
        current = '';
        this.advance(); this.advance(); // consume ${
        let depth = 1;
        let expr = '';
        while (!this.isEOF() && depth > 0) {
          if (this.peek() === '{') depth++;
          if (this.peek() === '}') { depth--; if (depth === 0) break; }
          expr += this.advance();
        }
        this.advance(); // consume }
        parts.push({ type: 'expr', value: expr });
      } else {
        current += this.advance();
      }
    }
    if (this.isEOF()) this.error('Unterminated template literal');
    this.advance(); // consume `
    if (current) parts.push({ type: 'str', value: current });
    return parts;
  }

  readNumber() {
    let num = '';
    let isFloat = false;
    let isBinary = false;
    let isHex = false;
    let isOctal = false;

    if (this.peek() === '0') {
      if (this.peek(1) === 'x' || this.peek(1) === 'X') {
        num += this.advance() + this.advance();
        isHex = true;
        while (!this.isEOF() && /[0-9a-fA-F_]/.test(this.peek())) num += this.advance();
      } else if (this.peek(1) === 'b' || this.peek(1) === 'B') {
        num += this.advance() + this.advance();
        isBinary = true;
        while (!this.isEOF() && /[01_]/.test(this.peek())) num += this.advance();
      } else if (this.peek(1) === 'o' || this.peek(1) === 'O') {
        num += this.advance() + this.advance();
        isOctal = true;
        while (!this.isEOF() && /[0-7_]/.test(this.peek())) num += this.advance();
      } else {
        num += this.advance();
      }
    }

    if (!isHex && !isBinary && !isOctal) {
      while (!this.isEOF() && /[0-9_]/.test(this.peek())) num += this.advance();
      if (!this.isEOF() && this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
        isFloat = true;
        num += this.advance();
        while (!this.isEOF() && /[0-9_]/.test(this.peek())) num += this.advance();
      }
      if (!this.isEOF() && (this.peek() === 'e' || this.peek() === 'E')) {
        isFloat = true;
        num += this.advance();
        if (!this.isEOF() && (this.peek() === '+' || this.peek() === '-')) num += this.advance();
        while (!this.isEOF() && /[0-9]/.test(this.peek())) num += this.advance();
      }
    }

    const cleanNum = num.replace(/_/g, '');
    return { raw: num, value: isFloat ? parseFloat(cleanNum) : parseInt(cleanNum), isFloat };
  }

  readIdentifierOrKeyword() {
    let id = '';
    while (!this.isEOF() && /[a-zA-Z0-9_$]/.test(this.peek())) id += this.advance();
    const kw = TokenType.KEYWORDS[id];
    return kw ? { type: kw, value: id } : { type: TokenType.IDENTIFIER, value: id };
  }

  readHtmlBlock() {
    // Reads everything after classHtml(name): until end()
    let html = '';
    // Skip until next line
    while (!this.isEOF() && this.peek() !== '\n') this.advance();
    if (!this.isEOF() && this.peek() === '\n') {
      this.advance(); // consume newline
    }

    while (!this.isEOF()) {
      // Check if current position/line starts with end() (ignoring indentation)
      let p = this.pos;
      while (p < this.source.length && (this.source[p] === ' ' || this.source[p] === '\t')) {
        p++;
      }
      if (this.source.slice(p, p + 5) === 'end()') {
        // Stop before indentation so end() is tokenized naturally
        break;
      }
      html += this.advance();
    }
    return html.trim();
  }

  tokenize() {
    while (!this.isEOF()) {
      this.skipWhitespaceAndComments();
      if (this.isEOF()) break;

      const startLine = this.line;
      const startCol = this.col;
      const ch = this.peek();

      // Newlines
      if (ch === '\n') {
        this.advance();
        this.tokens.push({ type: TokenType.NEWLINE, value: '\n', line: startLine, col: startCol });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.peek(1)))) {
        const num = this.readNumber();
        this.tokens.push({ type: num.isFloat ? TokenType.FLOAT : TokenType.NUMBER, value: num.value, raw: num.raw, line: startLine, col: startCol });
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        const str = this.readString(ch);
        this.tokens.push({ type: TokenType.STRING, value: str, line: startLine, col: startCol });
        continue;
      }

      // Template literals
      if (ch === '`') {
        const parts = this.readTemplateLiteral();
        this.tokens.push({ type: TokenType.TEMPLATE_LITERAL, value: parts, line: startLine, col: startCol });
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(ch)) {
        const tok = this.readIdentifierOrKeyword();
        this.tokens.push({ ...tok, line: startLine, col: startCol });

        if (tok.type === TokenType.KW_CLASS_HTML) {
          this.skipWhitespaceAndComments();
          if (this.peek() === '(') {
            this.advance(); // consume (
            this.tokens.push({ type: TokenType.LPAREN, value: '(', line: this.line, col: this.col });
            this.skipWhitespaceAndComments();
            let name = '';
            while (!this.isEOF() && this.peek() !== ')') {
              name += this.advance();
            }
            name = name.trim();
            this.tokens.push({ type: TokenType.IDENTIFIER, value: name, line: this.line, col: this.col });
            if (this.peek() === ')') {
              this.advance(); // consume )
              this.tokens.push({ type: TokenType.RPAREN, value: ')', line: this.line, col: this.col });
            }
            this.skipWhitespaceAndComments();
            if (this.peek() === ':') {
              this.advance(); // consume :
              this.tokens.push({ type: TokenType.COLON, value: ':', line: this.line, col: this.col });
              const html = this.readHtmlBlock();
              this.tokens.push({ type: TokenType.STRING, value: html, line: this.line, col: this.col });
            }
          }
        }
        continue;
      }

      // Operators and punctuation
      const op = this.readOperator();
      if (op) {
        this.tokens.push({ ...op, line: startLine, col: startCol });
        continue;
      }

      this.error(`Unknown character '${ch}' (code ${ch.charCodeAt(0)})`);
    }

    this.tokens.push({ type: TokenType.EOF, value: null, line: this.line, col: this.col });
    return this.tokens;
  }

  readOperator() {
    const ch = this.advance();
    const next = this.peek();

    switch (ch) {
      case '+': if (next === '+') { this.advance(); return { type: TokenType.PLUS_PLUS, value: '++' }; }
                if (next === '=') { this.advance(); return { type: TokenType.PLUS_ASSIGN, value: '+=' }; }
                return { type: TokenType.PLUS, value: '+' };
      case '-': if (next === '-') { this.advance(); return { type: TokenType.MINUS_MINUS, value: '--' }; }
                if (next === '=') { this.advance(); return { type: TokenType.MINUS_ASSIGN, value: '-=' }; }
                if (next === '>') { this.advance(); return { type: TokenType.ARROW, value: '->' }; }
                return { type: TokenType.MINUS, value: '-' };
      case '*': if (next === '*') { this.advance(); return { type: TokenType.POWER, value: '**' }; }
                if (next === '=') { this.advance(); return { type: TokenType.MUL_ASSIGN, value: '*=' }; }
                return { type: TokenType.STAR, value: '*' };
      case '/': if (next === '=') { this.advance(); return { type: TokenType.DIV_ASSIGN, value: '/=' }; }
                return { type: TokenType.SLASH, value: '/' };
      case '%': if (next === '=') { this.advance(); return { type: TokenType.MOD_ASSIGN, value: '%=' }; }
                return { type: TokenType.PERCENT, value: '%' };
      case '^': return { type: TokenType.CARET, value: '^' };
      case '&': if (next === '&') { this.advance(); return { type: TokenType.AND_AND, value: '&&' }; }
                return { type: TokenType.AMPERSAND, value: '&' };
      case '|': if (next === '|') { this.advance(); return { type: TokenType.OR_OR, value: '||' }; }
                return { type: TokenType.PIPE, value: '|' };
      case '!': if (next === '=') {
                  this.advance();
                  if (this.peek() === '=') { this.advance(); return { type: TokenType.NOT_EQ_STRICT, value: '!==' }; }
                  return { type: TokenType.NOT_EQ, value: '!=' };
                }
                return { type: TokenType.NOT, value: '!' };
      case '=': if (next === '=') {
                  this.advance();
                  if (this.peek() === '=') { this.advance(); return { type: TokenType.EQ_STRICT, value: '===' }; }
                  return { type: TokenType.EQ_EQ, value: '==' };
                }
                if (next === '>') { this.advance(); return { type: TokenType.FAT_ARROW, value: '=>' }; }
                return { type: TokenType.ASSIGN, value: '=' };
      case '<': if (next === '=') { this.advance(); return { type: TokenType.LT_EQ, value: '<=' }; }
                if (next === '<') { this.advance(); return { type: TokenType.SHIFT_LEFT, value: '<<' }; }
                return { type: TokenType.LT, value: '<' };
      case '>': if (next === '=') { this.advance(); return { type: TokenType.GT_EQ, value: '>=' }; }
                if (next === '>') { this.advance(); return { type: TokenType.SHIFT_RIGHT, value: '>>' }; }
                return { type: TokenType.GT, value: '>' };
      case '(': return { type: TokenType.LPAREN, value: '(' };
      case ')': return { type: TokenType.RPAREN, value: ')' };
      case '{': return { type: TokenType.LBRACE, value: '{' };
      case '}': return { type: TokenType.RBRACE, value: '}' };
      case '[': return { type: TokenType.LBRACKET, value: '[' };
      case ']': return { type: TokenType.RBRACKET, value: ']' };
      case '.': if (next === '.' && this.peek(1) === '.') { this.advance(); this.advance(); return { type: TokenType.SPREAD, value: '...' }; }
                return { type: TokenType.DOT, value: '.' };
      case ',': return { type: TokenType.COMMA, value: ',' };
      case ':': return { type: TokenType.COLON, value: ':' };
      case ';': return { type: TokenType.SEMICOLON, value: ';' };
      case '#': {
        let comment = '';
        while (!this.isEOF() && this.peek() !== '\n') comment += this.advance();
        return { type: TokenType.COMMENT, value: comment };
      }
      case '@': return { type: TokenType.AT, value: '@' };
      case '$': return { type: TokenType.DOLLAR, value: '$' };
      case '?': if (next === '?') { this.advance(); return { type: TokenType.NULL_COALESCE, value: '??' }; }
                if (next === '.') { this.advance(); return { type: TokenType.OPTIONAL_CHAIN, value: '?.' }; }
                return { type: TokenType.QUESTION, value: '?' };
      case '\\': return { type: TokenType.BACKSLASH, value: '\\' };
      case '~': return { type: TokenType.TILDE, value: '~' };
      default: return null;
    }
  }
}

module.exports = Lexer;

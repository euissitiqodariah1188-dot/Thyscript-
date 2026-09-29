'use strict';
/**
 * ThyScript Recursive-Descent Parser
 *
 * Takes source text → runs the Lexer → walks the token stream → produces an AST.
 *
 * Operator precedence (lowest → highest):
 *   1. Assignment          =  +=  -=  *=  /=  %=
 *   2. Ternary             ? :
 *   3. Null-coalesce       ??
 *   4. Logical OR          ||  or
 *   5. Logical AND         &&  and
 *   6. Bitwise OR          |
 *   7. Bitwise XOR         ^
 *   8. Bitwise AND         &
 *   9. Equality            ==  !=  ===  !==
 *  10. Relational          <  <=  >  >=  instanceof
 *  11. Bitwise shift       <<  >>
 *  12. Additive            +  -
 *  13. Multiplicative      *  /  %
 *  14. Exponentiation      ** (right-associative)
 *  15. Unary prefix        -  !  ~  typeof  not  new  await  yield
 *  16. Postfix             ++  --
 *  17. Call / member       ()  .  ?.  []
 *  18. Primary             literals, identifiers, grouped, array, object, …
 */

const Lexer    = require('../lexer/Lexer');
const TokenType = require('../lexer/TokenTypes');
const AST      = require('./AST');

// ─────────────────────────────────────────────────────────────────────────────
// ParseError – a recoverable error
// ─────────────────────────────────────────────────────────────────────────────
class ParseError extends Error {
  constructor(message, token, filename) {
    super(message);
    this.token    = token;
    this.filename = filename;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────
class Parser {
  /**
   * @param {string|Array} sourceOrTokens – raw ThyScript source or token array
   * @param {string} [filenameOrSource]   – filename or raw source
   * @param {string} [maybeFilename]      – filename if tokens passed first
   */
  constructor(sourceOrTokens, filenameOrSource = '<anonymous>', maybeFilename = '<anonymous>') {
    if (Array.isArray(sourceOrTokens)) {
      this.tokens   = sourceOrTokens;
      this.source   = typeof filenameOrSource === 'string' ? filenameOrSource : '';
      this.filename = maybeFilename || '<anonymous>';
    } else {
      this.source   = sourceOrTokens || '';
      this.filename = filenameOrSource || '<anonymous>';
      this.tokens   = [];
    }
    this.pos      = 0;
    this.errors   = [];
  }

  // ── Tokenise ──────────────────────────────────────────────────────────────
  _lex() {
    if (this.tokens && this.tokens.length > 0) return;
    const lexer = new Lexer(this.source, this.filename);
    try {
      this.tokens = lexer.tokenize();
    } catch (e) {
      // Lexer already pushed to lexer.errors; capture and continue with
      // whatever tokens were produced before the failure.
      this.errors.push({ message: e.message, line: 0, col: 0 });
      this.tokens = lexer.tokens;
      // Ensure there is always an EOF sentinel
      if (!this.tokens.length || this.tokens[this.tokens.length - 1].type !== TokenType.EOF) {
        this.tokens.push({ type: TokenType.EOF, value: null, line: 0, col: 0 });
      }
    }
    // Carry any lexer-level errors
    if (lexer.errors && lexer.errors.length) {
      this.errors.push(...lexer.errors);
    }
  }

  // ── Token navigation ──────────────────────────────────────────────────────
  peek(offset = 0) {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return this.tokens[this.tokens.length - 1]; // EOF
    return this.tokens[idx];
  }

  current() { return this.peek(0); }

  advance() {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return tok;
  }

  /** Skip NEWLINE tokens */
  skipNewlines() {
    while (this.current().type === TokenType.NEWLINE) this.advance();
  }

  check(type) { return this.current().type === type; }
  checkAny(...types) { return types.includes(this.current().type); }

  match(...types) {
    if (types.includes(this.current().type)) { this.advance(); return true; }
    return false;
  }

  /**
   * Consume the current token if it matches `type`, otherwise record an error.
   * Returns the consumed token (or the current one on failure).
   */
  expect(type, message) {
    this.skipNewlines();
    if (this.current().type === type) return this.advance();
    const tok = this.current();
    this._error(message || `Expected '${type}' but got '${tok.type}' (${JSON.stringify(tok.value)})`, tok);
    return tok; // error-recovery: pretend we consumed it
  }

  // ── Error handling / recovery ─────────────────────────────────────────────
  _error(message, tok) {
    tok = tok || this.current();
    const err = {
      message,
      line:     tok.line,
      col:      tok.col,
      filename: this.filename,
    };
    this.errors.push(err);
    throw new ParseError(`[ThyScript Parser] ${this.filename}:${tok.line}:${tok.col} - ${message}`, tok, this.filename);
  }

  /**
   * After catching a ParseError, skip tokens until we reach a safe
   * statement-boundary token so parsing can continue.
   */
  _synchronize() {
    this.advance();
    // Statement-starting keywords that mark a new statement
    const stmtStarters = new Set([
      TokenType.KW_PRINT,    TokenType.KW_CONST,   TokenType.KW_TABLE,
      TokenType.KW_PUBLIC,   TokenType.KW_PRIVATE,  TokenType.KW_PROTECTED,
      TokenType.KW_CLASS,    TokenType.KW_CLASS_HTML,
      TokenType.KW_IF,       TokenType.KW_WHILE,   TokenType.KW_FOR,
      TokenType.KW_RETURN,   TokenType.KW_FUNC,    TokenType.KW_ASYNC,
      TokenType.KW_TRY,      TokenType.KW_IMPORT,  TokenType.KW_EXPORT,
      TokenType.KW_SERVER,   TokenType.KW_ROUTE,   TokenType.KW_SOCKET,
      TokenType.KW_DATABASE, TokenType.KW_COMPONENT,
      TokenType.KW_NEURAL,   TokenType.KW_PHYSICS, TokenType.KW_ANIMATE,
      TokenType.KW_PARALLEL, TokenType.KW_WORKER,  TokenType.KW_STREAM,
      TokenType.KW_PIPELINE, TokenType.KW_MATCH,
      TokenType.KW_ADD,      TokenType.KW_CHANGE,  TokenType.KW_CALCULATE,
      TokenType.KW_SAVE,     TokenType.KW_FREE,    TokenType.KW_BREAK,
      TokenType.KW_CONTINUE, TokenType.KW_THROW,
      TokenType.KW_END,      TokenType.EOF,
    ]);

    while (!this.check(TokenType.EOF)) {
      if (this.check(TokenType.NEWLINE)) { this.advance(); break; }
      if (stmtStarters.has(this.current().type)) break;
      this.advance();
    }
  }

  // ── Entry point ───────────────────────────────────────────────────────────
  /**
   * Parse the source text and return the root Program AST node.
   * @returns {{ ast: Program, errors: Array }}
   */
  parse() {
    this._lex();
    const line  = this.current().line;
    const col   = this.current().col;
    const body  = this._parseStatementList(/*stopAtEnd*/ false);
    this.expect(TokenType.EOF);
    const ast = AST.Program(body, line, col);
    return { ast, errors: this.errors };
  }

  // ── Statement list ────────────────────────────────────────────────────────
  /**
   * Parses a list of statements.
   * @param {boolean} stopAtEnd – when true, stop at `end()` / `else` / `elif` / `catch` / `finally` / `when` / `otherwise` / EOF
   */
  _parseStatementList(stopAtEnd = true) {
    const stmts = [];
    while (true) {
      this.skipNewlines();
      const cur = this.current();

      if (cur.type === TokenType.EOF) break;

      if (stopAtEnd) {
        if (cur.type === TokenType.KW_END)        break;
        if (cur.type === TokenType.KW_ELSE)       break;
        if (cur.type === TokenType.KW_ELIF)       break;
        if (cur.type === TokenType.KW_CATCH)      break;
        if (cur.type === TokenType.KW_FINALLY)    break;
        if (cur.type === TokenType.KW_WHEN)       break;
        if (cur.type === TokenType.KW_OTHERWISE)  break;
      }

      try {
        const stmt = this._parseStatement();
        if (stmt) stmts.push(stmt);
      } catch (e) {
        if (e instanceof ParseError) {
          this._synchronize();
        } else {
          throw e;
        }
      }
    }
    return stmts;
  }

  /** Parse and return a Block node (list wrapped in a Block) */
  _parseBlock() {
    const tok   = this.current();
    const stmts = this._parseStatementList(true);
    return AST.Block(stmts, tok.line, tok.col);
  }

  /** Expect a colon then parse a block up to end() */
  _expectColonBlock() {
    this.skipNewlines();
    this.expect(TokenType.COLON, "Expected ':' to open block");
    this.skipNewlines();
    return this._parseBlock();
  }

  // ── Statement dispatch ────────────────────────────────────────────────────
  _parseStatement() {
    this.skipNewlines();
    const tok = this.current();

    switch (tok.type) {
      // ── declarations ──────────────────────────────────────────────────────
      case TokenType.KW_CONST:         return this._parseConstTable();
      case TokenType.KW_TABLE:         return this._parseConstTable(false);
      case TokenType.KW_LET:
      case TokenType.KW_VAR:           return this._parseLetVar();
      case TokenType.KW_EXPORT:        return this._parseExport();
      case TokenType.KW_IMPORT:        return this._parseImport();

      // ── function / class ──────────────────────────────────────────────────
      case TokenType.KW_FUNC:          return this._parseFuncDecl(false, false);
      case TokenType.KW_ASYNC:         return this._parseAsync();
      case TokenType.KW_PUBLIC:
      case TokenType.KW_PRIVATE:
      case TokenType.KW_PROTECTED:     return this._parseClassDecl();
      case TokenType.KW_CLASS:         return this._parseClassDecl();
      case TokenType.KW_CLASS_HTML:    return this._parseHtmlClassDecl();

      // ── control flow ──────────────────────────────────────────────────────
      case TokenType.KW_IF:            return this._parseIf();
      case TokenType.KW_WHILE:         return this._parseWhile();
      case TokenType.KW_FOR:           return this._parseFor();
      case TokenType.KW_RETURN:        return this._parseReturn();
      case TokenType.KW_BREAK:         this.advance(); return AST.BreakStmt(tok.line, tok.col);
      case TokenType.KW_CONTINUE:      this.advance(); return AST.ContinueStmt(tok.line, tok.col);
      case TokenType.KW_THROW:         return this._parseThrow();

      // ── ThyScript specials ────────────────────────────────────────────────
      case TokenType.KW_PRINT:         return this._parsePrint();
      case TokenType.KW_ADD:           return this._parseAdd();
      case TokenType.KW_CHANGE:        return this._parseChange();
      case TokenType.KW_CALCULATE:     return this._parseCalculateStmt();
      case TokenType.KW_INPUT:         return this._parseInputStmt();
      case TokenType.KW_SAVE:          return this._parseSave();
      case TokenType.KW_FREE:          return this._parseFree();

      // ── exception handling ────────────────────────────────────────────────
      case TokenType.KW_TRY:           return this._parseTryCatch();

      // ── server / networking ───────────────────────────────────────────────
      case TokenType.KW_SERVER:        return this._parseServer();
      case TokenType.KW_ROUTE:         return this._parseRoute();
      case TokenType.KW_SOCKET:        return this._parseSocket();

      // ── database ──────────────────────────────────────────────────────────
      case TokenType.KW_DATABASE:      return this._parseDatabase();

      // ── UI / components ───────────────────────────────────────────────────
      case TokenType.KW_COMPONENT:     return this._parseComponent();

      // ── ML ────────────────────────────────────────────────────────────────
      case TokenType.KW_NEURAL:        return this._parseNeural();

      // ── physics ───────────────────────────────────────────────────────────
      case TokenType.KW_PHYSICS:       return this._parsePhysics();

      // ── animation ─────────────────────────────────────────────────────────
      case TokenType.KW_ANIMATE:       return this._parseAnimate();

      // ── concurrency ───────────────────────────────────────────────────────
      case TokenType.KW_PARALLEL:      return this._parseParallel();
      case TokenType.KW_WORKER:        return this._parseWorker();
      case TokenType.KW_STREAM:        return this._parseStream();
      case TokenType.KW_PIPELINE:      return this._parsePipeline();

      // ── pattern matching ──────────────────────────────────────────────────
      case TokenType.KW_MATCH:         return this._parseMatch();

      // ── expression statement ──────────────────────────────────────────────
      default:
        return this._parseExpressionStatement();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Specific statement parsers
  // ═══════════════════════════════════════════════════════════════════════════

  // ── const table / table ───────────────────────────────────────────────────
  /**
   * `const table name = expr`
   * `const table [a,b] = arr`  (destructure)
   * `const table {x,y} = obj`  (destructure)
   */
  _parseConstTable(isConst = true) {
    const tok = this.current();
    this.advance(); // consume `const`

    // If `const` was parsed but not `table`, allow `const table` as pair
    if (isConst && this.check(TokenType.KW_TABLE)) {
      this.advance(); // consume `table`
    }
    // else: just `table name = …` (mutable)

    this.skipNewlines();
    return this._parseVarDeclarator(isConst, tok);
  }

  _parseLetVar() {
    const tok = this.current();
    this.advance(); // consume let / var
    return this._parseVarDeclarator(false, tok);
  }

  _parseVarDeclarator(isConst, tok) {
    this.skipNewlines();
    const cur = this.current();

    // Destructure: const table [a, b] = arr
    if (cur.type === TokenType.LBRACKET) {
      return this._parseDestructureDecl('array', isConst, tok);
    }
    // Destructure: const table { x, y } = obj
    if (cur.type === TokenType.LBRACE) {
      return this._parseDestructureDecl('object', isConst, tok);
    }

    // Simple:  name = expr
    const name = this._expectIdentifierName('Expected variable name');
    this.skipNewlines();

    let init = null;
    if (this.match(TokenType.ASSIGN)) {
      this.skipNewlines();
      init = this._parseExpression();
    }

    return AST.VarDecl(name, init, isConst, tok.line, tok.col);
  }

  _parseDestructureDecl(kind, isConst, tok) {
    const targets = [];
    if (kind === 'array') {
      this.advance(); // consume [
      while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
        this.skipNewlines();
        if (this.check(TokenType.SPREAD)) {
          this.advance();
          targets.push({ rest: true, name: this._expectIdentifierName('Expected rest element name') });
        } else {
          targets.push({ name: this._expectIdentifierName('Expected element name') });
        }
        this.skipNewlines();
        if (!this.match(TokenType.COMMA)) break;
      }
      this.skipNewlines();
      this.expect(TokenType.RBRACKET, "Expected ']' to close destructure");
    } else {
      this.advance(); // consume {
      while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
        this.skipNewlines();
        const key   = this._expectIdentifierName('Expected property key');
        let   alias = key;
        if (this.match(TokenType.COLON)) {
          alias = this._expectIdentifierName('Expected alias name');
        }
        let defaultVal = null;
        if (this.match(TokenType.ASSIGN)) {
          defaultVal = this._parseExpression();
        }
        targets.push({ key, alias, default: defaultVal });
        this.skipNewlines();
        if (!this.match(TokenType.COMMA)) break;
      }
      this.skipNewlines();
      this.expect(TokenType.RBRACE, "Expected '}' to close destructure");
    }

    this.skipNewlines();
    this.expect(TokenType.ASSIGN, "Expected '=' in destructuring declaration");
    this.skipNewlines();
    const init = this._parseExpression();
    return AST.DestructureDecl(kind, targets, init, isConst, tok.line, tok.col);
  }

  // ── func ──────────────────────────────────────────────────────────────────
  /**
   * `[async] func name(params): body end()`
   */
  _parseFuncDecl(isAsync, isExported) {
    const tok = this.current();
    this.advance(); // consume `func`
    this.skipNewlines();
    const name = this._expectIdentifierName('Expected function name');
    this.skipNewlines();
    const params = this._parseParamList();
    const body   = this._expectColonBlock();
    this._expectEnd();
    return AST.FunctionDecl(name, params, body, isAsync, isExported, tok.line, tok.col);
  }

  _parseAsync() {
    const tok = this.current();
    this.advance(); // consume `async`
    this.skipNewlines();
    if (this.check(TokenType.KW_FUNC)) {
      return this._parseFuncDecl(true, false);
    }
    this._error('Expected `func` after `async`', tok);
  }

  /**
   * Parse  (param1, param2, ...rest)
   * @returns {string[]}
   */
  _parseParamList() {
    const params = [];
    this.expect(TokenType.LPAREN, "Expected '(' for parameter list");
    this.skipNewlines();
    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.SPREAD)) {
        this.advance();
        params.push('...' + this._expectIdentifierName('Expected rest param name'));
      } else {
        const name = this._expectIdentifierName('Expected parameter name');
        let   defaultVal = null;
        if (this.match(TokenType.ASSIGN)) {
          defaultVal = this._parseExpression();
        }
        params.push(defaultVal !== null ? { name, default: defaultVal } : name);
      }
      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(TokenType.RPAREN, "Expected ')' after parameters");
    return params;
  }

  // ── class ─────────────────────────────────────────────────────────────────
  /**
   * `[public|private|protected] class(Name) [extends Super]: body end()`
   */
  _parseClassDecl() {
    const tok    = this.current();
    let   access = 'public';

    // optional access modifier
    if (checkAny(tok, TokenType.KW_PUBLIC, TokenType.KW_PRIVATE, TokenType.KW_PROTECTED)) {
      access = tok.value;
      this.advance();
      this.skipNewlines();
    }

    this.expect(TokenType.KW_CLASS, "Expected 'class'");
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'class'");
    const name = this._expectIdentifierName('Expected class name');
    this.expect(TokenType.RPAREN, "Expected ')' after class name");
    this.skipNewlines();

    let superClass = null;
    if (this.match(TokenType.KW_EXTENDS)) {
      this.skipNewlines();
      superClass = this._expectIdentifierName('Expected super-class name');
      this.skipNewlines();
    }

    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.ClassDecl(name, superClass, body, access, tok.line, tok.col);
  }

  // ── classHtml ─────────────────────────────────────────────────────────────
  /**
   * `classHtml(Name): rawHtml end()`
   * The Lexer has already consumed the raw HTML content into a STRING token.
   */
  _parseHtmlClassDecl() {
    const tok = this.current();
    this.advance(); // consume `classHtml`
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'classHtml'");
    const name = this._expectIdentifierName('Expected HTML class name');
    this.expect(TokenType.RPAREN, "Expected ')'");
    this.skipNewlines();

    // Support external HTML file: classHtml(Name) from "index.html"
    if (this.match(TokenType.KW_FROM)) {
      this.skipNewlines();
      const filePath = this._expectString('Expected HTML file path string');
      this.skipNewlines();
      if (this.match(TokenType.COLON)) {
        this.skipNewlines();
        this._expectEnd();
      }
      const node = AST.HtmlClassDecl(name, '', tok.line, tok.col);
      node.file = filePath;
      return node;
    }

    this.expect(TokenType.COLON, "Expected ':' after classHtml declaration");

    // If the lexer provided a single raw HTML STRING token:
    this.skipNewlines();
    if (this.check(TokenType.STRING)) {
      const html = this.current().value;
      this.advance();
      this.skipNewlines();
      this._expectEnd();
      const node = AST.HtmlClassDecl(name, html, tok.line, tok.col);
      if (/\.(html|htm|tpl)$/i.test(html.trim()) && !html.includes('<')) {
        node.file = html.trim();
      }
      return node;
    }

    // Collect raw HTML lines until `end()`
    const htmlLines = [];
    while (!this.check(TokenType.EOF)) {
      this.skipNewlines();
      // Check for end()
      if (this.check(TokenType.KW_END)) {
        this._expectEnd();
        break;
      }
      // Accept STRING tokens (raw HTML captured by lexer) or identifiers
      const t = this.current();
      htmlLines.push(t.value !== null && t.value !== undefined ? String(t.value) : t.type);
      this.advance();
    }

    const htmlContent = htmlLines.join('\n');
    const node = AST.HtmlClassDecl(name, htmlContent, tok.line, tok.col);
    if (/\.(html|htm|tpl)$/i.test(htmlContent.trim()) && !htmlContent.includes('<')) {
      node.file = htmlContent.trim();
    }
    return node;
  }

  // ── if / elif / else ──────────────────────────────────────────────────────
  _parseIf() {
    const tok = this.current();
    this.advance(); // consume `if`
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'if'");
    const test = this._parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')' after if-condition");
    const consequent = this._expectColonBlock();

    const elseifs   = [];
    let   alternate = null;

    while (true) {
      this.skipNewlines();
      if (this.check(TokenType.KW_ELIF)) {
        this.advance();
        this.skipNewlines();
        this.expect(TokenType.LPAREN, "Expected '(' after 'elif'");
        const elifTest = this._parseExpression();
        this.expect(TokenType.RPAREN, "Expected ')'");
        const elifBody = this._expectColonBlock();
        elseifs.push({ test: elifTest, body: elifBody });
      } else if (this.check(TokenType.KW_ELSE)) {
        this.advance();
        alternate = this._expectColonBlock();
        break;
      } else {
        break;
      }
    }

    this._expectEnd();
    return AST.IfStmt(test, consequent, elseifs, alternate, tok.line, tok.col);
  }

  // ── while ─────────────────────────────────────────────────────────────────
  _parseWhile() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'while'");
    const test = this._parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')'");
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.WhileStmt(test, body, tok.line, tok.col);
  }

  // ── for x in y ────────────────────────────────────────────────────────────
  _parseFor() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    const variable = this._expectIdentifierName('Expected loop variable');
    this.skipNewlines();
    this.expect(TokenType.KW_IN, "Expected 'in'");
    this.skipNewlines();
    const iterable = this._parseExpression();
    const body     = this._expectColonBlock();
    this._expectEnd();
    return AST.ForStmt(variable, iterable, body, tok.line, tok.col);
  }

  // ── return ────────────────────────────────────────────────────────────────
  _parseReturn() {
    const tok = this.current();
    this.advance();
    let argument = null;
    // If the next non-whitespace thing is not a newline/EOF/end, parse the value
    const next = this.current();
    if (next.type !== TokenType.NEWLINE && next.type !== TokenType.EOF && next.type !== TokenType.KW_END) {
      argument = this._parseExpression();
    }
    return AST.ReturnStmt(argument, tok.line, tok.col);
  }

  // ── throw ─────────────────────────────────────────────────────────────────
  _parseThrow() {
    const tok = this.current();
    this.advance();
    const argument = this._parseExpression();
    return AST.ThrowStmt(argument, tok.line, tok.col);
  }

  // ── print ─────────────────────────────────────────────────────────────────
  _parsePrint() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'print'");
    const args = [];
    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      args.push(this._parseExpression());
      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(TokenType.RPAREN, "Expected ')' after print arguments");
    return AST.PrintStmt(args, tok.line, tok.col);
  }

  // ── add N in list ─────────────────────────────────────────────────────────
  _parseAdd() {
    const tok = this.current();
    this.advance(); // consume `add`
    this.skipNewlines();
    const value = this._parseExpression();
    this.skipNewlines();
    this.expect(TokenType.KW_IN, "Expected 'in' after value in 'add'");
    this.skipNewlines();
    let target = this._expectIdentifierName('Expected list name');
    while (this.check(TokenType.DOT)) {
      this.advance();
      target += '.' + this._expectIdentifierName('Expected property name');
    }
    return AST.AddStmt(value, target, tok.line, tok.col);
  }

  // ── change(x to(y)) ───────────────────────────────────────────────────────
  _parseChange() {
    const tok = this.current();
    this.advance(); // consume `change`
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'change'");
    this.skipNewlines();
    let target = this._expectIdentifierName('Expected variable name');
    while (this.check(TokenType.DOT)) {
      this.advance();
      target += '.' + this._expectIdentifierName('Expected property name');
    }
    this.skipNewlines();
    this.expect(TokenType.KW_TO, "Expected 'to'");
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '(' after 'to'");
    const value = this._parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')'");
    this.expect(TokenType.RPAREN, "Expected ')' to close 'change'");
    return AST.ChangeStmt(target, value, tok.line, tok.col);
  }

  // ── calculate(expr) ───────────────────────────────────────────────────────
  _parseCalculateStmt() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '('");
    const expr = this._parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')'");
    return AST.CalculateStmt(expr, tok.line, tok.col);
  }

  // ── input(prompt) used as statement ──────────────────────────────────────
  _parseInputStmt() {
    const tok = this.current();
    const expr = this._parseInputExpr();
    return AST.ExprStmt(expr, tok.line, tok.col);
  }

  _parseInputExpr() {
    const tok = this.current();
    this.advance(); // consume `input`
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '('");
    let prompt = null;
    if (!this.check(TokenType.RPAREN)) {
      prompt = this._parseExpression();
    }
    this.expect(TokenType.RPAREN, "Expected ')'");
    return AST.InputExpr(prompt, tok.line, tok.col);
  }

  // ── save(var) ─────────────────────────────────────────────────────────────
  _parseSave() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    this.expect(TokenType.LPAREN, "Expected '('");
    const name = this._expectIdentifierName('Expected variable name');
    this.expect(TokenType.RPAREN, "Expected ')'");
    return AST.SaveStmt(name, tok.line, tok.col);
  }

  // ── free() ────────────────────────────────────────────────────────────────
  _parseFree() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      this.skipNewlines();
      this.expect(TokenType.RPAREN, "Expected ')'");
    }
    return AST.ExprStmt(AST.FreeExpr(tok.line, tok.col), tok.line, tok.col);
  }

  // ── try/catch/finally ─────────────────────────────────────────────────────
  _parseTryCatch() {
    const tok = this.current();
    this.advance(); // consume `try`
    const body = this._expectColonBlock();

    this.skipNewlines();
    let errorVar  = null;
    let handler   = AST.Block([], tok.line, tok.col);
    let finalizer = null;

    if (this.check(TokenType.KW_CATCH)) {
      this.advance();
      this.skipNewlines();
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        errorVar = this._expectIdentifierName('Expected error variable name');
        this.expect(TokenType.RPAREN, "Expected ')'");
      }
      handler = this._expectColonBlock();
      this.skipNewlines();
    }

    if (this.check(TokenType.KW_FINALLY)) {
      this.advance();
      finalizer = this._expectColonBlock();
      this.skipNewlines();
    }

    this._expectEnd();
    return AST.TryCatch(body, errorVar, handler, finalizer, tok.line, tok.col);
  }

  // ── import name from 'module' or import "npm-package" ───────────────────────
  _parseImport() {
    const tok = this.current();
    this.advance(); // consume `import`
    this.skipNewlines();

    // 1. Direct npm package import: import "packageName" or import "packageName" as name
    if (this.check(TokenType.STRING)) {
      const srcToken = this.current();
      this.advance();
      const source = srcToken.value;
      let varName = source.split('/').pop().replace(/[^a-zA-Z0-9_]/g, '_');
      this.skipNewlines();
      if (this.match(TokenType.KW_AS)) {
        this.skipNewlines();
        varName = this._expectIdentifierName('Expected alias name after as');
      }
      return AST.ImportDecl([varName], source, true, tok.line, tok.col);
    }

    const specifiers = [];
    let   isDefault  = false;

    // import { a, b } from 'mod'
    if (this.check(TokenType.LBRACE)) {
      this.advance();
      while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
        this.skipNewlines();
        specifiers.push(this._expectIdentifierName('Expected import name'));
        this.skipNewlines();
        if (!this.match(TokenType.COMMA)) break;
      }
      this.skipNewlines();
      this.expect(TokenType.RBRACE, "Expected '}'");
    } else if (this.check(TokenType.STAR)) {
      // import * from 'mod'
      this.advance();
      specifiers.push('*');
    } else {
      // import name from 'mod'  (default import)
      isDefault = true;
      specifiers.push(this._expectIdentifierName('Expected import name'));
    }

    this.skipNewlines();
    this.expect(TokenType.KW_FROM, "Expected 'from'");
    this.skipNewlines();
    const source = this._expectString('Expected module path string');

    return AST.ImportDecl(specifiers, source, isDefault, tok.line, tok.col);
  }

  // ── export ────────────────────────────────────────────────────────────────
  _parseExport() {
    const tok = this.current();
    this.advance(); // consume `export`
    this.skipNewlines();
    let decl;
    if (this.check(TokenType.KW_FUNC)) {
      decl = this._parseFuncDecl(false, true);
    } else if (this.check(TokenType.KW_ASYNC)) {
      this.advance();
      this.skipNewlines();
      decl = this._parseFuncDecl(true, true);
    } else if (this.check(TokenType.KW_CONST)) {
      decl = this._parseConstTable(true);
    } else if (this.check(TokenType.KW_TABLE)) {
      decl = this._parseConstTable(false);
    } else {
      decl = this._parseStatement();
    }
    return AST.ExportDecl(decl, tok.line, tok.col);
  }

  // ── server ────────────────────────────────────────────────────────────────
  _parseServer() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let port = null;
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      if (!this.check(TokenType.RPAREN)) {
        port = this._parseExpression();
      }
      this.expect(TokenType.RPAREN, "Expected ')'");
      this.skipNewlines();
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.ServerDecl(body, port, tok.line, tok.col);
  }

  // ── route METHOD '/path' ──────────────────────────────────────────────────
  _parseRoute() {
    const tok = this.current();
    this.advance(); // consume `route`
    this.skipNewlines();

    let method = 'get';
    if (checkAny(this.current(),
        TokenType.KW_GET, TokenType.KW_POST, TokenType.KW_PUT,
        TokenType.KW_DELETE_HTTP, TokenType.KW_PATCH)) {
      method = this.current().value.toLowerCase();
      this.advance();
    }
    this.skipNewlines();
    const path = this._parseExpression();
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.RouteDecl(method, path, body, tok.line, tok.col);
  }

  // ── socket on 'event' ─────────────────────────────────────────────────────
  _parseSocket() {
    const tok = this.current();
    this.advance(); // consume `socket`
    this.skipNewlines();
    this.expect(TokenType.KW_ON, "Expected 'on' after 'socket'");
    this.skipNewlines();
    const event = this._parseExpression();
    const body  = this._expectColonBlock();
    this._expectEnd();
    return AST.SocketDecl(event, body, tok.line, tok.col);
  }

  // ── database connect ──────────────────────────────────────────────────────
  _parseDatabase() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let connectionExpr = null;
    if (this.match(TokenType.KW_CONNECT)) {
      this.skipNewlines();
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        connectionExpr = this._parseExpression();
        this.expect(TokenType.RPAREN, "Expected ')'");
        this.skipNewlines();
      }
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.DatabaseDecl(body, connectionExpr, tok.line, tok.col);
  }

  // ── component Name ────────────────────────────────────────────────────────
  _parseComponent() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    const name = this._expectIdentifierName('Expected component name');
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.ComponentDecl(name, body, tok.line, tok.col);
  }

  // ── neural ────────────────────────────────────────────────────────────────
  _parseNeural() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let config = null;
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      config = this._parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')'");
      this.skipNewlines();
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.NeuralDecl(body, config, tok.line, tok.col);
  }

  // ── physics ───────────────────────────────────────────────────────────────
  _parsePhysics() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let config = null;
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      config = this._parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')'");
      this.skipNewlines();
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.PhysicsDecl(body, config, tok.line, tok.col);
  }

  // ── animate ───────────────────────────────────────────────────────────────
  _parseAnimate() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let target = null;
    if (this.check(TokenType.LPAREN)) {
      this.advance();
      target = this._parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')'");
      this.skipNewlines();
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.AnimateDecl(body, target, tok.line, tok.col);
  }

  // ── parallel ──────────────────────────────────────────────────────────────
  _parseParallel() {
    const tok = this.current();
    this.advance();
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.ParallelDecl(body, tok.line, tok.col);
  }

  // ── worker ────────────────────────────────────────────────────────────────
  _parseWorker() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let name = null;
    if (this.check(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.WorkerDecl(name, body, tok.line, tok.col);
  }

  // ── stream ────────────────────────────────────────────────────────────────
  _parseStream() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let name = null;
    if (this.check(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.StreamDecl(name, body, tok.line, tok.col);
  }

  // ── pipeline ──────────────────────────────────────────────────────────────
  _parsePipeline() {
    const tok = this.current();
    this.advance();
    this.skipNewlines();
    let name = null;
    if (this.check(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    }
    const body = this._expectColonBlock();
    this._expectEnd();
    return AST.PipelineDecl(name, body, tok.line, tok.col);
  }

  // ── match x: when y:…end() ───────────────────────────────────────────────
  _parseMatch() {
    const tok = this.current();
    this.advance(); // consume `match`
    this.skipNewlines();
    const subject = this._parseExpression();
    this.skipNewlines();
    this.expect(TokenType.COLON, "Expected ':' after match subject");

    const arms      = [];
    let   otherwise = null;

    while (true) {
      this.skipNewlines();
      if (this.check(TokenType.KW_WHEN)) {
        this.advance();
        this.skipNewlines();
        const pattern = this._parseExpression();
        const armBody = this._expectColonBlock();
        arms.push({ pattern, body: armBody });
      } else if (this.check(TokenType.KW_OTHERWISE)) {
        this.advance();
        otherwise = this._expectColonBlock();
        break;
      } else {
        break;
      }
    }

    this._expectEnd();
    return AST.MatchExpr(subject, arms, otherwise, tok.line, tok.col);
  }

  // ── expression statement ──────────────────────────────────────────────────
  _parseExpressionStatement() {
    const tok  = this.current();
    const expr = this._parseExpression();
    return AST.ExprStmt(expr, tok.line, tok.col);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Expression Parsing – Pratt-style recursive descent
  // ═══════════════════════════════════════════════════════════════════════════

  _parseExpression() {
    return this._parseAssignment();
  }

  // ── Assignment (=, +=, -=, *=, /=, %=) ──────────────────────────────────
  _parseAssignment() {
    const left = this._parseTernary();

    const assignOps = [
      TokenType.ASSIGN,
      TokenType.PLUS_ASSIGN,
      TokenType.MINUS_ASSIGN,
      TokenType.MUL_ASSIGN,
      TokenType.DIV_ASSIGN,
      TokenType.MOD_ASSIGN,
    ];

    const tok = this.current();
    if (assignOps.includes(tok.type)) {
      this.advance();
      this.skipNewlines();
      const right = this._parseAssignment(); // right-associative
      return AST.AssignExpr(tok.value, left, right, tok.line, tok.col);
    }

    return left;
  }

  // ── Ternary ───────────────────────────────────────────────────────────────
  _parseTernary() {
    const expr = this._parseNullCoalesce();
    const tok  = this.current();
    if (tok.type === TokenType.QUESTION) {
      this.advance();
      const consequent = this._parseExpression();
      this.expect(TokenType.COLON, "Expected ':' in ternary expression");
      const alternate = this._parseTernary();
      return AST.ConditionalExpr(expr, consequent, alternate, tok.line, tok.col);
    }
    return expr;
  }

  // ── Null-coalesce ??  ─────────────────────────────────────────────────────
  _parseNullCoalesce() {
    let left = this._parseLogicalOr();
    while (this.current().type === TokenType.NULL_COALESCE) {
      const tok = this.advance();
      const right = this._parseLogicalOr();
      left = AST.BinaryExpr('??', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Logical OR  ||  or ────────────────────────────────────────────────────
  _parseLogicalOr() {
    let left = this._parseLogicalAnd();
    while (checkAny(this.current(), TokenType.OR_OR, TokenType.KW_OR)) {
      const tok = this.advance();
      const right = this._parseLogicalAnd();
      left = AST.BinaryExpr('||', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Logical AND  &&  and ──────────────────────────────────────────────────
  _parseLogicalAnd() {
    let left = this._parseBitwiseOr();
    while (checkAny(this.current(), TokenType.AND_AND, TokenType.KW_AND)) {
      const tok = this.advance();
      const right = this._parseBitwiseOr();
      left = AST.BinaryExpr('&&', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Bitwise OR  | ─────────────────────────────────────────────────────────
  _parseBitwiseOr() {
    let left = this._parseBitwiseXor();
    while (this.current().type === TokenType.PIPE) {
      const tok = this.advance();
      const right = this._parseBitwiseXor();
      left = AST.BinaryExpr('|', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Bitwise XOR  ^ ────────────────────────────────────────────────────────
  _parseBitwiseXor() {
    let left = this._parseBitwiseAnd();
    while (this.current().type === TokenType.CARET) {
      const tok = this.advance();
      const right = this._parseBitwiseAnd();
      left = AST.BinaryExpr('^', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Bitwise AND  & ────────────────────────────────────────────────────────
  _parseBitwiseAnd() {
    let left = this._parseEquality();
    while (this.current().type === TokenType.AMPERSAND) {
      const tok = this.advance();
      const right = this._parseEquality();
      left = AST.BinaryExpr('&', left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Equality  == != === !== ────────────────────────────────────────────────
  _parseEquality() {
    let left = this._parseRelational();
    while (checkAny(this.current(),
        TokenType.EQ_EQ, TokenType.NOT_EQ,
        TokenType.EQ_STRICT, TokenType.NOT_EQ_STRICT)) {
      const tok = this.advance();
      const right = this._parseRelational();
      left = AST.BinaryExpr(tok.value, left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Relational  < <= > >= instanceof ─────────────────────────────────────
  _parseRelational() {
    let left = this._parseBitwiseShift();
    while (checkAny(this.current(),
        TokenType.LT, TokenType.LT_EQ,
        TokenType.GT, TokenType.GT_EQ,
        TokenType.KW_INSTANCEOF)) {
      const tok = this.advance();
      const right = this._parseBitwiseShift();
      left = AST.BinaryExpr(tok.value, left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Bitwise shift  << >> ──────────────────────────────────────────────────
  _parseBitwiseShift() {
    let left = this._parseAdditive();
    while (checkAny(this.current(), TokenType.SHIFT_LEFT, TokenType.SHIFT_RIGHT)) {
      const tok = this.advance();
      const right = this._parseAdditive();
      left = AST.BinaryExpr(tok.value, left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Additive  + - ─────────────────────────────────────────────────────────
  _parseAdditive() {
    let left = this._parseMultiplicative();
    while (checkAny(this.current(), TokenType.PLUS, TokenType.MINUS)) {
      const tok = this.advance();
      const right = this._parseMultiplicative();
      left = AST.BinaryExpr(tok.value, left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Multiplicative  * / % ─────────────────────────────────────────────────
  _parseMultiplicative() {
    let left = this._parseExponentiation();
    while (checkAny(this.current(), TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const tok = this.advance();
      const right = this._parseExponentiation();
      left = AST.BinaryExpr(tok.value, left, right, tok.line, tok.col);
    }
    return left;
  }

  // ── Exponentiation  ** (right-associative) ────────────────────────────────
  _parseExponentiation() {
    const base = this._parseUnaryPrefix();
    if (this.current().type === TokenType.POWER) {
      const tok   = this.advance();
      const right = this._parseExponentiation(); // right-assoc
      return AST.BinaryExpr('**', base, right, tok.line, tok.col);
    }
    return base;
  }

  // ── Unary prefix  - ! ~ typeof not new await yield ────────────────────────
  _parseUnaryPrefix() {
    const tok = this.current();

    switch (tok.type) {
      case TokenType.MINUS: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('-', arg, true, tok.line, tok.col);
      }
      case TokenType.NOT:
      case TokenType.KW_NOT: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('!', arg, true, tok.line, tok.col);
      }
      case TokenType.TILDE: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('~', arg, true, tok.line, tok.col);
      }
      case TokenType.KW_TYPEOF: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('typeof', arg, true, tok.line, tok.col);
      }
      case TokenType.KW_NEW: {
        this.advance();
        this.skipNewlines();
        const callee = this._parsePostfix(this._parsePrimary());
        const args   = this.check(TokenType.LPAREN) ? this._parseArgList() : [];
        return AST.NewExpr(callee, args, tok.line, tok.col);
      }
      case TokenType.KW_AWAIT: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('await', arg, true, tok.line, tok.col);
      }
      case TokenType.KW_YIELD: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('yield', arg, true, tok.line, tok.col);
      }
      case TokenType.PLUS_PLUS: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('++', arg, true, tok.line, tok.col);
      }
      case TokenType.MINUS_MINUS: {
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('--', arg, true, tok.line, tok.col);
      }
      case TokenType.PLUS: {
        // unary + – mostly a no-op but valid
        this.advance();
        const arg = this._parseUnaryPrefix();
        return AST.UnaryExpr('+', arg, true, tok.line, tok.col);
      }
      default:
        return this._parsePostfix(this._parsePrimary());
    }
  }

  // ── Postfix  ++ -- ────────────────────────────────────────────────────────
  _parsePostfix(expr) {
    while (true) {
      const tok = this.current();
      if (tok.type === TokenType.PLUS_PLUS) {
        this.advance();
        expr = AST.UnaryExpr('++', expr, false, tok.line, tok.col);
      } else if (tok.type === TokenType.MINUS_MINUS) {
        this.advance();
        expr = AST.UnaryExpr('--', expr, false, tok.line, tok.col);
      } else if (tok.type === TokenType.LPAREN) {
        // call
        const args = this._parseArgList();
        expr = AST.CallExpr(expr, args, tok.line, tok.col);
      } else if (tok.type === TokenType.DOT) {
        this.advance();
        const prop = this._expectIdentifierName('Expected property name after \'.\'');
        expr = AST.MemberExpr(expr, prop, false, tok.line, tok.col);
      } else if (tok.type === TokenType.OPTIONAL_CHAIN) {
        this.advance();
        const prop = this._expectIdentifierName('Expected property name after \'?.\'');
        expr = AST.MemberExpr(expr, prop, true, tok.line, tok.col);
      } else if (tok.type === TokenType.LBRACKET) {
        this.advance();
        const index = this._parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']'");
        expr = AST.IndexExpr(expr, index, tok.line, tok.col);
      } else {
        break;
      }
    }
    return expr;
  }

  /** Parse a comma-separated argument list inside ( ) */
  _parseArgList() {
    const tok  = this.current();
    this.expect(TokenType.LPAREN, "Expected '('");
    const args = [];
    this.skipNewlines();
    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.SPREAD)) {
        const st = this.current();
        this.advance();
        args.push(AST.SpreadExpr(this._parseExpression(), st.line, st.col));
      } else {
        args.push(this._parseExpression());
      }
      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.skipNewlines();
    this.expect(TokenType.RPAREN, "Expected ')' after argument list");
    return args;
  }

  // ── Primary ───────────────────────────────────────────────────────────────
  _parsePrimary() {
    this.skipNewlines();
    const tok = this.current();

    switch (tok.type) {
      // ── numeric literals ──────────────────────────────────────────────────
      case TokenType.NUMBER:
      case TokenType.FLOAT: {
        this.advance();
        return AST.Literal('number', tok.value, tok.line, tok.col);
      }

      // ── string ────────────────────────────────────────────────────────────
      case TokenType.STRING: {
        this.advance();
        return AST.Literal('string', tok.value, tok.line, tok.col);
      }

      // ── template literal ──────────────────────────────────────────────────
      case TokenType.TEMPLATE_LITERAL: {
        this.advance();
        // tok.value is an array of {type:'str'|'expr', value:string}
        // The expr parts are raw source strings – parse them into sub-ASTs.
        const parts = (tok.value || []).map(part => {
          if (part.type === 'str') return { type: 'str', value: part.value };
          // Parse the embedded expression source
          try {
            const subParser = new Parser(part.value, this.filename + ':template');
            const { ast: subAst } = subParser.parse();
            // subAst.body[0] is an ExprStmt wrapping the expression
            const exprNode = (subAst.body[0] && subAst.body[0].expression)
              ? subAst.body[0].expression
              : subAst.body[0];
            return { type: 'expr', value: exprNode };
          } catch (_) {
            return { type: 'expr', value: AST.Literal('string', part.value, tok.line, tok.col) };
          }
        });
        return AST.TemplateLiteral(parts, tok.line, tok.col);
      }

      // ── booleans ──────────────────────────────────────────────────────────
      case TokenType.KW_TRUE:
      case TokenType.BOOLEAN: {
        this.advance();
        return AST.Literal('boolean', true, tok.line, tok.col);
      }
      case TokenType.KW_FALSE:
      case TokenType.KW_FAKE: {
        this.advance();
        return AST.Literal('boolean', false, tok.line, tok.col);
      }

      // ── null / undefined ──────────────────────────────────────────────────
      case TokenType.NULL:
      case TokenType.KW_NULL: {
        this.advance();
        return AST.Literal('null', null, tok.line, tok.col);
      }
      case TokenType.KW_UNDEFINED: {
        this.advance();
        return AST.Literal('undefined', undefined, tok.line, tok.col);
      }

      // ── this / self / super ───────────────────────────────────────────────
      case TokenType.KW_THIS:
      case TokenType.KW_SELF: {
        this.advance();
        return AST.Identifier('this', tok.line, tok.col);
      }
      case TokenType.KW_SUPER: {
        this.advance();
        return AST.Identifier('super', tok.line, tok.col);
      }

      // ── grouped expression / arrow function ───────────────────────────────
      case TokenType.LPAREN: {
        return this._parseGroupedOrArrow();
      }

      // ── array literal ─────────────────────────────────────────────────────
      case TokenType.LBRACKET: {
        return this._parseArrayLiteral();
      }

      // ── object literal ────────────────────────────────────────────────────
      case TokenType.LBRACE: {
        return this._parseObjectLiteral();
      }

      // ── input(…) used as expression ───────────────────────────────────────
      case TokenType.KW_INPUT: {
        return this._parseInputExpr();
      }

      // ── calculate(…) as expression ────────────────────────────────────────
      case TokenType.KW_CALCULATE: {
        this.advance();
        this.expect(TokenType.LPAREN, "Expected '('");
        const expr = this._parseExpression();
        this.expect(TokenType.RPAREN, "Expected ')'");
        return AST.CalculateExpr(expr, tok.line, tok.col);
      }

      // ── free() as expression ──────────────────────────────────────────────
      case TokenType.KW_FREE: {
        this.advance();
        if (this.check(TokenType.LPAREN)) {
          this.advance();
          this.skipNewlines();
          this.expect(TokenType.RPAREN, "Expected ')'");
        }
        return AST.FreeExpr(tok.line, tok.col);
      }

      // ── spread used in an expression context ──────────────────────────────
      case TokenType.SPREAD: {
        this.advance();
        return AST.SpreadExpr(this._parseUnaryPrefix(), tok.line, tok.col);
      }

      // ── identifier (and keyword-identifiers) ──────────────────────────────
      case TokenType.IDENTIFIER:
        return this._parseIdentifierPrimary();

      // ── many ThyScript keywords are also valid identifiers when used as
      //    a callee or member target (e.g. `print`, `save`, `load`, …)
      default:
        if (this._isKeywordUsableAsIdentifier(tok)) {
          this.advance();
          return AST.Identifier(tok.value, tok.line, tok.col);
        }
        this._error(`Unexpected token '${tok.type}' ('${tok.value}')`, tok);
        // fallback to keep parser in a sane state
        this.advance();
        return AST.Literal('null', null, tok.line, tok.col);
    }
  }

  /**
   * True for keywords that can legitimately appear as property names /
   * function names / identifiers in expression position.
   */
  _isKeywordUsableAsIdentifier(tok) {
    const usable = new Set([
      TokenType.KW_PRINT,     TokenType.KW_SAVE,       TokenType.KW_FREE,
      TokenType.KW_INPUT,     TokenType.KW_CALCULATE,  TokenType.KW_ADD,
      TokenType.KW_CHANGE,    TokenType.KW_TO,          TokenType.KW_IN,
      TokenType.KW_GET,       TokenType.KW_POST,        TokenType.KW_PUT,
      TokenType.KW_PATCH,     TokenType.KW_DELETE,      TokenType.KW_DELETE_HTTP,
      TokenType.KW_CONNECT,   TokenType.KW_LISTEN,      TokenType.KW_ON,
      TokenType.KW_EMIT,      TokenType.KW_SOCKET,      TokenType.KW_ROUTE,
      TokenType.KW_SERVER,    TokenType.KW_DATABASE,    TokenType.KW_QUERY,
      TokenType.KW_INSERT,    TokenType.KW_UPDATE,      TokenType.KW_SELECT,
      TokenType.KW_WHERE,     TokenType.KW_JOIN,        TokenType.KW_CREATE,
      TokenType.KW_DROP,      TokenType.KW_RENDER,      TokenType.KW_COMPONENT,
      TokenType.KW_STATE,     TokenType.KW_PROPS,       TokenType.KW_STYLE,
      TokenType.KW_ANIMATE,   TokenType.KW_NEURAL,      TokenType.KW_PHYSICS,
      TokenType.KW_PARALLEL,  TokenType.KW_WORKER,      TokenType.KW_STREAM,
      TokenType.KW_PIPELINE,  TokenType.KW_MATCH,       TokenType.KW_WHEN,
      TokenType.KW_OTHERWISE, TokenType.KW_STATIC,      TokenType.KW_ABSTRACT,
      TokenType.KW_INTERFACE, TokenType.KW_EXTENDS,     TokenType.KW_IMPLEMENTS,
      TokenType.KW_LOAD,      TokenType.KW_READ,        TokenType.KW_WRITE,
      TokenType.KW_APPEND,    TokenType.KW_EXISTS,      TokenType.KW_MKDIR,
      TokenType.KW_PATH,      TokenType.KW_ENV,         TokenType.KW_CONFIG,
      TokenType.KW_PROCESS,   TokenType.KW_EXIT,        TokenType.KW_SLEEP,
      TokenType.KW_TIMEOUT,   TokenType.KW_INTERVAL,    TokenType.KW_FETCH,
      TokenType.KW_HTTP,      TokenType.KW_HTTPS,       TokenType.KW_URL,
      TokenType.KW_COOKIE,    TokenType.KW_SESSION,     TokenType.KW_HEADER,
      TokenType.KW_BODY,      TokenType.KW_PARAM,       TokenType.KW_FORM,
      TokenType.KW_UPLOAD,    TokenType.KW_DOWNLOAD,    TokenType.KW_SERVE,
      TokenType.KW_TEMPLATE,  TokenType.KW_LAYOUT,      TokenType.KW_PAGE,
      TokenType.KW_SECTION,   TokenType.KW_WIDGET,      TokenType.KW_BUTTON,
      TokenType.KW_CHART,     TokenType.KW_GRAPH,       TokenType.KW_PLOT,
      TokenType.KW_DASHBOARD, TokenType.KW_CARD,        TokenType.KW_MODAL,
      TokenType.KW_TOAST,     TokenType.KW_ALERT,       TokenType.KW_NAV,
      TokenType.KW_MENU,      TokenType.KW_SIDEBAR,     TokenType.KW_FOOTER,
      TokenType.KW_THEME,     TokenType.KW_DARK,        TokenType.KW_LIGHT,
      TokenType.KW_GRID,      TokenType.KW_FLEX,        TokenType.KW_RESPONSIVE,
      TokenType.KW_MEDIA,     TokenType.KW_TRANSITION,  TokenType.KW_EFFECT,
      TokenType.KW_SHADOW,    TokenType.KW_BORDER,      TokenType.KW_RADIUS,
      TokenType.KW_PADDING,   TokenType.KW_MARGIN,      TokenType.KW_FONT,
      TokenType.KW_SIZE,      TokenType.KW_WIDTH,       TokenType.KW_HEIGHT,
      TokenType.KW_POSITION,  TokenType.KW_LAYER,       TokenType.KW_OPACITY,
      TokenType.KW_BLUR,      TokenType.KW_CURSOR,      TokenType.KW_HOVER,
      TokenType.KW_CLICK,     TokenType.KW_SCROLL,      TokenType.KW_DRAG,
      TokenType.KW_DROP,      TokenType.KW_RESIZE,      TokenType.KW_KEYBOARD,
      TokenType.KW_MOUSE,     TokenType.KW_TOUCH,       TokenType.KW_GAMEPAD,
      TokenType.KW_AUDIO,     TokenType.KW_VIDEO,       TokenType.KW_CAMERA,
      TokenType.KW_MICROPHONE,TokenType.KW_STORAGE,     TokenType.KW_NOTIFICATION,
      TokenType.KW_PERMISSION,TokenType.KW_GEO,         TokenType.KW_CLIPBOARD,
      TokenType.KW_NETWORK,   TokenType.KW_WEBGL,       TokenType.KW_WEBGPU,
      TokenType.KW_SHADER,    TokenType.KW_VERTEX,      TokenType.KW_FRAGMENT,
      TokenType.KW_TEXTURE,   TokenType.KW_MESH,        TokenType.KW_MODEL,
      TokenType.KW_MATERIAL,  TokenType.KW_GEOMETRY,    TokenType.KW_ROTATION,
      TokenType.KW_SCALE,     TokenType.KW_TRANSLATE,   TokenType.KW_VIEW,
      TokenType.KW_BLEND,     TokenType.KW_DEPTH,       TokenType.KW_UNIFORM,
      TokenType.KW_COMPUTE,   TokenType.KW_DISPATCH,    TokenType.KW_ATOMIC,
      TokenType.KW_SYNC,      TokenType.KW_WAIT,        TokenType.KW_NOTIFY,
      TokenType.KW_BROADCAST, TokenType.KW_CLUSTER,     TokenType.KW_MASTER,
      TokenType.KW_FORK,      TokenType.KW_SIMD,        TokenType.KW_INLINE,
      TokenType.KW_PURE,      TokenType.KW_EXTERN,      TokenType.KW_NATIVE,
      TokenType.KW_WASM,      TokenType.KW_MACRO,       TokenType.KW_ASM,
      TokenType.KW_VOLATILE,  TokenType.KW_ALIGN,       TokenType.KW_SIZEOF,
      TokenType.KW_NAN,       TokenType.KW_INF,         TokenType.KW_PI,
      TokenType.KW_SQRT,      TokenType.KW_POW,         TokenType.KW_ABS,
      TokenType.KW_FLOOR,     TokenType.KW_CEIL,        TokenType.KW_ROUND,
      TokenType.KW_SIN,       TokenType.KW_COS,         TokenType.KW_TAN,
      TokenType.KW_ASIN,      TokenType.KW_ACOS,        TokenType.KW_ATAN,
      TokenType.KW_ATAN2,     TokenType.KW_EXP,         TokenType.KW_RANDOM,
      TokenType.KW_SEED,      TokenType.KW_MIN,         TokenType.KW_MAX,
      TokenType.KW_CLAMP,     TokenType.KW_LERP,        TokenType.KW_NORMALIZE,
      TokenType.KW_DISTANCE,  TokenType.KW_MAGNITUDE,   TokenType.KW_DETERMINANT,
      TokenType.KW_INVERSE,   TokenType.KW_TRANSPOSE,   TokenType.KW_GRADIENT,
      TokenType.KW_INTEGRATE, TokenType.KW_DIFFERENTIATE, TokenType.KW_SOLVE,
      TokenType.KW_OPTIMIZE,  TokenType.KW_MINIMIZE,    TokenType.KW_MAXIMIZE,
      TokenType.KW_TRAIN,     TokenType.KW_PREDICT,     TokenType.KW_SIMULATE,
      TokenType.KW_LOSS,      TokenType.KW_BACKPROP,    TokenType.KW_DENSE,
      TokenType.KW_CONV,      TokenType.KW_POOL,        TokenType.KW_DROPOUT,
      TokenType.KW_ACTIVATION,TokenType.KW_RELU,        TokenType.KW_SIGMOID,
      TokenType.KW_SOFTMAX,   TokenType.KW_ATTENTION,   TokenType.KW_TRANSFORMER,
      TokenType.KW_EMBEDDING, TokenType.KW_TOKENIZE,    TokenType.KW_DATASET,
      TokenType.KW_BATCH,     TokenType.KW_EPOCH,       TokenType.KW_OPTIMIZER,
      TokenType.KW_SGD,       TokenType.KW_ADAM,        TokenType.KW_MOMENTUM,
      TokenType.KW_REGULARIZE,TokenType.KW_CHECKPOINT,  TokenType.KW_INFERENCE,
      TokenType.KW_ACCURACY,  TokenType.KW_RECALL,      TokenType.KW_FEATURE,
      TokenType.KW_LABEL,     TokenType.KW_ENSEMBLE,    TokenType.KW_BOOST,
      TokenType.KW_KMEANS,    TokenType.KW_PCA,         TokenType.KW_SVM,
      TokenType.KW_REGRESSION,TokenType.KW_CLASSIFICATION, TokenType.KW_DETECTION,
      TokenType.KW_SEGMENTATION, TokenType.KW_GENERATION, TokenType.KW_DIFFUSION,
      TokenType.KW_GAN,       TokenType.KW_VAE,         TokenType.KW_REINFORCE,
      TokenType.KW_REWARD,    TokenType.KW_ENVIRONMENT, TokenType.KW_ACTION,
      TokenType.KW_OBSERVATION, TokenType.KW_POLICY,   TokenType.KW_VALUE,
      TokenType.KW_RIGIDBODY, TokenType.KW_SOFTBODY,   TokenType.KW_FLUID,
      TokenType.KW_SPRING,    TokenType.KW_DAMPER,      TokenType.KW_FRICTION,
      TokenType.KW_RESTITUTION, TokenType.KW_MASS,      TokenType.KW_INERTIA,
      TokenType.KW_VELOCITY,  TokenType.KW_ACCELERATION,TokenType.KW_TORQUE,
      TokenType.KW_RAYCAST,   TokenType.KW_IMPULSE,     TokenType.KW_TIMESTEP,
      TokenType.KW_SUBSTEP,   TokenType.KW_ENTITY,      TokenType.KW_WORLD,
      TokenType.KW_RESOURCE,  TokenType.KW_EVENT,       TokenType.KW_COMMAND,
      TokenType.KW_PLUGIN,    TokenType.KW_STAGE,       TokenType.KW_ORDERED,
      TokenType.KW_WITH,      TokenType.KW_WITHOUT,     TokenType.KW_MAYBE,
      TokenType.KW_LOG,       TokenType.KW_WARN,        TokenType.KW_ERROR,
      TokenType.KW_DEBUG,     TokenType.KW_INFO,
      TokenType.KW_MATRIX,    TokenType.KW_VECTOR,      TokenType.KW_TENSOR,
      TokenType.KW_PARTICLE,  TokenType.KW_FORCE,       TokenType.KW_GRAVITY,
      TokenType.KW_COLLISION, TokenType.KW_SCENE,       TokenType.KW_CANVAS,
      TokenType.KW_DRAW,      TokenType.KW_CLEAR,       TokenType.KW_COLOR,
      TokenType.KW_FILL,      TokenType.KW_STROKE,      TokenType.KW_IMAGE,
      TokenType.KW_SPRITE,    TokenType.KW_SECURITY,    TokenType.KW_ENCRYPT,
      TokenType.KW_DECRYPT,   TokenType.KW_HASH,        TokenType.KW_TOKEN,
      TokenType.KW_AUTH,      TokenType.KW_VALIDATE,    TokenType.KW_SANITIZE,
      TokenType.KW_VOID,      TokenType.KW_MUT,         TokenType.KW_REF,
      TokenType.KW_CLONE,     TokenType.KW_MOVE,        TokenType.KW_COPY,
      TokenType.KW_SHARE,     TokenType.KW_DEFER,       TokenType.KW_PANIC,
      TokenType.KW_RECOVER,   TokenType.KW_BENCHMARK,   TokenType.KW_PROFILE,
      TokenType.KW_MEASURE,   TokenType.KW_CACHE,       TokenType.KW_MEMO,
      TokenType.KW_PROXY,     TokenType.KW_REFLECT,     TokenType.KW_META,
      TokenType.KW_DECORATOR, TokenType.KW_INJECT,      TokenType.KW_PROVIDE,
      TokenType.KW_OBSERVE,   TokenType.KW_SUBSCRIBE,   TokenType.KW_UNSUBSCRIBE,
      TokenType.KW_BUFFER,    TokenType.KW_CHUNK,       TokenType.KW_FLUSH,
      TokenType.KW_COMPRESS,  TokenType.KW_DECOMPRESS,  TokenType.KW_SERIALIZE,
      TokenType.KW_DESERIALIZE, TokenType.KW_PARSE,     TokenType.KW_FORMAT,
      TokenType.KW_ENCODE,    TokenType.KW_DECODE,      TokenType.KW_TRANSFORM,
      TokenType.KW_FILTER,    TokenType.KW_REDUCE,      TokenType.KW_SORT,
      TokenType.KW_FIND,      TokenType.KW_SEARCH,      TokenType.KW_INDEX,
      TokenType.KW_SLICE,     TokenType.KW_SPLICE,      TokenType.KW_SPLIT,
      TokenType.KW_TRIM,      TokenType.KW_UPPER,       TokenType.KW_LOWER,
      TokenType.KW_REPLACE,   TokenType.KW_REGEX,       TokenType.KW_FILE,
      TokenType.KW_LAZY,      TokenType.KW_EAGER,       TokenType.KW_CONCURRENT,
      TokenType.KW_MUTEX,     TokenType.KW_LOCK,        TokenType.KW_UNLOCK,
      TokenType.KW_THREAD,    TokenType.KW_SPAWN,       TokenType.KW_CHANNEL,
      TokenType.KW_SEND,      TokenType.KW_RECEIVE,
      // HTML tag keywords as identifiers
      TokenType.KW_HTML_DIV,  TokenType.KW_HTML_SPAN,   TokenType.KW_HTML_P,
      TokenType.KW_HTML_A,
    ]);
    return usable.has(tok.type);
  }

  /** Try to parse identifier primary (and check for arrow function) */
  _parseIdentifierPrimary() {
    const tok = this.current();
    this.advance();
    return AST.Identifier(tok.value, tok.line, tok.col);
  }

  /**
   * Parse `(…)` – either a grouped expression or the start of an arrow fn.
   * Lookahead heuristic: if after consuming `(params)` we see `=>`, it's an arrow.
   */
  _parseGroupedOrArrow() {
    const tok       = this.current();
    const savedPos  = this.pos;

    // Collect the items inside ( ) as potential params
    this.advance(); // consume `(`
    this.skipNewlines();

    // Try to parse as arrow function parameters
    const params   = [];
    let   isArrow  = false;
    let   isAsync  = false;
    let   arrowPos = savedPos;

    try {
      while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
        this.skipNewlines();
        if (this.check(TokenType.SPREAD)) {
          this.advance();
          params.push('...' + this._expectIdentifierName('Expected rest param'));
        } else {
          const paramTok = this.current();
          if (paramTok.type !== TokenType.IDENTIFIER && !this._isKeywordUsableAsIdentifier(paramTok)) {
            throw new Error('not-arrow');
          }
          this.advance();
          const name = paramTok.value;
          if (this.match(TokenType.ASSIGN)) {
            const def = this._parseExpression();
            params.push({ name, default: def });
          } else {
            params.push(name);
          }
        }
        this.skipNewlines();
        if (!this.match(TokenType.COMMA)) break;
        this.skipNewlines();
      }
      this.skipNewlines();
      this.expect(TokenType.RPAREN, 'Expected )');
      this.skipNewlines();
      if (this.check(TokenType.FAT_ARROW)) {
        isArrow = true;
        arrowPos = this.pos;
      }
    } catch (_) {
      isArrow = false;
    }

    if (isArrow) {
      // Commit: parse arrow body
      this.advance(); // consume `=>`
      this.skipNewlines();
      let body;
      if (this.check(TokenType.LBRACE)) {
        // { … } block body
        this.advance();
        body = this._parseBlock();
        this.expect(TokenType.RBRACE, "Expected '}' to close arrow function body");
      } else if (this.check(TokenType.COLON)) {
        // ThyScript block style: => : ... end()
        body = this._expectColonBlock();
        this._expectEnd();
      } else {
        body = this._parseAssignment();
      }
      return AST.ArrowFunctionExpr(params, body, isAsync, tok.line, tok.col);
    }

    // Not an arrow – rewind and parse as grouped expression
    this.pos = savedPos;
    this.advance(); // consume `(` again
    this.skipNewlines();
    const expr = this._parseExpression();
    this.skipNewlines();
    this.expect(TokenType.RPAREN, "Expected ')' to close grouped expression");
    return expr;
  }

  /** Array literal  [e1, e2, …] */
  _parseArrayLiteral() {
    const tok      = this.current();
    this.advance(); // consume `[`
    const elements = [];
    this.skipNewlines();
    while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.SPREAD)) {
        const st = this.current();
        this.advance();
        elements.push(AST.SpreadExpr(this._parseExpression(), st.line, st.col));
      } else if (this.check(TokenType.COMMA)) {
        elements.push(AST.Literal('undefined', undefined, tok.line, tok.col)); // elision
      } else {
        elements.push(this._parseExpression());
      }
      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.skipNewlines();
    this.expect(TokenType.RBRACKET, "Expected ']'");
    return AST.ArrayExpr(elements, tok.line, tok.col);
  }

  /** Object literal  { key: value, … } */
  _parseObjectLiteral() {
    const tok   = this.current();
    this.advance(); // consume `{`
    const props = [];
    this.skipNewlines();
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      this.skipNewlines();

      // Spread in object
      if (this.check(TokenType.SPREAD)) {
        const st = this.current();
        this.advance();
        props.push({
          type: 'spread',
          argument: this._parseExpression(),
          line: st.line, col: st.col,
        });
        this.skipNewlines();
        this.match(TokenType.COMMA);
        this.skipNewlines();
        continue;
      }

      // Computed property  [expr]: value
      if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const key = this._parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']'");
        this.expect(TokenType.COLON, "Expected ':' after computed key");
        const value = this._parseExpression();
        props.push({ key, value, computed: true, shorthand: false });
        this.skipNewlines();
        this.match(TokenType.COMMA);
        this.skipNewlines();
        continue;
      }

      // Method shorthand  name(params): body end()  or  name(params) { body }
      // Detected by: identifier followed by (
      const keyTok = this.current();
      const keyName = this._extractPropertyKey();

      if (this.check(TokenType.LPAREN)) {
        // Method
        const params = this._parseParamList();
        let   body;
        if (this.check(TokenType.LBRACE)) {
          this.advance();
          body = this._parseBlock();
          this.expect(TokenType.RBRACE, "Expected '}'");
        } else {
          body = this._expectColonBlock();
          this._expectEnd();
        }
        props.push({
          key: AST.Literal('string', keyName, keyTok.line, keyTok.col),
          value: AST.FunctionDecl(keyName, params, body, false, false, keyTok.line, keyTok.col),
          computed: false,
          shorthand: false,
          method: true,
        });
        this.skipNewlines();
        this.match(TokenType.COMMA);
        this.skipNewlines();
        continue;
      }

      // Normal property  key: value  or shorthand  key
      if (this.match(TokenType.COLON)) {
        const value = this._parseExpression();
        props.push({
          key: AST.Literal('string', keyName, keyTok.line, keyTok.col),
          value,
          computed: false,
          shorthand: false,
        });
      } else {
        // Shorthand  { x }  →  { x: x }
        props.push({
          key: AST.Literal('string', keyName, keyTok.line, keyTok.col),
          value: AST.Identifier(keyName, keyTok.line, keyTok.col),
          computed: false,
          shorthand: true,
        });
      }

      this.skipNewlines();
      if (!this.match(TokenType.COMMA)) break;
      this.skipNewlines();
    }
    this.skipNewlines();
    this.expect(TokenType.RBRACE, "Expected '}' to close object literal");
    return AST.ObjectExpr(props, tok.line, tok.col);
  }

  /** Extract a property key as a string (identifier, string literal, number) */
  _extractPropertyKey() {
    const tok = this.current();
    if (tok.type === TokenType.STRING) {
      this.advance();
      return tok.value;
    }
    if (tok.type === TokenType.NUMBER || tok.type === TokenType.FLOAT) {
      this.advance();
      return String(tok.value);
    }
    return this._expectIdentifierName('Expected property key');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utility helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Consume the current `end` token and the `()` that follows it.
   * ThyScript uses `end()` as block terminator.
   */
  _expectEnd() {
    this.skipNewlines();
    if (this.check(TokenType.KW_END)) {
      this.advance(); // consume `end`
      this.skipNewlines();
      // Consume optional ()
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        this.skipNewlines();
        if (this.check(TokenType.RPAREN)) this.advance();
      }
    } else {
      this._error("Expected 'end()' to close block", this.current());
    }
  }

  /**
   * Consume the next token as an identifier name.
   * Accepts both IDENTIFIER tokens and many keyword tokens that double as names.
   */
  _expectIdentifierName(errorMsg) {
    this.skipNewlines();
    const tok = this.current();
    if (tok.type === TokenType.IDENTIFIER) {
      this.advance();
      return tok.value;
    }
    if (this._isKeywordUsableAsIdentifier(tok)) {
      this.advance();
      return tok.value;
    }
    this._error(errorMsg || 'Expected identifier', tok);
    return '_error_';
  }

  /** Consume a STRING token and return its value */
  _expectString(errorMsg) {
    this.skipNewlines();
    const tok = this.current();
    if (tok.type === TokenType.STRING) {
      this.advance();
      return tok.value;
    }
    if (tok.type === TokenType.TEMPLATE_LITERAL) {
      this.advance();
      return tok.value;
    }
    this._error(errorMsg || 'Expected string', tok);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level helpers (avoid `this` inside switch/static context)
// ─────────────────────────────────────────────────────────────────────────────
function checkAny(tok, ...types) {
  return types.includes(tok.type);
}

module.exports = Parser;

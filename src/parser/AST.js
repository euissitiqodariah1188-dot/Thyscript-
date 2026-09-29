'use strict';
/**
 * ThyScript AST Node Factory
 * Produces plain-object AST nodes for every language construct.
 * Every node carries:
 *   type  – string discriminator
 *   line  – source line (1-indexed)
 *   col   – source column (1-indexed)
 * plus construct-specific fields documented below.
 */

// ─────────────────────────────────────────────────────────────
// Helper – attach source location to every node
// ─────────────────────────────────────────────────────────────
function node(type, fields, line, col) {
  return Object.assign({ type, line: line || 0, col: col || 0 }, fields);
}

// ─────────────────────────────────────────────────────────────
// Top-level
// ─────────────────────────────────────────────────────────────

/** Root of every ThyScript program */
function Program(body, line, col) {
  return node('Program', { body }, line, col);
}

/** Sequence of statements wrapped by :…end() or a block delimiter */
function Block(body, line, col) {
  return node('Block', { body }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Declarations
// ─────────────────────────────────────────────────────────────

/**
 * `const table name = value`
 * @param {string}  name
 * @param {*}       init   – AST expression or null
 * @param {boolean} isConst
 */
function VarDecl(name, init, isConst, line, col) {
  return node('VarDecl', { name, init, isConst }, line, col);
}

/**
 * `[async] func name(params): body end()`
 * @param {string}   name
 * @param {string[]} params – parameter name strings
 * @param {Block}    body
 * @param {boolean}  isAsync
 * @param {boolean}  isExported
 */
function FunctionDecl(name, params, body, isAsync, isExported, line, col) {
  return node('FunctionDecl', { name, params, body, isAsync, isExported }, line, col);
}

/**
 * `[public|private|protected] class(Name)[extends Super]: body end()`
 * @param {string}      name
 * @param {string|null} superClass
 * @param {Block}       body
 * @param {string}      access  – 'public' | 'private' | 'protected'
 */
function ClassDecl(name, superClass, body, access, line, col) {
  return node('ClassDecl', { name, superClass, body, access }, line, col);
}

/**
 * `classHtml(Name): rawHtml end()`
 * @param {string} name
 * @param {string} html – raw HTML string captured by lexer
 */
function HtmlClassDecl(name, html, line, col) {
  return node('HtmlClassDecl', { name, html }, line, col);
}

/**
 * `import name from 'module'`
 * @param {string[]} specifiers
 * @param {string}   source
 * @param {boolean}  isDefault
 */
function ImportDecl(specifiers, source, isDefault, line, col) {
  return node('ImportDecl', { specifiers, source, isDefault }, line, col);
}

/**
 * `export func …` / `export const table …`
 * @param {*} declaration – the inner declaration node
 */
function ExportDecl(declaration, line, col) {
  return node('ExportDecl', { declaration }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Statements
// ─────────────────────────────────────────────────────────────

/**
 * `if(cond): consequent [elif(cond): alt]* [else: alternate] end()`
 * @param {*}         test
 * @param {Block}     consequent
 * @param {Array}     elseifs   – array of { test, body }
 * @param {Block|null} alternate
 */
function IfStmt(test, consequent, elseifs, alternate, line, col) {
  return node('IfStmt', { test, consequent, elseifs, alternate }, line, col);
}

/**
 * `while(cond): body end()`
 */
function WhileStmt(test, body, line, col) {
  return node('WhileStmt', { test, body }, line, col);
}

/**
 * `for variable in iterable: body end()`
 * @param {string} variable
 * @param {*}      iterable
 * @param {Block}  body
 */
function ForStmt(variable, iterable, body, line, col) {
  return node('ForStmt', { variable, iterable, body }, line, col);
}

/** `return [expr]` */
function ReturnStmt(argument, line, col) {
  return node('ReturnStmt', { argument }, line, col);
}

/** `print(expr, …)` */
function PrintStmt(args, line, col) {
  return node('PrintStmt', { args }, line, col);
}

/** Expression used as a statement (assignments, calls, ++/--, etc.) */
function ExprStmt(expression, line, col) {
  return node('ExprStmt', { expression }, line, col);
}

/**
 * `add N in list`
 * @param {*}      value   – expression to add
 * @param {string} target  – identifier of the list
 */
function AddStmt(value, target, line, col) {
  return node('AddStmt', { value, target }, line, col);
}

/**
 * `change(variable to(newValue))`
 * @param {string} target
 * @param {*}      value
 */
function ChangeStmt(target, value, line, col) {
  return node('ChangeStmt', { target, value }, line, col);
}

/**
 * `calculate(expression)` – evaluates and returns/prints a math expression
 * @param {*} expression
 */
function CalculateStmt(expression, line, col) {
  return node('CalculateStmt', { expression }, line, col);
}

/**
 * `save(variable)` – persists a variable to storage
 * @param {string} name
 */
function SaveStmt(name, line, col) {
  return node('SaveStmt', { name }, line, col);
}

/** `free()` – releases managed memory / clears scope */
function FreeExpr(line, col) {
  return node('FreeExpr', {}, line, col);
}

/**
 * `try: body catch(e): handler [finally: fin] end()`
 * @param {Block}       body
 * @param {string|null} errorVar
 * @param {Block}       handler
 * @param {Block|null}  finalizer
 */
function TryCatch(body, errorVar, handler, finalizer, line, col) {
  return node('TryCatch', { body, errorVar, handler, finalizer }, line, col);
}

/** `break` */
function BreakStmt(line, col) {
  return node('BreakStmt', {}, line, col);
}

/** `continue` */
function ContinueStmt(line, col) {
  return node('ContinueStmt', {}, line, col);
}

/** `throw expression` */
function ThrowStmt(argument, line, col) {
  return node('ThrowStmt', { argument }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Expressions
// ─────────────────────────────────────────────────────────────

/**
 * Binary operator expression
 * @param {string} operator – '+', '-', '*', '/', '**', '%', '==', '!=', '<', etc.
 * @param {*}      left
 * @param {*}      right
 */
function BinaryExpr(operator, left, right, line, col) {
  return node('BinaryExpr', { operator, left, right }, line, col);
}

/**
 * Unary prefix operator
 * @param {string}  operator – '-', '!', '~', 'typeof', 'new', 'await', 'yield'
 * @param {*}       argument
 * @param {boolean} prefix
 */
function UnaryExpr(operator, argument, prefix, line, col) {
  return node('UnaryExpr', { operator, argument, prefix }, line, col);
}

/**
 * Function call
 * @param {*}   callee
 * @param {*[]} args
 */
function CallExpr(callee, args, line, col) {
  return node('CallExpr', { callee, args }, line, col);
}

/**
 * Property access:  obj.prop  or  obj?.prop
 * @param {*}       object
 * @param {string}  property
 * @param {boolean} optional – true for ?.
 */
function MemberExpr(object, property, optional, line, col) {
  return node('MemberExpr', { object, property, optional }, line, col);
}

/**
 * Computed / index access:  arr[i]
 * @param {*} object
 * @param {*} index
 */
function IndexExpr(object, index, line, col) {
  return node('IndexExpr', { object, index }, line, col);
}

/**
 * Scalar literal
 * @param {'number'|'string'|'boolean'|'null'|'undefined'} kind
 * @param {*} value
 */
function Literal(kind, value, line, col) {
  return node('Literal', { kind, value }, line, col);
}

/**
 * Array literal  [e1, e2, …]
 * @param {*[]} elements
 */
function ArrayExpr(elements, line, col) {
  return node('ArrayExpr', { elements }, line, col);
}

/**
 * Object literal  { key: value, … }
 * @param {Array<{key:string|*,value:*,computed:boolean,shorthand:boolean}>} properties
 */
function ObjectExpr(properties, line, col) {
  return node('ObjectExpr', { properties }, line, col);
}

/**
 * `input(prompt)` – reads from stdin
 * @param {*} prompt – expression (usually a string literal)
 */
function InputExpr(prompt, line, col) {
  return node('InputExpr', { prompt }, line, col);
}

/**
 * Template literal `` `Hello ${name}` ``
 * @param {Array<{type:'str'|'expr', value:string|*}>} parts
 */
function TemplateLiteral(parts, line, col) {
  return node('TemplateLiteral', { parts }, line, col);
}

/**
 * Arrow function  (params) => expr | block
 * @param {string[]} params
 * @param {*}        body  – expression or Block
 * @param {boolean}  async
 */
function ArrowFunctionExpr(params, body, isAsync, line, col) {
  return node('ArrowFunctionExpr', { params, body, isAsync }, line, col);
}

/**
 * Spread operator  ...expr
 * @param {*} argument
 */
function SpreadExpr(argument, line, col) {
  return node('SpreadExpr', { argument }, line, col);
}

/**
 * Destructuring declaration
 * `const table [a, b] = arr` or `const table {x, y} = obj`
 * @param {'array'|'object'} kind
 * @param {Array}            targets  – names or {key,alias} objects
 * @param {*}                init
 */
function DestructureDecl(kind, targets, init, isConst, line, col) {
  return node('DestructureDecl', { kind, targets, init, isConst }, line, col);
}

/**
 * `calculate(expr)` used as an expression that returns a value
 */
function CalculateExpr(expression, line, col) {
  return node('CalculateExpr', { expression }, line, col);
}

/**
 * Ternary / conditional expression  test ? consequent : alternate
 */
function ConditionalExpr(test, consequent, alternate, line, col) {
  return node('ConditionalExpr', { test, consequent, alternate }, line, col);
}

/**
 * `new Constructor(args)`
 */
function NewExpr(callee, args, line, col) {
  return node('NewExpr', { callee, args }, line, col);
}

/**
 * Identifier reference
 */
function Identifier(name, line, col) {
  return node('Identifier', { name }, line, col);
}

/**
 * Assignment expression  target = value  (and +=, -=, *=, /=, %=)
 */
function AssignExpr(operator, target, value, line, col) {
  return node('AssignExpr', { operator, target, value }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Pattern matching
// ─────────────────────────────────────────────────────────────

/**
 * `match expr: when p1: b1 … [otherwise: bN] end()`
 * @param {*}    subject
 * @param {Array<{pattern:*,body:Block}>} arms
 * @param {Block|null} otherwise
 */
function MatchExpr(subject, arms, otherwise, line, col) {
  return node('MatchExpr', { subject, arms, otherwise }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Concurrency / parallelism
// ─────────────────────────────────────────────────────────────

/**
 * `parallel: body end()`
 * @param {Block} body
 */
function ParallelDecl(body, line, col) {
  return node('ParallelDecl', { body }, line, col);
}

/**
 * `worker name: body end()`
 * @param {string|null} name
 * @param {Block}       body
 */
function WorkerDecl(name, body, line, col) {
  return node('WorkerDecl', { name, body }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Streaming / pipeline
// ─────────────────────────────────────────────────────────────

/**
 * `stream name: body end()`
 * @param {string|null} name
 * @param {Block}       body
 */
function StreamDecl(name, body, line, col) {
  return node('StreamDecl', { name, body }, line, col);
}

/**
 * `pipeline name: body end()`
 * @param {string|null} name
 * @param {Block}       body
 */
function PipelineDecl(name, body, line, col) {
  return node('PipelineDecl', { name, body }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Server / networking
// ─────────────────────────────────────────────────────────────

/**
 * `server: body end()`
 * @param {Block} body
 * @param {*|null} port – optional port expression
 */
function ServerDecl(body, port, line, col) {
  return node('ServerDecl', { body, port }, line, col);
}

/**
 * `route METHOD '/path': body end()`
 * @param {string} method  – 'get'|'post'|'put'|'delete'|'patch'
 * @param {*}      path    – string expression
 * @param {Block}  body
 */
function RouteDecl(method, path, body, line, col) {
  return node('RouteDecl', { method, path, body }, line, col);
}

/**
 * `socket on 'event': body end()`
 * @param {string} event
 * @param {Block}  body
 */
function SocketDecl(event, body, line, col) {
  return node('SocketDecl', { event, body }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────

/**
 * `database connect: body end()`
 * @param {Block} body
 * @param {*|null} connectionExpr
 */
function DatabaseDecl(body, connectionExpr, line, col) {
  return node('DatabaseDecl', { body, connectionExpr }, line, col);
}

// ─────────────────────────────────────────────────────────────
// UI / Components
// ─────────────────────────────────────────────────────────────

/**
 * `component Name: body end()`
 * @param {string} name
 * @param {Block}  body
 */
function ComponentDecl(name, body, line, col) {
  return node('ComponentDecl', { name, body }, line, col);
}

// ─────────────────────────────────────────────────────────────
// ML / AI
// ─────────────────────────────────────────────────────────────

/**
 * `neural: body end()`
 * @param {Block} body
 * @param {*|null} config – optional configuration expression
 */
function NeuralDecl(body, config, line, col) {
  return node('NeuralDecl', { body, config }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────────────────────

/**
 * `physics: body end()`
 * @param {Block} body
 * @param {*|null} config
 */
function PhysicsDecl(body, config, line, col) {
  return node('PhysicsDecl', { body, config }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Animation
// ─────────────────────────────────────────────────────────────

/**
 * `animate: body end()`
 * @param {Block} body
 * @param {*|null} target
 */
function AnimateDecl(body, target, line, col) {
  return node('AnimateDecl', { body, target }, line, col);
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────
module.exports = {
  // helpers
  node,

  // top-level
  Program,
  Block,

  // declarations
  VarDecl,
  FunctionDecl,
  ClassDecl,
  HtmlClassDecl,
  ImportDecl,
  ExportDecl,
  DestructureDecl,

  // statements
  IfStmt,
  WhileStmt,
  ForStmt,
  ReturnStmt,
  PrintStmt,
  ExprStmt,
  AddStmt,
  ChangeStmt,
  CalculateStmt,
  SaveStmt,
  FreeExpr,
  TryCatch,
  BreakStmt,
  ContinueStmt,
  ThrowStmt,

  // expressions
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  Literal,
  ArrayExpr,
  ObjectExpr,
  InputExpr,
  TemplateLiteral,
  ArrowFunctionExpr,
  SpreadExpr,
  CalculateExpr,
  ConditionalExpr,
  NewExpr,
  Identifier,
  AssignExpr,

  // pattern matching
  MatchExpr,

  // concurrency
  ParallelDecl,
  WorkerDecl,

  // streaming
  StreamDecl,
  PipelineDecl,

  // server / networking
  ServerDecl,
  RouteDecl,
  SocketDecl,

  // database
  DatabaseDecl,

  // UI
  ComponentDecl,

  // ML
  NeuralDecl,

  // physics
  PhysicsDecl,

  // animation
  AnimateDecl,
};

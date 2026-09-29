'use strict';
/**
 * ThyScript — Programming Language
 * A blazing-fast programming language built on Node.js
 * for machine learning, physics simulation, web, game engines,
 * full-stack applications, and complex algorithms.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const Lexer = require('./lexer/Lexer');
const TokenType = require('./lexer/TokenTypes');
const Parser = require('./parser/Parser');
const AST = require('./parser/AST');
const JITCompiler = require('./compiler/JITCompiler');
const CodeGenerator = require('./compiler/CodeGenerator');
const ThyRuntime = require('./runtime/ThyRuntime');
const ErrorDetector = require('./errors/ErrorDetector');
const ErrorMessages = require('./errors/ErrorMessages');
const MemoryManager = require('./memory/MemoryManager');
const ServerEngine = require('./server/ServerEngine');
const SecurityEngine = require('./server/SecurityEngine');
const HTMLCSSEngine = require('./server/HTMLCSSEngine');
const DatabaseEngine = require('./database/DatabaseEngine');
const TunnelEngine = require('./server/TunnelEngine');
const FeatureHub = require('./v3/FeatureHub');

// Standard library modules
const MathLib = require('./runtime/stdlib/MathLib');
const StringLib = require('./runtime/stdlib/StringLib');
const ArrayLib = require('./runtime/stdlib/ArrayLib');
const FileLib = require('./runtime/stdlib/FileLib');

const VERSION = '3.0.0';

/**
 * Compile ThyScript source code to optimized Node.js JavaScript
 * @param {string} source - ThyScript source code
 * @param {string} [filename='<anonymous>'] - Source file name
 * @param {Object} [options={}] - Compiler options
 * @returns {string} Compiled JavaScript code
 */
function compile(source, filename = '<anonymous>', options = {}) {
  // 1. Lexical analysis
  const lexer = new Lexer(source, filename);
  const tokens = lexer.tokenize();

  // 2. Syntax analysis (Parsing)
  const parser = new Parser(tokens, source, filename);
  const parseResult = parser.parse();
  const ast = parseResult.ast || parseResult;

  // 3. Optional Error & Bug Detection
  if (options.checkErrors !== false) {
    const detector = new ErrorDetector(options);
    const scanResult = detector.scan(tokens, ast, source, filename);
    if (!scanResult.isValid && options.strict) {
      const firstErr = scanResult.errors[0];
      throw new Error(`[ThyScript Compiler Error] ${detector.formatError(firstErr, source)}`);
    }
  }

  // 4. JIT Code Generation
  const compiler = new JITCompiler(ast, source, filename, options);
  return compiler.compile();
}

/**
 * Run a ThyScript file directly (.thy)
 * @param {string} filePath - Path to .thy file
 * @param {Object} [options={}] - Execution options
 * @returns {Promise<any>} Execution result
 */
async function run(filePath, options = {}) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[ThyScript] File not found: ${resolvedPath}`);
  }

  const source = fs.readFileSync(resolvedPath, 'utf8');

  // Initialize runtime
  const runtime = new ThyRuntime(options);
  await runtime.init();

  // Lex & Parse
  const t0 = performance.now();
  const lexer = new Lexer(source, resolvedPath);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens, source, resolvedPath);
  const parseResult = parser.parse();
  const ast = parseResult.ast || parseResult;

  // Compile
  const compiler = new JITCompiler(ast, source, resolvedPath, options);
  const compiledJs = compiler.compile();

  // Execute in sandbox with runtime context
  const context = runtime.buildContext(options.context || {});
  const result = await compiler.execute(compiledJs, context);

  return {
    result,
    stats: compiler.getStats(),
    compiledCode: compiledJs,
    runtime,
  };
}

/**
 * Execute ThyScript source string directly
 * @param {string} source - ThyScript code
 * @param {Object} [options={}] - Execution options
 * @returns {Promise<any>} Execution result
 */
async function runSource(source, options = {}) {
  const runtime = new ThyRuntime(options);
  await runtime.init();

  const lexer = new Lexer(source, options.filename || '<anonymous>');
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens, source, options.filename || '<anonymous>');
  const parseResult = parser.parse();
  const ast = parseResult.ast || parseResult;

  const compiler = new JITCompiler(ast, source, options.filename || '<anonymous>', options);
  const compiledJs = compiler.compile();

  const context = runtime.buildContext(options.context || {});
  const result = await compiler.execute(compiledJs, context);

  return {
    result,
    stats: compiler.getStats(),
    compiledCode: compiledJs,
  };
}

module.exports = {
  VERSION,
  // Core Compiler Pipeline
  Lexer,
  TokenType,
  Parser,
  AST,
  JITCompiler,
  CodeGenerator,
  // Runtime & Engines
  ThyRuntime,
  MemoryManager,
  ServerEngine,
  SecurityEngine,
  HTMLCSSEngine,
  DatabaseEngine,
  TunnelEngine,
  FeatureHub,
  // Error System
  ErrorDetector,
  ErrorMessages,
  // Standard Libraries
  MathLib,
  StringLib,
  ArrayLib,
  FileLib,
  // High-level API
  compile,
  run,
  runSource,
};

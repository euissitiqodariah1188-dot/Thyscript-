#!/usr/bin/env node
'use strict';

/**
 * thy-node - ThyScript direct execution command
 * Usage: thy-node filename.thy
 */

const path = require('path');
const fs = require('fs');

// ─── Bootstrap: ensure chalk & ora are available ────────────────────────────
let chalk, ora;
try {
  chalk = require('chalk');
} catch {
  // Minimal fallback so the binary stays usable before deps are installed
  chalk = {
    cyan: s => s, green: s => s, red: s => s, yellow: s => s,
    blue: s => s, magenta: s => s, white: s => s, gray: s => s,
    bold: { cyan: s => s, red: s => s, green: s => s, yellow: s => s, white: s => s },
    bgRed: { white: s => s }, bgCyan: { black: s => s },
    dim: s => s,
  };
  chalk.bold = new Proxy(chalk, { get: (t, p) => t[p] || (s => s) });
}
try {
  ora = require('ora');
} catch {
  // Minimal fallback spinner
  ora = (opts) => {
    const text = typeof opts === 'object' && opts !== null ? opts.text : opts;
    return {
      text,
      start()   { process.stdout.write(`  ⏳  ${this.text || ''}...\n`); return this; },
      succeed(msg) { process.stdout.write(`  ✅  ${msg || this.text}\n`); return this; },
      fail(msg)    { process.stdout.write(`  ❌  ${msg || this.text}\n`); return this; },
      info(msg)    { process.stdout.write(`  ℹ️   ${msg || this.text}\n`); return this; },
      stop()    { return this; },
    };
  };
}

// ─── ThyScript source modules ────────────────────────────────────────────────
const THYSCRIPT_ROOT = path.resolve(__dirname, '..');
function tryRequire(rel) {
  const full = path.join(THYSCRIPT_ROOT, rel);
  try { return require(full); } catch { return null; }
}

const ThyModule   = tryRequire('src/index.js');
const ErrorDetect = tryRequire('src/errors/ErrorDetector.js');
const MemoryMgr   = tryRequire('src/memory/MemoryManager.js');

// ─── ASCII Banner ────────────────────────────────────────────────────────────
function printBanner() {
  const lines = [
    '',
    '  ████████╗██╗  ██╗██╗   ██╗███████╗ ██████╗██████╗ ██╗██████╗ ████████╗',
    '     ██╔══╝██║  ██║╚██╗ ██╔╝██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝',
    '     ██║   ███████║ ╚████╔╝ ███████╗██║     ██████╔╝██║██████╔╝   ██║   ',
    '     ██║   ██╔══██║  ╚██╔╝  ╚════██║██║     ██╔══██╗██║██╔═══╝    ██║   ',
    '     ██║   ██║  ██║   ██║   ███████║╚██████╗██║  ██║██║██║        ██║   ',
    '     ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝   ',
    '',
  ];

  const tagline = '  ⚡  High-Performance Language Built on Node.js  ⚡';
  const version  = ThyModule ? ThyModule.VERSION : '3.0.0';
  const verLine  = `  v${version}  •  ThyScript Runtime  •  Node.js ${process.version}`;

  console.log(chalk.cyan(lines.join('\n')));
  console.log(chalk.bold.white(tagline));
  console.log(chalk.gray(verLine));
  console.log(chalk.cyan('  ' + '─'.repeat(72)));
  console.log('');
}

// ─── Pretty error renderer ────────────────────────────────────────────────────
function renderError(err, sourceLines, filename) {
  console.log('');
  console.log(chalk.bgRed.white(` ✖  ${err.type || 'Error'} `), chalk.red(err.message));

  if (err.line != null) {
    const lineNo  = err.line;
    const colNo   = err.column || 1;
    const snippet = sourceLines[lineNo - 1] || '';
    const pointer = ' '.repeat(colNo - 1) + '^';

    console.log('');
    console.log(chalk.gray(`  ${filename}:${lineNo}:${colNo}`));
    console.log('');
    console.log(chalk.white(`  ${String(lineNo).padStart(4)} │ `) + snippet);
    console.log(chalk.red  (`       │ ${pointer}`));
  }

  if (err.suggestion) {
    console.log('');
    console.log(chalk.yellow(`  💡  Fix: ${err.suggestion}`));
  }
  if (err.didYouMean) {
    console.log(chalk.blue(`  🔎  Did you mean: ${chalk.bold.white(err.didYouMean)}?`));
  }
  console.log('');
}

// ─── Argument parsing ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2); // strip 'node' + script path
  const opts = { filename: null, flags: {} };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      opts.flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    } else if (!opts.filename) {
      opts.filename = a;
    }
  }
  return opts;
}

// ─── Performance stats renderer ──────────────────────────────────────────────
function printStats({ lexMs, parseMs, compileMs, runMs, memBefore, memAfter }) {
  const totalMs = lexMs + parseMs + compileMs + runMs;
  const memDiff = memAfter - memBefore;

  console.log('');
  console.log(chalk.cyan('  ' + '─'.repeat(72)));
  console.log(chalk.bold.cyan('  📊  Performance Report'));
  console.log(chalk.cyan('  ' + '─'.repeat(72)));

  const row = (label, value, color = chalk.green) =>
    console.log(`  ${chalk.gray(label.padEnd(28))} ${color(value)}`);

  row('Lex time:',      `${lexMs.toFixed(2)} ms`);
  row('Parse time:',    `${parseMs.toFixed(2)} ms`);
  row('Compile time:',  `${compileMs.toFixed(2)} ms`);
  row('Run time:',      `${runMs.toFixed(2)} ms`);
  row('Total time:',    `${totalMs.toFixed(2)} ms`, chalk.bold.green);
  row('Memory delta:',  `${(memDiff / 1024).toFixed(1)} KB`,
      memDiff > 1024 * 1024 ? chalk.yellow : chalk.green);

  console.log(chalk.cyan('  ' + '─'.repeat(72)));
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  const opts = parseArgs(process.argv);

  // ── No filename ──
  if (!opts.filename) {
    console.log(chalk.yellow('  Usage: thy-node <filename.thy> [--no-stats] [--no-banner]'));
    console.log('');
    console.log(chalk.gray('  Options:'));
    console.log(chalk.gray('    --no-stats     Skip performance report'));
    console.log(chalk.gray('    --no-banner    Skip ASCII banner'));
    console.log('');
    process.exit(1);
  }

  // ── Resolve & read file ──
  const filename   = path.resolve(process.cwd(), opts.filename);
  const displayName = path.basename(filename);

  if (!fs.existsSync(filename)) {
    console.log(chalk.red(`  ✖  File not found: ${filename}`));
    console.log(chalk.yellow(`  💡  Fix: Make sure the path is correct.`));
    process.exit(1);
  }

  const ext = path.extname(filename);
  if (ext !== '.thy') {
    console.log(chalk.yellow(`  ⚠️   Warning: Expected a .thy file, got '${ext}'.`));
  }

  let source;
  try {
    source = fs.readFileSync(filename, 'utf8');
  } catch (err) {
    console.log(chalk.red(`  ✖  Cannot read file: ${err.message}`));
    process.exit(1);
  }

  const sourceLines = source.split('\n');

  // ── Memory tracking ──
  const memMgr     = MemoryMgr ? new MemoryMgr() : null;
  const memBefore  = process.memoryUsage().heapUsed;

  // ── Check ThyScript modules loaded ──
  if (!ThyModule) {
    console.log(chalk.yellow('  ⚠️   ThyScript core modules not found. Running in stub mode.'));
    console.log(chalk.gray(`       Install ThyScript properly with: npm install`));
    console.log('');
  }

  // ╔═══════════════╗
  // ║  COMPILATION  ║
  // ╚═══════════════╝
  const compilationSpinner = ora({
    text: chalk.cyan(`Compiling ${displayName}...`),
    color: 'cyan',
  }).start();

  const t0 = Date.now();
  let lexMs = 0, parseMs = 0, compileMs = 0;
  let tokens = [], ast = null, compiled = null;
  let lexer, parser, compiler;

  try {
    // ── Lex ──
    const t1 = Date.now();
    if (ThyModule && ThyModule.Lexer) {
      lexer  = new ThyModule.Lexer(source, filename);
      tokens = lexer.tokenize();
    }
    lexMs = Date.now() - t1;
    compilationSpinner.text = chalk.cyan(`Parsing ${displayName}...`);

    // ── Parse ──
    const t2 = Date.now();
    if (ThyModule && ThyModule.Parser) {
      parser = new ThyModule.Parser(tokens, source, filename);
      ast    = parser.parse();
    }
    parseMs = Date.now() - t2;
    compilationSpinner.text = chalk.cyan(`Compiling to bytecode...`);

    // ── Compile ──
    const t3 = Date.now();
    if (ThyModule && ThyModule.JITCompiler) {
      compiler = new ThyModule.JITCompiler(ast, source, filename);
      compiled = compiler.compile();
    }
    compileMs = Date.now() - t3;

    compilationSpinner.succeed(chalk.green(
      `Compiled ${displayName}  (lex ${lexMs}ms · parse ${parseMs}ms · compile ${compileMs}ms)`,
    ));
  } catch (err) {
    compilationSpinner.fail(chalk.red(`Compilation failed: ${err.message}`));
    renderError(
      { type: err.type || 'CompileError', message: err.message,
        line: err.line, column: err.column, suggestion: err.suggestion },
      sourceLines, displayName,
    );
    process.exit(1);
  }

  // ── Error detection ──
  if (ErrorDetect && (tokens.length || ast)) {
    const detector = new ErrorDetect();
    const { errors, warnings } = detector.scan(tokens, ast, source);

    if (warnings.length) {
      console.log(chalk.yellow(`  ⚠️   ${warnings.length} warning(s):`));
      warnings.forEach(w => console.log(chalk.yellow(`       ${w.code}  ${w.message}`)));
      console.log('');
    }
    if (errors.length) {
      console.log(chalk.red(`  ✖  ${errors.length} error(s) detected:`));
      errors.forEach(e => renderError(e, sourceLines, displayName));
      process.exit(1);
    }
  }

  // ╔═══════════════╗
  // ║   EXECUTION   ║
  // ╚═══════════════╝
  console.log(chalk.cyan('  ' + '─'.repeat(72)));
  console.log(chalk.bold.cyan(`  ▶  Executing ${displayName}`));
  console.log(chalk.cyan('  ' + '─'.repeat(72)));
  console.log('');

  const runSpinner = ora({ text: chalk.cyan('Starting runtime...'), color: 'cyan' }).start();

  const t4 = Date.now();
  let runMs = 0;

  try {
    if (compiler && compiled) {
      runSpinner.stop();
      const runtime = new ThyModule.ThyRuntime({ filename });
      await runtime.init();
      const context = runtime.buildContext();
      await compiler.execute(compiled, context);
    } else if (ThyModule && typeof ThyModule.run === 'function') {
      runSpinner.stop();
      await ThyModule.run(filename);
    } else {
      runSpinner.info(chalk.yellow('No executable runtime available.'));
    }
    runMs = Date.now() - t4;
  } catch (err) {
    runMs = Date.now() - t4;
    if (runSpinner) runSpinner.fail(chalk.red(`Runtime error: ${err.message}`));
    renderError(
      { type: err.type || 'RuntimeError', message: err.message,
        line: err.line, column: err.column, suggestion: err.suggestion },
      sourceLines, displayName,
    );
    process.exit(1);
  }

  // ── Final status ──
  console.log('');
  console.log(chalk.green(`  ✔  ${displayName} finished successfully.`));

  const memAfter = process.memoryUsage().heapUsed;

  if (!opts.flags['no-stats']) {
    printStats({ lexMs, parseMs, compileMs, runMs, memBefore, memAfter });
  }

  if (memMgr) {
    const leak = memMgr.checkLeak();
    if (leak) {
      console.log(chalk.yellow(`  ⚠️   Memory warning: ${leak}`));
    }
  }
}

main().catch(err => {
  console.error(chalk.red(`  ✖  Unexpected error: ${err.message}`));
  if (process.env.THY_DEBUG) console.error(err.stack);
  process.exit(1);
});

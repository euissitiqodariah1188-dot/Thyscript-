'use strict';
const Thy = require('../src/index.js');
const src = `public class(A):\nend()\nconst table a = new A()\nprint(typeof a)\n`;
(async () => {
  try {
    const lexer = new Thy.Lexer(src, '<t>');
    const tokens = lexer.tokenize();
    const parser = new Thy.Parser(tokens, src, '<t>');
    const ast = parser.parse();
    console.log('AST types:', (ast.body||ast.statements||[]).map(s=>s.type).join(','));
    const c2 = new Thy.JITCompiler(ast, src, '<t>', {});
    const compiled = c2.compile();
    const hasClass = compiled.includes('class A') || compiled.includes('class A ');
    console.log('has class A decl:', hasClass);
    const runtime = new Thy.ThyRuntime({});
    await runtime.init();
    const ctx = runtime.buildContext();
    await Promise.race([c2.execute(compiled, ctx), new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT')),3000))]);
    console.log('EXEC OK');
  } catch (e) { console.log('ERR', e.message, e.stack && e.stack.split('\n')[1]); } finally { process.exit(0); }
})();
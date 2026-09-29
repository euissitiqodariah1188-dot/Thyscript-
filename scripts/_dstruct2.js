'use strict';
const Thy = require('../src/index.js');
const src = `const table [a, b] = [1, 2, 3]
print(a)
print(b)
`;
(async () => {
  try {
    const lexer = new Thy.Lexer(src, '<t>');
    const tokens = lexer.tokenize();
    const parser = new Thy.Parser(tokens, src, '<t>');
    const ast = parser.parse();
    const c2 = new Thy.JITCompiler(ast, src, '<t>', {});
    const compiled = c2.compile();
    console.log('COMPILED:\n', compiled.split('\n').filter(l => l.includes('a')||l.includes('[')).slice(0,9).join('\n'));
    const runtime = new Thy.ThyRuntime({});
    await runtime.init();
    const ctx = runtime.buildContext();
    const r = await Promise.race([c2.execute(compiled, ctx), new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT')),3000))]);
    console.log('EXEC OK', r);
  } catch (e) {
    console.log('ERR', e.message);
  } finally { process.exit(0); }
})();
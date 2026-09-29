'use strict';
const Thy = require('../src/index.js');
const src = `class A: end()
const table a = new A()
print(a instanceof A)
`;
(async () => {
  try {
    const lexer = new Thy.Lexer(src, '<t>');
    const tokens = lexer.tokenize();
    const parser = new Thy.Parser(tokens, src, '<t>');
    const ast = parser.parse();
    const c2 = new Thy.JITCompiler(ast, src, '<t>', {});
    const compiled = c2.compile();
    console.log('=== COMPILED ===');
    console.log(compiled);
  } catch (e) { console.log('ERR', e.message); } finally { process.exit(0); }
})();
'use strict';
const t = require('../src/index.js');
const src = `program MyApp {
  start {
    print("HelloFromScaffold")
    let x = 42
    print(x)
  }
}
`;
(async () => {
  try {
    const js = t.compile(src, 't.thy', {});
    const runtime = new t.ThyRuntime({});
    await runtime.init();
    const lexer = new t.Lexer(src, 't.thy');
    const tokens = lexer.tokenize();
    const parser = new t.Parser(tokens, src, 't.thy');
    const ast = parser.parse();
    const c2 = new t.JITCompiler(ast, src, 't.thy', {});
    const compiled = c2.compile();
    const ctx = runtime.buildContext();
    await Promise.race([c2.execute(compiled, ctx), new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), 3000))]);
    console.log('EXEC OK');
  } catch (e) { console.log('ERR', e.message); } finally { process.exit(0); }
})();
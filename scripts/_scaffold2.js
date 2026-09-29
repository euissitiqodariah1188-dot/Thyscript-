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
try {
  const js = t.compile(src, 't.thy', {});
  const body = js.split('// ── program body')[1] || js;
  console.log('BODY HAS print:', body.includes('print("HelloFromScaffold")'));
  console.log('BODY snippet:', body.slice(0, 300));
} catch (e) { console.log('FAIL', e.message); }
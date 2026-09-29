'use strict';
const t = require('../src/index.js');
const src = `program MyApp {
  start {
    print("Hello")
    let x: int = 42
    print(x)
  }
}
`;
try {
  const js = t.compile(src, 't.thy', {});
  console.log('scaffold COMPILES, bytes=', js.length);
} catch (e) {
  console.log('scaffold FAIL:', e.message);
}
const Thy = require('../src/index.js');
const src = `const table a = "Hello"
const table b = "World"
print(\`Template ${'$'}{a}-${'$'}{b}\`)
`;
try {
  const js = Thy.compile(src, 'tpl.thy', {});
  // Find the template literal line
  const lines = js.split('\n');
  lines.forEach((l, i) => { if (l.includes('`')) console.log('LINE', i, JSON.stringify(l)); });
} catch (e) {
  console.log('COMPILE ERR:', e.message);
}
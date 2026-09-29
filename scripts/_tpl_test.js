const L = require('../src/lexer/Lexer');
const src = `const table a = "Hello"
const table b = "World"
print(\`Template ${'$'}{a}-${'$'}{b}\`)
print(\`val=${'$'}{1+2}\`)
`;
const l = new L(src);
const toks = l.tokenize();
console.log(JSON.stringify(toks.filter(t => t.type === 'TEMPLATE_LITERAL'), null, 2));
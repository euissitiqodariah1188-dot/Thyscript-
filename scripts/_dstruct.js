'use strict';
const Thy = require('../src/index.js');
const src = `const table [a, b] = [1, 2, 3]
print(a)
print(b)
`;
console.log('--- lexing ---');
try {
  const lexer = new Thy.Lexer(src, '<t>');
  const tokens = lexer.tokenize();
  console.log('tokens:', tokens.map(t => t.type).join(','));
} catch (e) { console.log('LEX ERRR', e.message); }
console.log('--- parsing ---');
try {
  const lexer = new Thy.Lexer(src, '<t>');
  const tokens = lexer.tokenize();
  const parser = new Thy.Parser(tokens, src, '<t>');
  const ast = parser.parse();
  console.log('parsed OK');
} catch (e) { console.log('PARSE ERR', e.message); }
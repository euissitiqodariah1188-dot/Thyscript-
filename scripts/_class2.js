'use strict';
const Thy = require('../src/index.js');
const src = `class A\nend()\nconst table a = new A()\n`;
try {
  const lexer = new Thy.Lexer(src, '<t>');
  const tokens = lexer.tokenize();
  console.log('tokens:', tokens.map(t=>t.type).join(','));
  const parser = new Thy.Parser(tokens, src, '<t>');
  const ast = parser.parse();
  console.log('AST types:', (ast.body||ast.statements||[]).map(s=>s.type).join(','));
} catch(e){ console.log('ERR', e.message); }
const fs = require('fs');
let code = fs.readFileSync('src/compiler/CodeGenerator.js', 'utf8');

// Find the old block by index
const marker = 'if (!isStatic && classProps.length > 0) {';
const markerIdx = code.indexOf(marker);
if (markerIdx === -1) {
  console.error('Marker not found!');
  process.exit(1);
}

// Find end of the whole _genMethod closing brace after marker
const blockEnd = code.indexOf('\n  }\n\n  // ─── HTML class', markerIdx);
if (blockEnd === -1) {
  console.error('End marker not found!');
  process.exit(1);
}

const before = code.slice(0, markerIdx);
const after = code.slice(blockEnd); // includes '\n  }\n\n  // ─── HTML class...'

const newBlock = `if (!isStatic && classProps.length > 0) {
      // Destructure class props as mutable lets (allows += inside methods)
      this._emit('let { ' + classProps.join(', ') + ' } = this;');
      this._genBlockOrList(method.body);
      // Write any mutations back to the instance
      this._emit('Object.assign(this, { ' + classProps.join(', ') + ' });');
    } else {
      this._genBlockOrList(method.body);
    }
    this._pop();
    this._emit('}');
  }`;

const newCode = before + newBlock + after;
fs.writeFileSync('src/compiler/CodeGenerator.js', newCode);

// Verify
const verify = fs.readFileSync('src/compiler/CodeGenerator.js', 'utf8');
if (verify.includes('Destructure class props as mutable lets')) {
  console.log('SUCCESS: _genMethod patched correctly!');
} else {
  console.error('FAIL: patch not applied');
}

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

console.log('🧪 Starting ThyScript v3.0 Test Suite...\n');

const tests = [
  'tests/test1_math.thy',
  'tests/test2_oop.thy',
  'tests/test4_functions.thy',
  'tests/test_v3_features.thy',
];

let allPassed = true;

for (const t of tests) {
  process.stdout.write(`▶ Running ${t}... `);
  const result = spawnSync('node', ['bin/thy-node.js', t, '--no-banner', '--no-stats'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });

  if (result.status === 0) {
    console.log('✅ PASSED');
  } else {
    console.log('❌ FAILED');
    console.error(result.stdout);
    console.error(result.stderr);
    allPassed = false;
  }
}

console.log('\n────────────────────────────────────────────');
if (allPassed) {
  console.log('🎉 ALL THYSCRIPT CORE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('💥 SOME TESTS FAILED.');
  process.exit(1);
}

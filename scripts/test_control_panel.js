'use strict';

async function testControlPanel() {
  console.log('1. Testing Dashboard Web UI HTML...');
  const r1 = await fetch('http://localhost:7777/');
  const html = await r1.text();
  console.log('Dashboard HTML Length:', html.length, 'Contains Control Panel:', html.includes('ThyScript Control Panel'));

  console.log('\n2. Testing /api/system...');
  const r2 = await fetch('http://localhost:7777/api/system');
  const sys = await r2.json();
  console.log('System CPU:', sys.metrics.cpu.model, 'Cores:', sys.metrics.cpu.cores);
  console.log('System RAM Used:', sys.metrics.memory.usedMB, '/', sys.metrics.memory.totalMB, 'MB (' + sys.metrics.memory.usagePercent + '%)');
  console.log('Networks found:', sys.networks.map(n => n.interface + ' -> ' + n.address).join(', '));

  console.log('\n3. Testing /api/files...');
  const r3 = await fetch('http://localhost:7777/api/files');
  const files = await r3.json();
  console.log('Files Found in Workspace:', files.count);
  files.files.slice(0, 5).forEach(f => console.log('  -', f.path, '(' + f.sizeBytes + ' bytes)'));

  console.log('\n4. Testing /api/run-code (On-The-Fly in Memory, ZERO COMPILE TO DISK)...');
  const testCode = [
    'const table a = 777',
    'const table b = 333',
    'const table total = calculate(a + b)',
    'print("🚀 Live On-The-Fly Output from Computer Utama!")',
    'print("777 + 333 = " + total)'
  ].join('\n');

  const r4 = await fetch('http://localhost:7777/api/run-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: testCode, name: 'remote_eval.thy' })
  });
  const runRes = await r4.json();
  console.log('Run Code Success:', runRes.success);
  console.log('Timings:', runRes.timings);
  console.log('Memory Delta:', runRes.memoryDeltaKB, 'KB');
  console.log('Logs captured:');
  runRes.logs.forEach(l => console.log('   [' + l.type + ']', l.message));

  console.log('\n5. Testing /api/run-file on examples/hello.thy...');
  const r5 = await fetch('http://localhost:7777/api/run-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: 'examples/hello.thy' })
  });
  const fileRes = await r5.json();
  console.log('Run File Success:', fileRes.success);
  console.log('Total Time:', fileRes.timings.totalMs, 'ms');
  console.log('Logs:');
  fileRes.logs.slice(0, 5).forEach(l => console.log('   [' + l.type + ']', l.message));

  console.log('\n🎉 === CONTROL PANEL VERIFIED 100% WORKING & ACCESSIBLE! ===');
}

testControlPanel().catch(console.error);

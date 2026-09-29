'use strict';
/**
 * Smoke test harness - exercises many ThyScript language features
 * to uncover crashes, undefined behavior, and anomalies.
 */
const Thy = require('../src/index.js');

const cases = {
  'basic-assign': `
const table x = 10
print(x)
const table y = x + 5 * 2
print(y)
`,
  'string-concat': `
const table a = "Hello"
const table b = "World"
print(a + " " + b)
print(\`Template ${'$'}{a}-${'$'}{b}\`)
`,
  'if-elif-else': `
const table v = 42
if(v < 10):
  print("small")
elif(v < 50):
  print("medium")
else:
  print("large")
end()
`,
  'while-loop': `
const table i = 0
const table s = 0
while(i < 10):
  add i in s
  add 1 in i
end()
print(s)
`,
  'for-loop': `
const table arr = [1, 2, 3, 4]
const table out = 0
for item in arr:
  add item in out
end()
print(out)
`,
  'functions': `
func square(x):
  return calculate(x * x)
end()
print(square(5))
`,
  'object-literal': `
const table obj = {name: "Budi", age: 25}
print(obj.name)
print(obj["name"])
`,
  'prime-check': `
func isPrime(n):
  if(n <= 1):
    return false
  end()
  const table i = 2
  while(i * i <= n):
    if(n % i == 0):
      return false
    end()
    add 1 in i
  end()
  return true
end()
print(isPrime(7))
print(isPrime(10))
`,
  'switch': `
const table day = 2
switch(day):
  case 1:
    print("Monday")
  case 2:
    print("Tuesday")
  default:
    print("Other")
end()
`,
  'try-catch': `
try:
  const table z = 10 / 0
  print("no error")
except e:
  print("caught: " + e)
end()
`,
  'ternary': `
const table age = 17
print(age >= 18 ? "adult" : "minor")
`,
  'string-methods': `
const table s = "  Hello World  "
print(string.trim(s).length)
print(string.upper(s))
`,
  'array-methods': `
const table nums = [3, 1, 2]
print(array.sort(nums).join(","))
`,
  'nested-loop': `
const table total = 0
const table i = 0
while(i < 3):
  const table j = 0
  while(j < 3):
    add (i * j) in total
    add 1 in j
  end()
  add 1 in i
end()
print(total)
`,
  'class-basic': `
public class Animal:
  public name = "unknown"
  public func speak():
    return "..." + this.name
  end()
  public func setName(n):
    change(this.name to(n))
  end()
end()
const table a = new Animal()
a.setName("Kucing")
print(a.speak())
`,
};

async function main() {
  let pass = 0, fail = 0;
  for (const [name, src] of Object.entries(cases)) {
    try {
      // Compile
      const js = Thy.compile(src, `<${name}>`, {});
      // Execute
      const runtime = new Thy.ThyRuntime({ enableClustering: false });
      await runtime.init();
      const context = runtime.buildContext();
      const compiler = new Thy.JITCompiler(Thy.astFromSource ? null : null, src);
      // Recompile via runSource-like path
      const lexer = new Thy.Lexer(src, `<${name}>`);
      const tokens = lexer.tokenize();
      const parser = new Thy.Parser(tokens, src, `<${name}>`);
      const ast = parser.parse();
      const c2 = new Thy.JITCompiler(ast, src, `<${name}>`, {});
      const compiled = c2.compile();
      await c2.execute(compiled, context);
      console.log(`PASS  ${name}`);
      pass++;
    } catch (e) {
      console.log(`FAIL  ${name}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n=== Smoke: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
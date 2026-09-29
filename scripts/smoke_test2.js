'use strict';
const Thy = require('../src/index.js');

const cases = {
  'class-inheritance': `
public class Animal:
  public name = "?"
  public func speak():
    return "sound"
  end()
  public func setName(n):
    change(this.name to(n))
  end()
end()
public class Dog extends Animal:
  public func speak():
    return "Woof"
  end()
end()
const table d = new Dog()
d.setName("Rex")
print(d.name)
print(d.speak())
`,
  'class-inheritance-super': `
public class Base:
  public value = 10
  public func get():
    return this.value
  end()
end()
public class Child extends Base:
  public func get():
    return this.value * 2
  end()
end()
const table c = new Child()
print(c.get())
`,
  'async-func': `
async func fetchVal():
  return 42
end()
print(fetchVal())
`,
  'destructure-array': `
const table [a, b] = [1, 2, 3]
print(a)
print(b)
`,
  'destructure-object': `
const table {x, y} = {x: 5, y: 7}
print(x)
print(y)
`,
  'spread': `
const table a = [1, 2]
const table b = [...a, 3, 4]
print(b.length)
print(b.join(','))
`,
  'nested-object-access': `
const table user = {profile: {name: "Budi", address: {city: "Jakarta"}}}
print(user.profile.address.city)
print(user.profile["name"])
`,
  'js-array-methods': `
const table nums = [5, 3, 8, 1]
print(nums.sort((a,b) => a-b).join(','))
print(nums.map(x => x * 2).join(','))
print(nums.filter(x => x > 3).join(','))
`,
  'string-template-nested': `
const table name = "World"
const table greeting = \`Hello ${'$'}{name}, sum=${'$'}{1+2}\`
print(greeting)
`,
  'modulo-power': `
print(calculate(5 ** 2))
print(calculate(10 % 3))
print(calculate(2 ** 3 ** 2))
`,
  'object-in-array': `
const table items = [{id: 1, name: "A"}, {id: 2, name: "B"}]
print(items.length)
print(items[1].name)
`,
  'whilenested-if': `
const table out = 0
const table i = 0
while(i < 10):
  if(i % 2 == 0):
    add i in out
  end()
  add 1 in i
end()
print(out)
`,
  'null-coalesce': `
const table a = null
const table b = a ?? "default"
print(b)
`,
  'typeof-instanceof': `
const table x = 5
print(typeof x)
public class(A):
end()
const table a = new A()
print(a instanceof A)
`,
  'string-escape': `
print("line1\\nline2")
print("tab\\there")
print("quote\\" and \\'")
`,
};

async function main() {
  let pass = 0, fail = 0;
  // Prevent compiled programs' .catch(process.exit) from killing the harness
  const origExit = process.exit;
  process.exit = () => { throw new Error('process.exit called by user program'); };
  try {
    for (const [name, src] of Object.entries(cases)) {
      try {
        const runtime = new Thy.ThyRuntime({ enableClustering: false });
        await runtime.init();
        const lexer = new Thy.Lexer(src, `<${name}>`);
        const tokens = lexer.tokenize();
        const parser = new Thy.Parser(tokens, src, `<${name}>`);
        const ast = parser.parse();
        const c2 = new Thy.JITCompiler(ast, src, `<${name}>`, {});
        const compiled = c2.compile();
        const context = runtime.buildContext();
        await c2.execute(compiled, context);
        console.log(`PASS  ${name}`);
        pass++;
      } catch (e) {
        console.log(`FAIL  ${name}: ${e.message}`);
        fail++;
      }
    }
  } finally {
    process.exit = origExit;
  }
  console.log(`\n=== Extended Smoke: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
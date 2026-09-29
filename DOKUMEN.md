# 📖 ThyScript v3.0 Language Reference & Documentation

Welcome to the official **ThyScript v3.0 Language Specification & Technical Documentation**.

---

## 📑 Table of Contents

1. [Introduction & Architecture](#1-introduction--architecture)
2. [Lexical Structure & Types](#2-lexical-structure--types)
3. [Complete Keyword Dictionary](#3-complete-keyword-dictionary)
   - [3.1 Variables & Assignment](#31-variables--assignment)
   - [3.2 Control Flow](#32-control-flow)
   - [3.3 Object-Oriented Programming](#33-object-oriented-programming)
   - [3.4 State Mutations & Persistence](#34-state-mutations--persistence)
   - [3.5 Numeric & Fast Math JIT](#35-numeric--fast-math-jit)
   - [3.6 Functions & Asynchronous Programming](#36-functions--asynchronous-programming)
   - [3.7 Module & npm Package Management](#37-module--npm-package-management)
   - [3.8 Web Server, Routing & HTTP](#38-web-server-routing--http)
   - [3.9 External & Inline HTML](#39-external--inline-html)
   - [3.10 Component System](#310-component-system)
   - [3.11 Machine Learning & Neural Networks](#311-machine-learning--neural-networks)
   - [3.12 Physics Simulation Engine](#312-physics-simulation-engine)
   - [3.13 Concurrency & Multi-Processing](#313-concurrency--multi-processing)
   - [3.14 Database Engine](#314-database-engine)
   - [3.15 Error Handling](#315-error-handling)
4. [Standard Library (Built-ins)](#4-standard-library-built-ins)
5. [ThyScript Control Panel & Remote Execution](#5-thyscript-control-panel--remote-execution)

---

## 1. Introduction & Architecture

ThyScript is a compiled, high-performance programming language hosted on top of Node.js and the Google V8 engine.

```
┌────────────────────────────────────────────────────────┐
│                   ThyScript Source (.thy)              │
└───────────────────────────┬────────────────────────────┘
                            │
                     ┌──────▼──────┐
                     │    Lexer    │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │   Parser    │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ Error Guard │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ JITCompiler │
                     └──────┬──────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
   ┌────────▼────────┐             ┌────────▼────────┐
   │ Memory JIT VM   │             │   Disk Build    │
   │ (Zero Compile)  │             │   (.thy.js)     │
   └─────────────────┘             └─────────────────┘
```

---

## 2. Lexical Structure & Types

### 2.1 Basic Types
- `Number`: 64-bit IEEE 754 float or 32-bit signed integer.
- `String`: UTF-8 string enclosed in single (`'...'`) or double (`"..."`) quotes.
- `Boolean`: `true` or `false`.
- `Null`: `null` (representing absence of a value).
- `Array`: Ordered collection `[1, 2, 3]`.
- `Object`: Key-value map `{ key: "value" }`.

### 2.2 Comments
```thy
// Single-line comment
/*
   Multi-line comment block
*/
```

---

## 3. Complete Keyword Dictionary

### 3.1 Variables & Assignment

#### `const table`
Declares a mutable or immutable variable with scoped block visibility.
```thy
const table maxRetries = 5
const table username = "Alice"
```

#### `table`
Shorthand variable declaration.
```thy
table counter = 0
```

#### `become`
Type coercion / casting statement.
```thy
const table strNum = "42"
const table num = become(strNum to number)
```

---

### 3.2 Control Flow

#### `if`, `elif`, `else`, `end()`
Conditional statement blocks terminated by `end()`.
```thy
if(score >= 90):
    print("Grade: A")
elif(score >= 80):
    print("Grade: B")
else:
    print("Grade: C")
end()
```

#### `while`, `end()`
Executes code repeatedly while condition evaluates to true.
```thy
const table count = 0
while(count < 5):
    print("Count: " + count)
    add 1 in count
end()
```

#### `for`, `in`, `end()`
Iterates over an array, string, or range.
```thy
const table fruits = ["Apple", "Banana", "Cherry"]
for item in fruits:
    print("Fruit: " + item)
end()
```

#### `switch`, `case`, `default`, `end()`
Multi-way branching statement.
```thy
switch(command):
    case "start":
        print("Starting engine...")
        break
    case "stop":
        print("Stopping engine...")
        break
    default:
        print("Unknown command")
end()
```

#### `match`, `when`, `end()`
Pattern matching expression.
```thy
match status:
    when 200: "OK"
    when 404: "Not Found"
    when 500: "Server Error"
end()
```

---

### 3.3 Object-Oriented Programming

#### `public class(Name): ... end()`
Declares a class with public visibility. Methods and properties are bound to instance scope.
```thy
public class(Account):
    const table owner = "Unknown"
    const table balance = 0

    func deposit(amount):
        add amount in balance
        print(owner + " deposited $" + amount + ". New balance: $" + balance)
    end()
end()
```

#### `private`, `protected`
Access modifier specifiers for class members.
```thy
public class(Vault):
    private secretKey = "top-secret"
end()
```

#### `new`
Instantiates a class.
```thy
const table acc = new Account()
change(acc.owner to("Dede"))
acc.deposit(500)
```

---

### 3.4 State Mutations & Persistence

#### `add <value> in <target>`
Universal mutation operator:
- For numbers: Increments target by value (`target += value`).
- For arrays/lists: Appends value to array (`target.push(value)`).
```thy
// Numeric addition
const table total = 100
add 25 in total  // total is now 125

// Array insertion
const table list = ["a", "b"]
add "c" in list  // list is now ["a", "b", "c"]
```

#### `change(<target> to(<value>))`
Mutates an existing variable or object property.
```thy
const table player = { name: "Bob", level: 1 }
change(player.level to(2))
```

#### `save(<variable>)`
Serializes and persists variable state to a `.thysave` JSON file on disk.
```thy
save(playerState)
```

#### `free()`
Hints the V8 Garbage Collector to free references and clean heap memory.
```thy
free(largeDataset)
```

---

### 3.5 Numeric & Fast Math JIT

#### `calculate(<expr>)`
Forces high-speed math expression evaluation using typed arrays and V8 TurboFan compilation.
```thy
const table radius = 7
const table area = calculate(Math.PI * (radius ** 2))
print("Circle area: " + area)
```

---

### 3.6 Functions & Asynchronous Programming

#### `func <name>(<params>): ... end()`
Declares a callable function.
```thy
func multiply(x, y):
    return calculate(x * y)
end()
```

#### `async func`, `await`
Asynchronous routines backed by Node.js Promises.
```thy
async func fetchUserData(id):
    const table response = await fetch("https://api.example.com/user/" + id)
    return await response.json()
end()
```

#### Arrow Functions
Inline lambda functions with implicit return.
```thy
const table numbers = [1, 2, 3, 4]
const table doubled = numbers.map((n) => n * 2)
```

---

### 3.7 Module & npm Package Management

#### `import "<npm-package>"`
Directly imports and binds an npm package.
```thy
import "chalk"
import "axios"

print(chalk.blue("HTTP request ready"))
```

#### `import "<npm-package>" as <alias>`
Imports an npm package under a custom variable name.
```thy
import "lodash" as _
```

#### `import <name> from "<module>"`
ES-style default import.
```thy
import express from "express"
```

#### `import { <item> } from "<module>"`
Named imports from local files or npm packages.
```thy
import { readFileSync, writeFileSync } from "fs"
```

#### `export`
Exports functions, classes, or values from the current file.
```thy
export func add(a, b):
    return a + b
end()
```

---

### 3.8 Web Server, Routing & HTTP

#### `server(<port>): ... end()`
Initializes an HTTP/Express web server automatically binding to `0.0.0.0` with CORS, JSON body-parsing, and URL-encoding enabled.
```thy
server(8080):
    print("Server online on port 8080")
end()
```

#### `route get`, `route post`, `route put`, `route delete`, `route patch`
Defines HTTP endpoint route handlers. Inside the block, `req` / `request` and `res` / `response` are pre-injected.
```thy
route get "/api/health":
    res.json({ status: "healthy", timestamp: Date.now() })
end()

route post "/api/submit":
    const table payload = req.body
    res.json({ success: true, received: payload })
end()
```

#### `socket on "<event>": ... end()`
WebSocket event listener for bidirectional real-time communications.
```thy
socket on "chat-message":
    socket.broadcast.emit("chat-message", req.data)
end()
```

---

### 3.9 External & Inline HTML

#### `classHtml(<Name>) from "<file.html>"`
Serves an external HTML file at route `/<Name>`.
```thy
classHtml(Home) from "public/index.html"
```

#### `res.renderHtml("<path.html>", <context>)`
Renders an external HTML file with dynamic Mustache-style `{{key}}` parameter substitution.
```thy
route get "/profile":
    res.renderHtml("views/profile.html", {
        username: "Dede",
        role: "Lead Engineer"
    })
end()
```

#### `classHtml(<Name>): ... end()`
Inline HTML component serving directly from ThyScript.
```thy
classHtml(StatusPage):
    <!DOCTYPE html>
    <html>
        <body><h1>ThyScript Live Status</h1></body>
    </html>
end()
```

---

### 3.10 Component System

#### `component <Name>(<props>): ... end()`
Declares a reactive web component with managed state.
```thy
component UserBadge(name, role):
    state active = true
    render:
        print("<div class='badge'>" + name + " (" + role + ")</div>")
end()
```

---

### 3.11 Machine Learning & Neural Networks

#### `neural <Name>: ... end()`
Declares a neural network architecture powered by TensorFlow.js.
```thy
neural Classifier:
    optimizer "adam"
    loss "categoricalCrossentropy"
    layer dense(64, activation: "relu")
    layer dense(10, activation: "softmax")
end()
```

---

### 3.12 Physics Simulation Engine

#### `physics <Name>: ... end()`
Configures a 2D Matter.js physics simulation environment.
```thy
physics SandboxWorld:
    gravity(0, 9.8)
    body box(x: 100, y: 100, w: 50, h: 50, density: 1.0)
    body ground(x: 0, y: 600, w: 800, h: 50, static: true)
end()
```

---

### 3.13 Concurrency & Multi-Processing

#### `parallel: ... end()`
Executes code asynchronously across worker threads utilizing all available CPU cores.
```thy
parallel:
    print("Running in worker thread ID: " + threadId)
end()
```

#### `stream <Name>: ... end()`
Creates high-throughput data processing pipelines.
```thy
stream FilePipeline:
    pipe gzip()
    pipe write("output.tar.gz")
end()
```

---

### 3.14 Database Engine

#### `database connect: ... end()`
Connects to SQL (Postgres, MySQL, SQLite) or NoSQL (MongoDB, Redis) databases.
```thy
database connect:
    driver "sqlite"
    database "./app.db"
end()
```

---

### 3.15 Error Handling

#### `try`, `catch(<err>)`, `finally`, `end()`
Structured exception handling block.
```thy
try:
    const table data = JSON.parse(invalidString)
catch(err):
    print("Caught error: " + err.message)
finally:
    print("Cleanup complete")
end()
```

#### `throw`
Raises an exception.
```thy
if(divisor == 0):
    throw "Division by zero is not allowed"
end()
```

---

## 4. Standard Library (Built-ins)

All compiled ThyScript files automatically receive the `__thy_stdlib` namespace and top-level helper functions:

| Module | Methods |
|--------|---------|
| `math` | `abs`, `sqrt`, `pow`, `floor`, `ceil`, `round`, `sin`, `cos`, `tan`, `log`, `min`, `max`, `clamp`, `lerp`, `hypot`, `random` |
| `str` | `upper`, `lower`, `trim`, `split`, `replace`, `includes`, `startsWith`, `endsWith`, `reverse`, `slice`, `pad` |
| `arr` | `map`, `filter`, `reduce`, `find`, `sort`, `reverse`, `chunk`, `unique`, `sum`, `avg`, `range` |
| `file` | `read`, `write`, `append`, `exists`, `mkdir`, `readJSON`, `writeJSON`, `readLines` |
| `io` | `print`, `printErr`, `write`, `read`, `cwd`, `home` |
| `security` | `hash`, `hmac`, `random`, `uuid`, `encrypt`, `decrypt`, `base64encode`, `base64decode` |
| `server` | Native Express + fallback HTTP engine, CORS, WebSocket, SSE |
| `database` | Unified query builder for MySQL, PostgreSQL, SQLite, MongoDB, Redis |

---

## 5. ThyScript Control Panel & Remote Execution

The Control Panel provides a browser-based, zero-compile execution environment:

1. **Start the Panel**:
   ```bash
   thy panel --port 7777
   ```
2. **Access Remotely**:
   - Local: `http://localhost:7777`
   - LAN / WiFi: `http://<YOUR_LAN_IP>:7777` (e.g. `http://192.168.1.7:7777`)
3. **Features**:
   - Write and test ThyScript code in real-time.
   - Run code on-the-fly in host memory without creating files on disk.
   - Monitor host CPU, RAM, and process heap live.
   - Browse and edit project workspace files.

---

*ThyScript Language Specification — Version 3.0.0 — Licensed under MIT.*

---

## 6. ThyScript v3 — Public Internet Hosting, npm & Feature Hub

### 6.1 Expose Any Server to the Public Internet
Give your main computer a real, globally-accessible URL with zero router setup:

```bash
# 1. Start a local server (or Control Panel)
thy serve app.thy --port 3000

# 2. In a second terminal, publish it publicly:
thy tunnel --port 3000
# → https://xxxx.loca.lt    (open from ANY device on the internet)

# One-shot:
thy serve app.thy --public
thy panel --public --token mysecret
```

The `thy tunnel` command installs `localtunnel` automatically if needed, performs a connectivity check, and prints the public URL. Keep the terminal open to keep the tunnel alive.

### 6.2 Use Every npm Library
- `thy install <pkg> [pkg...]` — install any npm package.
- The web Control Panel has an *Install Any npm Library* box backed by the `/api/install` endpoint.
- Import any package:
  ```thy
  import "chalk"
  import "lodash" as _
  import axios from "axios"
  import { readFileSync } from "fs"
  ```

### 6.3 Built-in Feature Hub (`v3.*`)
All runtimes expose a `v3` namespace of **100+ helper functions** across data, text, time, crypto, system, network and numbers. Run `thy features` for the full catalog.

| Group | Examples |
|-------|----------|
| `v3.data.*` | `deepClone`, `chunk`, `groupBy`, `uniqBy`, `toCSV`, `zip`, `shuffle` |
| `v3.text.*` | `slugify`, `camelCase`, `pascalCase`, `snakeCase`, `truncate`, `mask` |
| `v3.time.*` | `timeAgo`, `formatDate`, `humanElapsed`, `parseDuration`, `stopwatch` |
| `v3.crypto.*` | `sha256`, `md5`, `encryptAES`, `decryptAES`, `totp`, `uuid`, `base64Encode` |
| `v3.system.*` | `systemInfo`, `memMB`, `env`, `execShell`, `isPortFree`, `cwd` |
| `v3.net.*` | `localIP`, `ipv4`, `macAddresses`, `isEmail`, `isURL`, `parseURL` |
| `v3.http.*` | `statusText`, `parseQuery`, `parseCookies`, `mimeOf` |
| `v3.num.*` | `clamp`, `lerp`, `gcd`, `lcm`, `isPrime`, `factorial`, `formatBytes` |

Example:
```thy
const table token = v3.randomHex(16)
const table enc   = v3.encryptAES("hello", "secret")
print(v3.decryptAES(enc, "secret"))        // "hello"
print(v3.slugify("Hello ThyScript!"))      // "hello-thyscript"
```

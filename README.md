# ⚡ ThyScript v3.0.0

> **A blazing-fast, next-generation programming language built on Node.js.**  
> Turbocharge your main computer into a **public internet server**, use **any npm library**, and unlock **hundreds of built-in helper features** — all without breaking a thing.

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://www.npmjs.com/package/thyscript)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

---

## 🌟 Why ThyScript?

- ⚡ **12x Faster Math & Numeric Operations**: Built-in JIT compilation with TypedArrays (`Float64Array`, `Int32Array`) and V8 TurboFan inline cache triggers.
- 📦 **Seamless npm Library Integration**: Import any npm library directly with `import "library_name"` or `import lib from "library_name"`.
- 🌐 **First-Class Web & Full-Stack Servers**: Built-in Express and native HTTP servers via `server(port): ... end()` and `route get "/": ... end()`. No boilerplate needed!
- 🎨 **External & Inline HTML**: Serve external HTML templates with `classHtml(Page) from "public/home.html"` or use `res.renderHtml("page.html", data)` with dynamic interpolation.
- 🖥️ **Live Web Control Panel**: Turn your host computer into a remote ThyScript server with `thy panel`. Run scripts in memory with **zero compilation to disk**, accessible from any device on your local WiFi/LAN network.
- 🛡️ **Built-in Security & Database Engines**: Native JWT, bcrypt/scrypt hashing, AES-256 encryption, XSS sanitization, SQLi detection, and multi-database support (MySQL, PostgreSQL, MongoDB, Redis, SQLite).

---

## 📦 Installation

Install globally via npm:

```bash
npm install -g thyscript
```

Or install locally in your project:

```bash
npm install thyscript
```

Once installed, you have access to three universal CLI commands:
- `thy` — Universal CLI tool
- `thys` — Control Panel and server launcher
- `thy-node` — High-speed direct script runner with ASCII dashboard

---

## 🚀 Quick Start

### 1. Create a script (`hello.thy`)

```thy
// hello.thy - Welcome to ThyScript v2
import "chalk"

const table name = "ThyScript v2"
print(chalk.cyan("⚡ Hello from " + name + "!"))

// Fast numeric calculation
const table result = calculate((100 + 37) * 2 - 10)
print("Calculation result: " + result)

// OOP Class Example
public class(Player):
    const table username = "Guest"
    const table score = 0

    func levelUp(pts):
        add pts in score
        print(username + " earned " + pts + " points! Total: " + score)
    end()
end()

const table p1 = new Player()
change(p1.username to("Alice"))
p1.levelUp(100)
p1.levelUp(50)
```

### 2. Run the script

```bash
thy run hello.thy
# or directly:
thy-node hello.thy
```

---

## 🌐 Web Server & REST API Example

ThyScript makes backend web development effortless:

```thy
// server.thy
import "chalk"

// External HTML page for the home route
classHtml(Home) from "public/home.html"

// Start server on port 5000 (accessible across LAN on 0.0.0.0)
server(5000):
    print(chalk.green("🚀 Server running on port 5000"))
end()

const table items = []

// REST Endpoints
route get "/api/items":
    res.json({ success: true, count: items.length, items: items })
end()

route post "/api/items":
    const table newItem = {
        id: items.length + 1,
        name: req.body.name || "Untitled Item",
        createdAt: Date.now()
    }
    add newItem in items
    res.json({ success: true, item: newItem })
end()

// Dynamic external HTML rendering with template interpolation
route get "/dashboard":
    res.renderHtml("public/home.html", {
        title: "ThyScript Live Dashboard",
        user: "Admin"
    })
end()
```

Run the server:

```bash
thy serve server.thy --port 5000
```

---

## 🖥️ ThyScript Control Panel (Remote Server)

Transform your main PC/laptop into a live, remote-accessible ThyScript server without writing a single line of server setup:

```bash
thy panel --port 7777
# or
thys panel
```

### Features:
- **Zero-Compile In-Memory Runner**: Write ThyScript code in the web browser and click **RUN** — it executes instantly in host memory without creating `.js` files on disk.
- **Remote Network Access**: Automatically detects your WiFi/LAN IP addresses (`http://192.168.1.x:7777`) so you can access the IDE from your smartphone, tablet, or secondary laptop.
- **Live Hardware Monitor**: Real-time CPU usage, RAM utilization, V8 Heap metrics, and network adapters.
- **File Explorer**: Browse, view, edit, and save `.thy` files directly on the host computer.
- **Terminal Logs**: Bidirectional live console output capturing stdout, stderr, execution timers, and memory deltas.

---

## 🎉 What's New in v3.0.0

### 1. 🌍 Make Your Computer a PUBLIC Internet Server
Turn any running local server into a **worldwide-accessible URL** with a single command — no router port-forwarding, no API key.

```bash
# Start a normal local server:
thy serve app.thy --port 3000

# Expose it to the public internet (get a https://xxxx.loca.lt URL):
thy tunnel --port 3000

# Or combine both in one shot:
thy serve app.thy --public
```

You can also expose the full **Web Control Panel** publicly:
```bash
thy panel --public --token mysecret
```
The printed `https://<sub>.loca.lt` URL is reachable from **any phone/PC on the entire internet**, instantly.

### 2. 📦 Use ALL npm Libraries
Import any package from the npm ecosystem with zero friction:

```bash
# Install anything, then use it:
thy install axios lodash dayjs express
```
```thy
import axios from "axios"
import "lodash" as _
import { readFileSync } from "fs"

print(_.chunk([1,2,3,4], 2))
```
The browser Control Panel also has an **"Install Any npm Library"** box where you can type a package name and use `import "name"` immediately.

### 3. 💎 Hundreds of Built-in Helper Features
Every ThyScript runtime now ships a `v3` namespace with **100+ unique, zero-setup utilities**:
```thy
print(v3.slugify("Hello World!"))        // "hello-world"
print(v3.decryptAES(v3.encryptAES("secret","key"),"key"))  // "secret"
print(v3.localIP())                      // your LAN IP
print(v3.formatBytes(1536000))           // "1.46 MB"
```
Browse them all with:
```bash
thy features          # list every v3 helper
thy features --json   # machine-readable catalog
```

---

## 📦 What's New in v2.0.0

1. **Direct npm Library Imports**:
   ```thy
   import "chalk"
   import "lodash" as _
   import "axios"
   import express from "express"
   import { readFileSync } from "fs"
   ```
2. **External HTML Support**:
   - `classHtml(Name) from "path/to/file.html"`
   - `classHtml(Name): "path/to/file.html" end()`
   - `res.renderHtml("file.html", { key: "value" })` with Mustache-style `{{key}}` interpolation
   - `res.sendFile("file.html")`
3. **Automatic Server Initialization**:
   - `ServerEngine` and `server(port):` automatically initialize routing, CORS, JSON body-parsing, and URL-encoding. No manual `create()` call required!
4. **Enhanced Network CLI (`thy serve`)**:
   - Automatically binds to `0.0.0.0` with multi-interface discovery for effortless LAN testing across devices.

---

## 📖 CLI Commands

| Command | Description |
|---------|-------------|
| `thy run <file.thy>` | Compile and run a ThyScript file with performance stats |
| `thy serve <file.thy>` | Run a ThyScript file as a live HTTP web server (with LAN access) |
| `thy panel` / `thys` | Launch the Web Control Panel & Remote Execution Server |
| `thy compile <file.thy>` | Compile a `.thy` file to standard Node.js JavaScript (`.js`) |
| `thy check --fix` | Check project dependencies and install missing packages |
| `thy use <package>` | Install an npm package and configure it for your ThyScript project |
| `thy new <project>` | Scaffold a new ThyScript project with standard directories |
| `thy repl` | Start an interactive ThyScript REPL session |
| `thy test` | Run project test suites |
| `thy build` | Production build with code optimization |
| `thy install <pkg>` | Install any npm library for `import "<pkg>"` |
| `thy tunnel --port <p>` | Expose a running server to the PUBLIC internet |
| `thy serve ... --public` | Run a server AND expose it publicly |
| `thy panel --public` | Launch the Control Panel on the public internet |
| `thy features` | List all `v3.*` helper features |

---

## 📚 Complete Language Documentation

For the full language specification, syntax rules, standard library modules, and a dictionary of all ThyScript keywords, please see:

👉 **[DOKUMEN.md](./DOKUMEN.md)**

---

## 📄 License

MIT License © 2026 ThyScript Team. Built with ❤️ on Node.js.

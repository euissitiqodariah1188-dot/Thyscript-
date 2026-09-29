// ═══════════════════════════════════════════════════════
//  TEST 3: Server, Routes, API & Web
//  Menguji HTTP server, routes GET/POST, JSON API
// ═══════════════════════════════════════════════════════

const table port = 4200

print("=== TEST 3: SERVER & API ===")

// Simple data store (in-memory DB)
const table items = []
const table idCounter = 1

// Initialize server
server(4200):
    print("Test 3 Server starting on port 4200...")
end()

// Health check route
route get "/health":
    response.json({
        status: "ok",
        server: "ThyScript Test Server",
        timestamp: Date.now(),
        version: "1.0.0"
    })
end()

// GET all items
route get "/api/items":
    response.json({
        success: true,
        count: items.length,
        items: items
    })
end()

// POST create item
route post "/api/items":
    const table name = request.body.name
    const table value = request.body.value

    if(not name):
        response.json({ success: false, message: "name is required" })
    else:
        const table newItem = {
            id: idCounter,
            name: name,
            value: value || 0,
            createdAt: new Date().toISOString()
        }
        add newItem in items
        add 1 in idCounter
        print("Created item: " + name)
        response.json({ success: true, item: newItem })
    end()
end()

// GET single item by id
route get "/api/items/:id":
    const table id = parseInt(request.params.id)
    const table found = items.find(i => i.id == id)
    if(found):
        response.json({ success: true, item: found })
    else:
        response.json({ success: false, message: "Item not found" })
    end()
end()

// GET stats
route get "/api/stats":
    const table count = items.length
    const table total = items.reduce((acc, i) => acc + (i.value || 0), 0)
    const table avg = count > 0 ? calculate(total / count) : 0
    response.json({
        success: true,
        stats: {
            totalItems: count,
            totalValue: total,
            averageValue: avg,
            serverUptime: process.uptime(),
            memUsage: process.memoryUsage().heapUsed
        }
    })
end()

// Web UI
route get "/":
    classHtml(test3_page):
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>ThyScript Test 3 - Server & API</title>
    <style>
        body { font-family: monospace; background: #0d0d1a; color: #0f0; padding: 20px; }
        h1 { color: #6366f1; }
        .btn { background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin: 4px; }
        .btn:hover { opacity: 0.85; }
        .output { background: #111; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-top: 16px; min-height: 100px; white-space: pre-wrap; font-size: 13px; }
        input { background: #1a1a2e; border: 1px solid #333; color: #fff; padding: 6px 10px; border-radius: 6px; margin: 4px; }
    </style>
</head>
<body>
    <h1>⚡ ThyScript Test 3 - Server API</h1>
    <p>HTTP Server running on port 4200</p>
    <div>
        <button class="btn" onclick="checkHealth()">Health Check</button>
        <button class="btn" onclick="getItems()">Get All Items</button>
        <button class="btn" onclick="getStats()">Get Stats</button>
    </div>
    <div>
        <input id="itemName" placeholder="Item name" />
        <input id="itemValue" type="number" placeholder="Value" />
        <button class="btn" onclick="createItem()">Add Item</button>
    </div>
    <div class="output" id="out">Click a button to test the API...</div>
    <script>
        async function req(url, opts) {
            const r = await fetch(url, opts);
            const d = await r.json();
            document.getElementById('out').textContent = JSON.stringify(d, null, 2);
        }
        function checkHealth() { req('/health'); }
        function getItems() { req('/api/items'); }
        function getStats() { req('/api/stats'); }
        function createItem() {
            const name = document.getElementById('itemName').value;
            const value = +document.getElementById('itemValue').value || 0;
            req('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, value })
            });
        }
    </script>
</body>
</html>
    end()
end()

print("🚀 TEST 3 SERVER READY on port " + port)
print("Open http://localhost:4200 to test")

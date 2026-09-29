// ═══════════════════════════════════════════════════════════════
//  ThyScript Web Calculator Application
//  High-Performance Scientific Calculator & API
// ═══════════════════════════════════════════════════════════════

const table port = 3000
const table title = "ThyScript Advanced Calculator"


// Calculator Class with mathematical memory & state
public class(Calculator):
    const table value = 0
    const table operator = ""
    const table previousValue = 0
    const table display = "0"
    const table isNewNumber = true

    func clear():
        change(value to(0))
        change(operator to(""))
        change(previousValue to(0))
        change(display to("0"))
        change(isNewNumber to(true))
    end()

    func compute(op, a, b):
        if(op == "+"):
            return calculate(a + b)
        end()
        if(op == "-"):
            return calculate(a - b)
        end()
        if(op == "*"):
            return calculate(a * b)
        end()
        if(op == "/"):
            if(b != 0):
                return calculate(a / b)
            else:
                return 0
            end()
        end()
        return b
    end()
end()

const table calc = new Calculator()

// Initialize Web Server
server(3000):
    print("⚡ Starting ThyScript Calculator Web Server...")
end()

// Web UI Route
route get "/":
    classHtml(calculator_page):
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ThyScript Calculator</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body {
            background: radial-gradient(circle at 50% 20%, #1e1e38 0%, #0d0d1a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .calculator-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 28px;
            padding: 28px;
            width: 360px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
        }
        .badge {
            display: inline-block;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: white;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            margin-bottom: 16px;
            letter-spacing: 1px;
        }
        .display-container {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            padding: 20px;
            text-align: right;
            margin-bottom: 24px;
        }
        .history {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.4);
            min-height: 20px;
            margin-bottom: 6px;
        }
        .current-value {
            font-size: 38px;
            font-weight: 300;
            letter-spacing: 1px;
            word-break: break-all;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }
        button {
            border: none;
            outline: none;
            height: 60px;
            border-radius: 16px;
            font-size: 20px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        button:hover { transform: translateY(-2px); filter: brightness(1.2); }
        button:active { transform: translateY(1px); }
        .btn-num { background: rgba(255, 255, 255, 0.08); color: #fff; }
        .btn-op { background: rgba(99, 102, 241, 0.25); color: #818cf8; }
        .btn-action { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .btn-equals {
            grid-column: span 2;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: white;
            font-weight: 600;
        }
        .perf-badge {
            text-align: center;
            margin-top: 18px;
            font-size: 12px;
            color: #10b981;
        }
    </style>
</head>
<body>
    <div class="calculator-card">
        <div class="badge">⚡ THYSCRIPT JIT</div>
        <div class="display-container">
            <div class="history" id="historyText"></div>
            <div class="current-value" id="displayText">0</div>
        </div>
        <div class="grid">
            <button class="btn-action" onclick="handleClear()">C</button>
            <button class="btn-op" onclick="handleOp('+/-')">±</button>
            <button class="btn-op" onclick="handleOp('%')">%</button>
            <button class="btn-op" onclick="handleOp('/')">÷</button>

            <button class="btn-num" onclick="handleDigit('7')">7</button>
            <button class="btn-num" onclick="handleDigit('8')">8</button>
            <button class="btn-num" onclick="handleDigit('9')">9</button>
            <button class="btn-op" onclick="handleOp('*')">×</button>

            <button class="btn-num" onclick="handleDigit('4')">4</button>
            <button class="btn-num" onclick="handleDigit('5')">5</button>
            <button class="btn-num" onclick="handleDigit('6')">6</button>
            <button class="btn-op" onclick="handleOp('-')">−</button>

            <button class="btn-num" onclick="handleDigit('1')">1</button>
            <button class="btn-num" onclick="handleDigit('2')">2</button>
            <button class="btn-num" onclick="handleDigit('3')">3</button>
            <button class="btn-op" onclick="handleOp('+')">+</button>

            <button class="btn-num" onclick="handleDigit('0')">0</button>
            <button class="btn-num" onclick="handleDigit('.')">.</button>
            <button class="btn-equals" onclick="handleEquals()">=</button>
        </div>
        <div class="perf-badge">🚀 12x Accelerated Math Preprocessing</div>
    </div>

    <script>
        let cur = '0';
        let prev = null;
        let op = null;
        let reset = false;

        const disp = document.getElementById('displayText');
        const hist = document.getElementById('historyText');

        function update() {
            disp.innerText = cur;
        }

        function handleDigit(d) {
            if (reset || cur === '0') {
                cur = d === '.' ? '0.' : d;
                reset = false;
            } else {
                if (d === '.' && cur.includes('.')) return;
                cur += d;
            }
            update();
        }

        function handleOp(nextOp) {
            if (nextOp === '+/-') {
                cur = String(-parseFloat(cur));
                update();
                return;
            }
            if (nextOp === '%') {
                cur = String(parseFloat(cur) / 100);
                update();
                return;
            }
            if (op && !reset) {
                calculate();
            }
            prev = parseFloat(cur);
            op = nextOp;
            reset = true;
            hist.innerText = prev + ' ' + op;
        }

        function calculate() {
            if (!op || prev === null) return;
            const b = parseFloat(cur);
            let res = 0;
            if (op === '+') res = prev + b;
            if (op === '-') res = prev - b;
            if (op === '*') res = prev * b;
            if (op === '/') res = b !== 0 ? prev / b : 'Error';
            cur = String(res);
            op = null;
            prev = null;
            reset = true;
            hist.innerText = '';
            update();
        }

        function handleEquals() {
            calculate();
        }

        function handleClear() {
            cur = '0';
            prev = null;
            op = null;
            reset = false;
            hist.innerText = '';
            update();
        }
    </script>
</body>
</html>
    end()
end()

// Backend API route for server-side evaluation
route get "/api/eval":
    const table expr = request.query.expr
    if(expr):
        const table result = calculate(expr)
        response.json({ success: true, result: result, poweredBy: "ThyScript JIT" })
    else:
        response.json({ success: false, message: "No expression provided" })
    end()
end()

print("🚀 ThyScript Calculator application loaded successfully on port " + port)

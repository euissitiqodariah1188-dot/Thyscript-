// ═══════════════════════════════════════════════════════════════
//  ThyScript Authentication & Login System
//  Full-stack Auth with Hashing, JWT Tokens & Sessions
// ═══════════════════════════════════════════════════════════════

const table port = 3001
const table secretKey = "thyscript_super_secret_auth_key_2024"

// In-memory database of registered users
const table users = []
const table sessions = {}

// User Entity Class
public class(User):
    const table id = ""
    const table username = ""
    const table email = ""
    const table passwordHash = ""
    const table role = "user"
    const table createdAt = ""
end()

// Initialize Web Server
server(3001):
    print("🔐 Starting ThyScript Auth Server on port 3001...")
end()

// Web UI Route
route get "/":
    classHtml(login_page):
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ThyScript Secure Auth</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body {
            background: linear-gradient(135deg, #090919 0%, #151528 50%, #0d1b2a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 420px;
        }
        .brand {
            text-align: center;
            margin-bottom: 24px;
        }
        .brand .logo {
            font-size: 42px;
            display: inline-block;
            background: -webkit-linear-gradient(#6366f1, #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
        }
        .brand p {
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
            margin-top: 4px;
        }
        .card {
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        .tabs {
            display: flex;
            background: rgba(0, 0, 0, 0.3);
            padding: 4px;
            border-radius: 14px;
            margin-bottom: 24px;
        }
        .tab {
            flex: 1;
            padding: 10px;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .tab.active {
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: #fff;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }
        .form-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 8px;
            color: rgba(255, 255, 255, 0.8);
        }
        input {
            width: 100%;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 14px 16px;
            font-size: 15px;
            color: #fff;
            outline: none;
            transition: all 0.2s;
        }
        input:focus {
            border-color: #818cf8;
            background: rgba(255, 255, 255, 0.09);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        .btn-submit {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.2s ease;
        }
        .btn-submit:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn-submit:active { transform: translateY(0); }
        .alert {
            padding: 12px 16px;
            border-radius: 12px;
            margin-top: 16px;
            font-size: 14px;
            display: none;
        }
        .alert-success { background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; }
        .alert-error { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; }
        
        /* Dashboard view */
        .dashboard {
            display: none;
            text-align: center;
        }
        .user-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 16px;
            color: white;
        }
        .token-box {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 14px;
            font-size: 12px;
            font-family: monospace;
            word-break: break-all;
            color: #a78bfa;
            margin: 16px 0;
            text-align: left;
        }
        .btn-logout {
            padding: 10px 24px;
            border-radius: 12px;
            border: 1px solid rgba(239, 68, 68, 0.4);
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            cursor: pointer;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="brand">
            <div class="logo">⚡ ThyScript Auth</div>
            <p>High-Security Authentication System</p>
        </div>

        <div class="card" id="authBox">
            <div class="tabs">
                <button class="tab active" onclick="switchTab('login')">Masuk</button>
                <button class="tab" onclick="switchTab('register')">Daftar</button>
            </div>

            <div id="loginForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="logUser" placeholder="Masukkan username">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="logPass" placeholder="Masukkan password">
                </div>
                <button class="btn-submit" onclick="doLogin()">🔑 Masuk Sekarang</button>
            </div>

            <div id="registerForm" style="display:none">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="regUser" placeholder="Pilih username unik">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="regEmail" placeholder="nama@domain.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="regPass" placeholder="Minimal 6 karakter">
                </div>
                <button class="btn-submit" onclick="doRegister()">✨ Buat Akun Baru</button>
            </div>

            <div id="alertBox" class="alert"></div>
        </div>

        <div class="card dashboard" id="dashBox">
            <div class="user-icon" id="userInitial">U</div>
            <h2 id="userNameText">Selamat Datang!</h2>
            <p id="userEmailText" style="color: rgba(255,255,255,0.6); margin-top: 4px;"></p>
            <div class="token-box">
                <div style="color: rgba(255,255,255,0.4); margin-bottom: 4px;">ACTIVE AUTH TOKEN (JWT):</div>
                <span id="tokenText"></span>
            </div>
            <button class="btn-logout" onclick="doLogout()">🚪 Keluar</button>
        </div>
    </div>

    <script>
        function switchTab(t) {
            document.querySelectorAll('.tab').forEach((el, idx) => {
                el.classList.toggle('active', (t === 'login' && idx === 0) || (t === 'register' && idx === 1));
            });
            document.getElementById('loginForm').style.display = t === 'login' ? 'block' : 'none';
            document.getElementById('registerForm').style.display = t === 'register' ? 'block' : 'none';
            hideAlert();
        }

        function showAlert(msg, isError) {
            const b = document.getElementById('alertBox');
            b.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
            b.innerText = msg;
            b.style.display = 'block';
        }

        function hideAlert() {
            document.getElementById('alertBox').style.display = 'none';
        }

        async function doRegister() {
            const username = document.getElementById('regUser').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPass').value;

            if (!username || !email || !password) return showAlert('Semua bidang harus diisi!', true);

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (data.success) {
                showAlert('Pendaftaran sukses! Silakan masuk.', false);
                switchTab('login');
            } else {
                showAlert(data.message || 'Registrasi gagal', true);
            }
        }

        async function doLogin() {
            const username = document.getElementById('logUser').value.trim();
            const password = document.getElementById('logPass').value;

            if (!username || !password) return showAlert('Masukkan username dan password!', true);

            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('authBox').style.display = 'none';
                document.getElementById('dashBox').style.display = 'block';
                document.getElementById('userNameText').innerText = 'Halo, ' + data.user.username + '!';
                document.getElementById('userEmailText').innerText = data.user.email;
                document.getElementById('userInitial').innerText = data.user.username[0].toUpperCase();
                document.getElementById('tokenText').innerText = data.token;
            } else {
                showAlert(data.message || 'Username atau password salah', true);
            }
        }

        function doLogout() {
            document.getElementById('dashBox').style.display = 'none';
            document.getElementById('authBox').style.display = 'block';
            document.getElementById('logPass').value = '';
            hideAlert();
        }
    </script>
</body>
</html>
    end()
end()

// API Registration
route post "/api/register":
    const table username = request.body.username
    const table email = request.body.email
    const table password = request.body.password

    if(not username or not email or not password):
        response.json({ success: false, message: "Field tidak boleh kosong" })
    end()

    // Check if user exists
    const table found = users.find(u => u.username == username)
    if(found):
        response.json({ success: false, message: "Username sudah terdaftar" })
    else:
        // Hash password with built-in security
        const table hash = security.hashPassword ? await security.hashPassword(password) : security.hash(password)
        const table newUser = {
            id: String(Date.now()),
            username: username,
            email: email,
            passwordHash: hash,
            role: "user",
            createdAt: new Date().toISOString()
        }
        add newUser in users
        print("👤 New user registered: " + username)
        response.json({ success: true, message: "User registered successfully" })
    end()
end()

// API Login
route post "/api/login":
    const table username = request.body.username
    const table password = request.body.password

    const table user = users.find(u => u.username == username)
    if(not user):
        response.json({ success: false, message: "User tidak ditemukan" })
    else:
        const table isValid = security.verifyPassword ? await security.verifyPassword(password, user.passwordHash) : (security.hash(password) == user.passwordHash)
        if(not isValid):
            response.json({ success: false, message: "Password salah" })
        else:
            const table token = security.generateToken ? security.generateToken({ username: user.username, email: user.email }, secretKey) : security.hash(user.username + secretKey)
            print("🔑 User logged in: " + username)
            response.json({
                success: true,
                token: token,
                user: { username: user.username, email: user.email, role: user.role }
            })
        end()
    end()
end()

print("🚀 ThyScript Login Server ready on port " + port)

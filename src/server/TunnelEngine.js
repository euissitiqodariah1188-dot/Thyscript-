'use strict';
/**
 * ThyScript v3 TunnelEngine
 * Exposes a localhost server to the public internet with a real,
 * publicly-accessible URL. Uses the free `localtunnel` service
 * (https://localtunnel.github.io/localtunnel/) which gives you a
 * `https://<subdomain>.loca.lt` URL reachable from anywhere — no
 * account, API key, or router/NAT port-forwarding required.
 *
 * A TunnelEngine never modifies or serves your app directly; it only
 * proxies to an existing local server (e.g. one started by `thy serve`
 * or `thy panel`), so it is completely non-destructive.
 */

const os = require('os');
const http = require('http');

// localtunnel is optional — TunnelEngine degrades gracefully if it is
// not installed so the rest of ThyScript keeps working.
let localtunnel = null;
try { localtunnel = require('localtunnel'); } catch (_) { localtunnel = null; }

const VERSION = '3.0.0';

class TunnelEngine {
  /**
   * @param {object} options
   * @param {number}  options.port          Local port the tunnel should proxy to.
   * @param {string}  [options.subdomain]   Preferred public subdomain (e.g. "myapp").
   * @param {string}  [options.host]        localtunnel server host (defaults to loca.lt).
   * @param {number}  [options.localHost]   Local host to forward to (default 127.0.0.1).
   */
  constructor(options = {}) {
    this.options = Object.assign({
      port: 3000,
      localHost: '127.0.0.1',
      host: null,      // default localtunnel server
      subdomain: null, // random subdomain if not provided
    }, options);

    this.tunnel = null;
    this.publicUrl = null;
    this.startTime = null;
    this.isActive = false;
    this._fatalError = null;
  }

  /**
   * Detects the primary public-facing IPv4 address of this machine.
   * Used only for informational display; it is NOT how external clients
   * reach the tunnel (that is the public URL).
   */
  getLocalAddress() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Whether the localtunnel package is available.
   */
  get available() {
    return localtunnel !== null;
  }

  /**
   * Quick connectivity probe to the localtunnel server before opening
   * a real tunnel. Returns a boolean.
   */
  pingHost(timeoutMs = 5000) {
    if (!localtunnel) return Promise.resolve(false);
    const host = this.options.host || 'https://localtunnel.me';
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      const url = new URL(host);
      const req = http.get(
        { hostname: url.hostname, port: url.port || 443, path: '/', method: 'HEAD' },
        (res) => { clearTimeout(timer); resolve(true); res.resume(); },
      );
      req.on('error', () => { clearTimeout(timer); resolve(false); });
      req.setTimeout(timeoutMs, () => { clearTimeout(timer); req.destroy(); resolve(false); });
    });
  }

  /**
   * Opens the public tunnel.
   * @returns {Promise<{ publicUrl: string, subdomain: string, latencies: number }>}
   */
  async start() {
    if (!localtunnel) {
      throw new Error(
        'localtunnel is not installed. Run: npm install localtunnel',
      );
    }

    const tunnelOpts = {
      port: Number(this.options.port),
      local_host: this.options.localHost || '127.0.0.1',
    };
    if (this.options.subdomain) tunnelOpts.subdomain = this.options.subdomain;
    if (this.options.host) tunnelOpts.host = this.options.host;

    const startedAt = Date.now();
    const rawHost = this.options.host || 'https://localtunnel.me';
    this.tunnel = await localtunnel(tunnelOpts);

    this.publicUrl = this.tunnel.url;
    this.startTime = Date.now();
    this.isActive = true;

    this.tunnel.on('error', (err) => {
      this._fatalError = err;
      throw new Error(`Tunnel error: ${err.message}`);
    });

    this.tunnel.on('close', () => {
      this.isActive = false;
    });

    return {
      publicUrl: this.publicUrl,
      subdomain: (this.tunnel.url || '').split('//')[1],
      host: rawHost,
      localPort: Number(this.options.port),
      startedMs: Date.now() - startedAt,
    };
  }

  /**
   * Closes the public tunnel.
   */
  async stop() {
    if (this.tunnel) {
      try { this.tunnel.close(); } catch (_) {}
      this.isActive = false;
    }
    return this;
  }
}

module.exports = TunnelEngine;
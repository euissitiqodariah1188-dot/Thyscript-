'use strict';
/**
 * ThyScript File Library
 * Comprehensive file system operations with async/sync APIs, streams, and compression
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class ThyFileLib {
  // ─── Reading ───────────────────────────────────────────────────────────────
  static async read(filePath, encoding = 'utf8') {
    return fs.promises.readFile(path.resolve(filePath), encoding);
  }

  static readSync(filePath, encoding = 'utf8') {
    return fs.readFileSync(path.resolve(filePath), encoding);
  }

  static async readJSON(filePath) {
    const content = await ThyFileLib.read(filePath);
    return JSON.parse(content);
  }

  static readJSONSync(filePath) {
    return JSON.parse(ThyFileLib.readSync(filePath));
  }

  static async readLines(filePath, encoding = 'utf8') {
    const content = await ThyFileLib.read(filePath, encoding);
    return content.split(/\r?\n/);
  }

  // ─── Writing ───────────────────────────────────────────────────────────────
  static async write(filePath, content, encoding = 'utf8') {
    const resolved = path.resolve(filePath);
    await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
    return fs.promises.writeFile(resolved, content, encoding);
  }

  static writeSync(filePath, content, encoding = 'utf8') {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    return fs.writeFileSync(resolved, content, encoding);
  }

  static async writeJSON(filePath, obj, pretty = true) {
    const content = pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
    return ThyFileLib.write(filePath, content);
  }

  static async append(filePath, content, encoding = 'utf8') {
    const resolved = path.resolve(filePath);
    await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
    return fs.promises.appendFile(resolved, content, encoding);
  }

  static async writeLines(filePath, lines, encoding = 'utf8') {
    return ThyFileLib.write(filePath, lines.join('\n'), encoding);
  }

  // ─── File & Directory Management ───────────────────────────────────────────
  static exists(filePath) {
    return fs.existsSync(path.resolve(filePath));
  }

  static async delete(filePath) {
    const resolved = path.resolve(filePath);
    const stat = await fs.promises.stat(resolved);
    if (stat.isDirectory()) {
      return fs.promises.rm(resolved, { recursive: true, force: true });
    }
    return fs.promises.unlink(resolved);
  }

  static async mkdir(dirPath) {
    return fs.promises.mkdir(path.resolve(dirPath), { recursive: true });
  }

  static async listDir(dirPath, recursive = false) {
    const resolved = path.resolve(dirPath);
    if (!recursive) {
      return fs.promises.readdir(resolved);
    }
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await ThyFileLib.listDir(fullPath, true);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  static async copy(src, dst) {
    const rSrc = path.resolve(src);
    const rDst = path.resolve(dst);
    await fs.promises.mkdir(path.dirname(rDst), { recursive: true });
    return fs.promises.copyFile(rSrc, rDst);
  }

  static async move(src, dst) {
    const rSrc = path.resolve(src);
    const rDst = path.resolve(dst);
    await fs.promises.mkdir(path.dirname(rDst), { recursive: true });
    return fs.promises.rename(rSrc, rDst);
  }

  static async stat(filePath) {
    const st = await fs.promises.stat(path.resolve(filePath));
    return {
      size: st.size,
      isFile: st.isFile(),
      isDirectory: st.isDirectory(),
      created: st.birthtime,
      modified: st.mtime,
      accessed: st.atime,
    };
  }

  static watch(filePath, callback) {
    return fs.watch(path.resolve(filePath), callback);
  }

  // ─── Streams ───────────────────────────────────────────────────────────────
  static readStream(filePath, options = {}) {
    return fs.createReadStream(path.resolve(filePath), options);
  }

  static writeStream(filePath, options = {}) {
    return fs.createWriteStream(path.resolve(filePath), options);
  }

  // ─── Compression ───────────────────────────────────────────────────────────
  static async compress(srcPath, dstPath) {
    const data = await fs.promises.readFile(path.resolve(srcPath));
    const compressed = await gzip(data);
    const target = dstPath || (srcPath + '.gz');
    await fs.promises.writeFile(path.resolve(target), compressed);
    return target;
  }

  static async decompress(srcPath, dstPath) {
    const data = await fs.promises.readFile(path.resolve(srcPath));
    const decompressed = await gunzip(data);
    const target = dstPath || srcPath.replace(/\.gz$/, '');
    await fs.promises.writeFile(path.resolve(target), decompressed);
    return target;
  }

  // ─── Path Utilities ────────────────────────────────────────────────────────
  static join(...parts) { return path.join(...parts); }
  static resolve(...parts) { return path.resolve(...parts); }
  static dirname(p) { return path.dirname(p); }
  static basename(p, ext) { return path.basename(p, ext); }
  static extname(p) { return path.extname(p); }
}

module.exports = ThyFileLib;

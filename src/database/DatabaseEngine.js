'use strict';

// Optional database drivers — gracefully stubbed if not installed
let mysql, PgClient, mongoose, createRedisClient, sqlite3, knex;

try { mysql = require('mysql2/promise'); } catch (e) { mysql = null; }
try { ({ Client: PgClient } = require('pg')); } catch (e) { PgClient = null; }
try { mongoose = require('mongoose'); } catch (e) { mongoose = null; }
try { ({ createClient: createRedisClient } = require('redis')); } catch (e) { createRedisClient = null; }
try { sqlite3 = require('sqlite3').verbose(); } catch (e) { sqlite3 = null; }
try { knex = require('knex'); } catch (e) { knex = null; }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// Query Builder
// ─────────────────────────────────────────────

class QueryBuilder {
  constructor(engine, tableName) {
    this._engine = engine;
    this._table = tableName;
    this._selects = ['*'];
    this._wheres = [];
    this._params = [];
    this._orderBys = [];
    this._limitVal = null;
    this._offsetVal = null;
    this._joins = [];
    this._groups = [];
    this._havings = [];
    this._paramIndex = 1;
  }

  /**
   * @param {...string} cols
   */
  select(...cols) {
    this._selects = cols.length ? cols : ['*'];
    return this;
  }

  /**
   * @param {string} condition - Raw condition string with ? placeholders.
   * @param {...*} values
   */
  where(condition, ...values) {
    this._wheres.push(condition);
    this._params.push(...values);
    return this;
  }

  /**
   * @param {string} col
   * @param {'ASC'|'DESC'} [dir='ASC']
   */
  orderBy(col, dir = 'ASC') {
    this._orderBys.push(`${col} ${dir.toUpperCase()}`);
    return this;
  }

  /** @param {number} n */
  limit(n) { this._limitVal = n; return this; }

  /** @param {number} n */
  offset(n) { this._offsetVal = n; return this; }

  /**
   * @param {string} table
   * @param {string} condition
   * @param {'INNER'|'LEFT'|'RIGHT'} [type='INNER']
   */
  join(table, condition, type = 'INNER') {
    this._joins.push(`${type} JOIN ${table} ON ${condition}`);
    return this;
  }

  /** @param {...string} cols */
  groupBy(...cols) { this._groups = cols; return this; }

  /**
   * @param {string} condition
   * @param {...*} values
   */
  having(condition, ...values) {
    this._havings.push(condition);
    this._params.push(...values);
    return this;
  }

  _buildSQL() {
    let sql = `SELECT ${this._selects.join(', ')} FROM ${this._table}`;
    if (this._joins.length) sql += ' ' + this._joins.join(' ');
    if (this._wheres.length) sql += ' WHERE ' + this._wheres.join(' AND ');
    if (this._groups.length) sql += ' GROUP BY ' + this._groups.join(', ');
    if (this._havings.length) sql += ' HAVING ' + this._havings.join(' AND ');
    if (this._orderBys.length) sql += ' ORDER BY ' + this._orderBys.join(', ');
    if (this._limitVal !== null) sql += ` LIMIT ${this._limitVal}`;
    if (this._offsetVal !== null) sql += ` OFFSET ${this._offsetVal}`;
    return { sql, params: this._params };
  }

  /**
   * Executes the query.
   * @returns {Promise<any[]>}
   */
  async execute() {
    const { sql, params } = this._buildSQL();
    return this._engine._queryRaw(sql, params);
  }

  /** Returns the raw SQL and params without executing. */
  toSQL() {
    return this._buildSQL();
  }
}

// ─────────────────────────────────────────────
// Migration System
// ─────────────────────────────────────────────

class MigrationManager {
  constructor(engine) {
    this._engine = engine;
    this._migrationsDir = path.resolve(process.cwd(), 'migrations');
    this._tableName = 'thyscript_migrations';
  }

  setDir(dir) { this._migrationsDir = path.resolve(dir); return this; }

  async _ensureTable() {
    await this._engine._queryRaw(
      `CREATE TABLE IF NOT EXISTS ${this._tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL UNIQUE,
        batch INTEGER NOT NULL DEFAULT 1,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, []
    ).catch(() => {
      // MySQL / PG syntax
      return this._engine._queryRaw(
        `CREATE TABLE IF NOT EXISTS ${this._tableName} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          batch INTEGER NOT NULL DEFAULT 1,
          run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, []
      );
    });
  }

  /**
   * Creates a new migration file.
   * @param {string} name
   * @returns {string} File path.
   */
  create(name) {
    if (!fs.existsSync(this._migrationsDir)) {
      fs.mkdirSync(this._migrationsDir, { recursive: true });
    }
    const timestamp = Date.now();
    const filename = `${timestamp}_${name.replace(/\s+/g, '_')}.js`;
    const filePath = path.join(this._migrationsDir, filename);
    const template = `'use strict';
// Migration: ${name}
// Created: ${new Date().toISOString()}

module.exports = {
  async up(db) {
    // Write your migration here
    // Example: await db._queryRaw('CREATE TABLE example (id INT PRIMARY KEY)', []);
  },

  async down(db) {
    // Write your rollback here
    // Example: await db._queryRaw('DROP TABLE IF EXISTS example', []);
  },
};
`;
    fs.writeFileSync(filePath, template, 'utf8');
    console.log(`[MigrationManager] Created: ${filePath}`);
    return filePath;
  }

  /**
   * Runs all pending migrations.
   * @returns {Promise<string[]>} Names of run migrations.
   */
  async up() {
    await this._ensureTable();
    const files = this._getMigrationFiles();
    const ran = await this._getRanMigrations();
    const ranNames = new Set(ran.map((r) => r.name));
    const pending = files.filter((f) => !ranNames.has(path.basename(f)));

    if (pending.length === 0) {
      console.log('[MigrationManager] No pending migrations.');
      return [];
    }

    const batch = (ran.length > 0 ? Math.max(...ran.map((r) => r.batch)) : 0) + 1;
    const executed = [];

    for (const file of pending) {
      const name = path.basename(file);
      console.log(`[MigrationManager] Running: ${name}`);
      const migration = require(file);
      await migration.up(this._engine);
      await this._engine._queryRaw(
        `INSERT INTO ${this._tableName} (name, batch) VALUES (?, ?)`,
        [name, batch]
      );
      executed.push(name);
    }

    console.log(`[MigrationManager] Ran ${executed.length} migration(s).`);
    return executed;
  }

  /**
   * Rolls back the last batch of migrations.
   * @returns {Promise<string[]>} Names of rolled back migrations.
   */
  async down() {
    await this._ensureTable();
    const ran = await this._getRanMigrations();
    if (ran.length === 0) { console.log('[MigrationManager] Nothing to rollback.'); return []; }

    const lastBatch = Math.max(...ran.map((r) => r.batch));
    const toRollback = ran.filter((r) => r.batch === lastBatch);
    const rolledBack = [];

    for (const record of toRollback.reverse()) {
      const file = path.join(this._migrationsDir, record.name);
      if (!fs.existsSync(file)) {
        console.warn(`[MigrationManager] File not found, skipping rollback: ${record.name}`);
        continue;
      }
      console.log(`[MigrationManager] Rolling back: ${record.name}`);
      const migration = require(file);
      await migration.down(this._engine);
      await this._engine._queryRaw(
        `DELETE FROM ${this._tableName} WHERE name = ?`,
        [record.name]
      );
      rolledBack.push(record.name);
    }

    return rolledBack;
  }

  /**
   * Returns current migration status.
   * @returns {Promise<object[]>}
   */
  async status() {
    await this._ensureTable();
    const files = this._getMigrationFiles().map((f) => path.basename(f));
    const ran = await this._getRanMigrations();
    const ranNames = new Set(ran.map((r) => r.name));

    return files.map((name) => ({
      name,
      status: ranNames.has(name) ? 'ran' : 'pending',
      batch: ranNames.has(name) ? ran.find((r) => r.name === name).batch : null,
    }));
  }

  _getMigrationFiles() {
    if (!fs.existsSync(this._migrationsDir)) return [];
    return fs.readdirSync(this._migrationsDir)
      .filter((f) => f.endsWith('.js'))
      .sort()
      .map((f) => path.join(this._migrationsDir, f));
  }

  async _getRanMigrations() {
    try {
      return await this._engine._queryRaw(`SELECT * FROM ${this._tableName} ORDER BY batch, id`, []);
    } catch { return []; }
  }
}

// ─────────────────────────────────────────────
// DatabaseEngine
// ─────────────────────────────────────────────

class DatabaseEngine {
  constructor() {
    this._type = null;          // 'mysql' | 'pg' | 'mongo' | 'redis' | 'sqlite'
    this._connection = null;    // Active connection or pool
    this._config = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._reconnectDelay = 2000;

    // ORM-like models registry
    this._models = new Map(); // name -> { schema }
    this._modelData = new Map(); // name -> Map<id, data> (in-memory fallback)

    // Migration manager (attached after connection)
    this.migrate = new MigrationManager(this);

    // Knex query builder instance
    this._knex = null;
  }

  // ─────────────────────────────────────────────
  // MySQL
  // ─────────────────────────────────────────────

  /**
   * Connects to MySQL and creates a connection pool.
   * @param {object} config - { host, port, user, password, database, connectionLimit, ... }
   * @returns {Promise<DatabaseEngine>}
   */
  async connectMySQL(config) {
    if (!mysql) throw new Error('mysql2 not installed. Run: npm install mysql2');
    this._type = 'mysql';
    this._config = config;
    this._connection = await mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user || 'root',
      password: config.password || '',
      database: config.database,
      connectionLimit: config.connectionLimit || 10,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    console.log('[DatabaseEngine] MySQL connected');
    return this;
  }

  /**
   * @param {string} sql - Parameterized SQL string.
   * @param {any[]} params
   * @returns {Promise<any[]>}
   */
  async mysqlQuery(sql, params = []) {
    const [rows] = await this._connection.execute(sql, params);
    return rows;
  }

  /** @param {string} table @param {object} data @returns {Promise<object>} */
  async mysqlInsert(table, data) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
    const [result] = await this._connection.execute(sql, vals);
    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /** @param {string} table @param {object} data @param {string} condition @param {any[]} params */
  async mysqlUpdate(table, data, condition, params = []) {
    const sets = Object.keys(data).map((k) => `\`${k}\` = ?`).join(', ');
    const vals = [...Object.values(data), ...params];
    const sql = `UPDATE \`${table}\` SET ${sets} WHERE ${condition}`;
    const [result] = await this._connection.execute(sql, vals);
    return { affectedRows: result.affectedRows, changedRows: result.changedRows };
  }

  /** @param {string} table @param {string} condition @param {any[]} params */
  async mysqlDelete(table, condition, params = []) {
    const [result] = await this._connection.execute(
      `DELETE FROM \`${table}\` WHERE ${condition}`, params
    );
    return { affectedRows: result.affectedRows };
  }

  /** @param {string} table @param {string[]} cols @param {string} [condition] @param {any[]} [params] */
  async mysqlSelect(table, cols = ['*'], condition = null, params = []) {
    const colStr = cols.join(', ');
    let sql = `SELECT ${colStr} FROM \`${table}\``;
    if (condition) sql += ` WHERE ${condition}`;
    return this.mysqlQuery(sql, params);
  }

  /**
   * @param {string} table
   * @param {object} schema - { colName: 'INT PRIMARY KEY', ... }
   * @param {boolean} [ifNotExists=true]
   */
  async mysqlCreateTable(table, schema, ifNotExists = true) {
    const cols = Object.entries(schema).map(([col, def]) => `\`${col}\` ${def}`).join(', ');
    const qualifier = ifNotExists ? 'IF NOT EXISTS ' : '';
    await this._connection.execute(`CREATE TABLE ${qualifier}\`${table}\` (${cols})`, []);
    return this;
  }

  /** @param {string} table @param {boolean} [ifExists=true] */
  async mysqlDropTable(table, ifExists = true) {
    const qualifier = ifExists ? 'IF EXISTS ' : '';
    await this._connection.execute(`DROP TABLE ${qualifier}\`${table}\``, []);
    return this;
  }

  /**
   * Executes multiple queries in a single MySQL transaction.
   * @param {function} callback - async (connection) => {}
   * @returns {Promise<any>}
   */
  async mysqlTransaction(callback) {
    const conn = await this._connection.getConnection();
    await conn.beginTransaction();
    try {
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─────────────────────────────────────────────
  // PostgreSQL
  // ─────────────────────────────────────────────

  /**
   * Connects to PostgreSQL.
   * @param {object} config - { host, port, user, password, database }
   * @returns {Promise<DatabaseEngine>}
   */
  async connectPostgres(config) {
    if (!PgClient) throw new Error('pg not installed. Run: npm install pg');
    this._type = 'pg';
    this._config = config;
    this._connection = new PgClient({
      host: config.host || 'localhost',
      port: config.port || 5432,
      user: config.user || 'postgres',
      password: config.password || '',
      database: config.database,
    });
    await this._connection.connect();
    this._connection.on('error', (err) => {
      console.error('[DatabaseEngine] PostgreSQL error:', err.message);
      this._autoReconnect(() => this.connectPostgres(this._config));
    });
    console.log('[DatabaseEngine] PostgreSQL connected');
    return this;
  }

  /** @param {string} sql @param {any[]} params */
  async pgQuery(sql, params = []) {
    const result = await this._connection.query(sql, params);
    return result.rows;
  }

  /** @param {string} table @param {object} data */
  async pgInsert(table, data) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this._connection.query(sql, vals);
    return result.rows[0];
  }

  /** @param {string} table @param {object} data @param {string} condition @param {any[]} condParams */
  async pgUpdate(table, data, condition, condParams = []) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const sets = cols.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const offsetParams = condParams.map((_, i) => `$${vals.length + i + 1}`);
    const condStr = condition.replace(/\?/g, () => offsetParams.shift());
    const sql = `UPDATE "${table}" SET ${sets} WHERE ${condStr} RETURNING *`;
    const result = await this._connection.query(sql, [...vals, ...condParams]);
    return result.rows;
  }

  /** @param {string} table @param {string} condition @param {any[]} params */
  async pgDelete(table, condition, params = []) {
    const paramStr = params.map((_, i) => `$${i + 1}`);
    let condStr = condition;
    paramStr.forEach((p, i) => { condStr = condStr.replace('?', p); });
    const sql = `DELETE FROM "${table}" WHERE ${condStr} RETURNING *`;
    const result = await this._connection.query(sql, params);
    return result.rows;
  }

  /** @param {string} table @param {string[]} cols @param {string} [condition] @param {any[]} [params] */
  async pgSelect(table, cols = ['*'], condition = null, params = []) {
    let sql = `SELECT ${cols.join(', ')} FROM "${table}"`;
    if (condition) {
      const paramStr = params.map((_, i) => `$${i + 1}`);
      let condStr = condition;
      paramStr.forEach((p) => { condStr = condStr.replace('?', p); });
      sql += ` WHERE ${condStr}`;
    }
    return this.pgQuery(sql, params);
  }

  /**
   * @param {function} callback - async (client) => {}
   */
  async pgTransaction(callback) {
    await this._connection.query('BEGIN');
    try {
      const result = await callback(this._connection);
      await this._connection.query('COMMIT');
      return result;
    } catch (err) {
      await this._connection.query('ROLLBACK');
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // MongoDB
  // ─────────────────────────────────────────────

  /**
   * Connects to MongoDB via Mongoose.
   * @param {string} uri - MongoDB connection URI.
   * @param {object} [options]
   * @returns {Promise<DatabaseEngine>}
   */
  async connectMongo(uri, options = {}) {
    if (!mongoose) throw new Error('mongoose not installed. Run: npm install mongoose');
    this._type = 'mongo';
    await mongoose.connect(uri, Object.assign({
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }, options));
    this._connection = mongoose.connection;
    this._connection.on('disconnected', () => {
      console.warn('[DatabaseEngine] MongoDB disconnected. Reconnecting...');
      this._autoReconnect(() => this.connectMongo(uri, options));
    });
    console.log('[DatabaseEngine] MongoDB connected');
    return this;
  }

  _getMongoModel(collection) {
    if (mongoose.modelNames().includes(collection)) return mongoose.model(collection);
    const schema = new mongoose.Schema({}, { strict: false, timestamps: true });
    return mongoose.model(collection, schema);
  }

  /** @param {string} col @param {object} filter @param {object} [projection] @param {object} [opts] */
  async mongoFind(col, filter = {}, projection = {}, opts = {}) {
    const Model = this._getMongoModel(col);
    return Model.find(filter, projection, opts).lean();
  }

  /** @param {string} col @param {object} data */
  async mongoInsertOne(col, data) {
    const Model = this._getMongoModel(col);
    const doc = new Model(data);
    return doc.save();
  }

  /** @param {string} col @param {object[]} docs */
  async mongoInsertMany(col, docs) {
    const Model = this._getMongoModel(col);
    return Model.insertMany(docs);
  }

  /** @param {string} col @param {object} filter @param {object} update @param {object} [opts] */
  async mongoUpdateOne(col, filter, update, opts = {}) {
    const Model = this._getMongoModel(col);
    return Model.updateOne(filter, update, opts);
  }

  /** @param {string} col @param {object} filter @param {object} update @param {object} [opts] */
  async mongoUpdateMany(col, filter, update, opts = {}) {
    const Model = this._getMongoModel(col);
    return Model.updateMany(filter, update, opts);
  }

  /** @param {string} col @param {object} filter */
  async mongoDeleteOne(col, filter) {
    const Model = this._getMongoModel(col);
    return Model.deleteOne(filter);
  }

  /** @param {string} col @param {object} filter */
  async mongoDeleteMany(col, filter) {
    const Model = this._getMongoModel(col);
    return Model.deleteMany(filter);
  }

  /** @param {string} col @param {object[]} pipeline */
  async mongoAggregate(col, pipeline) {
    const Model = this._getMongoModel(col);
    return Model.aggregate(pipeline);
  }

  // ─────────────────────────────────────────────
  // Redis
  // ─────────────────────────────────────────────

  /**
   * Connects to Redis.
   * @param {object|string} config - Redis URL or config object.
   * @returns {Promise<DatabaseEngine>}
   */
  async connectRedis(config = {}) {
    if (!createRedisClient) throw new Error('redis not installed. Run: npm install redis');
    this._type = 'redis';
    const opts = typeof config === 'string' ? { url: config } : config;
    this._connection = createRedisClient(Object.assign({ socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) } }, opts));
    this._connection.on('error', (err) => console.error('[DatabaseEngine] Redis error:', err.message));
    await this._connection.connect();
    console.log('[DatabaseEngine] Redis connected');
    return this;
  }

  async redisGet(key) { return this._connection.get(key); }
  async redisSet(key, value, options = {}) { return this._connection.set(key, value, options); }
  async redisDel(...keys) { return this._connection.del(keys); }
  async redisExists(...keys) { return this._connection.exists(keys); }
  async redisExpire(key, seconds) { return this._connection.expire(key, seconds); }
  async redisLPush(key, ...values) { return this._connection.lPush(key, values); }
  async redisRPush(key, ...values) { return this._connection.rPush(key, values); }
  async redisLPop(key, count = 1) { return this._connection.lPop(key, count); }
  async redisRPop(key, count = 1) { return this._connection.rPop(key, count); }
  async redisHSet(key, field, value) { return this._connection.hSet(key, field, value); }
  async redisHGet(key, field) { return this._connection.hGet(key, field); }
  async redisHGetAll(key) { return this._connection.hGetAll(key); }
  async redisPublish(channel, message) { return this._connection.publish(channel, typeof message === 'object' ? JSON.stringify(message) : message); }
  async redisSubscribe(channel, callback) { return this._connection.subscribe(channel, (message) => { try { callback(JSON.parse(message), channel); } catch { callback(message, channel); } }); }
  async redisIncr(key) { return this._connection.incr(key); }
  async redisDecr(key) { return this._connection.decr(key); }
  async redisTTL(key) { return this._connection.ttl(key); }

  // ─────────────────────────────────────────────
  // SQLite
  // ─────────────────────────────────────────────

  /**
   * Connects to SQLite.
   * @param {string} [filePath=':memory:']
   * @returns {Promise<DatabaseEngine>}
   */
  async connectSQLite(filePath = ':memory:') {
    if (!sqlite3) throw new Error('sqlite3 not installed. Run: npm install sqlite3');
    this._type = 'sqlite';
    return new Promise((resolve, reject) => {
      this._connection = new sqlite3.Database(filePath, (err) => {
        if (err) return reject(err);
        console.log(`[DatabaseEngine] SQLite connected: ${filePath}`);
        resolve(this);
      });
    });
  }

  /**
   * Runs a SELECT query on SQLite.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {Promise<any[]>}
   */
  async sqliteQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._connection.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  /**
   * Runs an INSERT/UPDATE/DELETE statement on SQLite.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {Promise<{ lastID: number, changes: number }>}
   */
  async sqliteRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._connection.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // ─────────────────────────────────────────────
  // Generic _queryRaw (used by QueryBuilder + Migrations)
  // ─────────────────────────────────────────────

  async _queryRaw(sql, params = []) {
    switch (this._type) {
      case 'mysql': return this.mysqlQuery(sql, params);
      case 'pg': return this.pgQuery(sql, params);
      case 'sqlite': return this.sqliteQuery(sql, params);
      default: throw new Error(`_queryRaw not supported for type: ${this._type}`);
    }
  }

  // ─────────────────────────────────────────────
  // Query Builder factory
  // ─────────────────────────────────────────────

  /**
   * Returns a QueryBuilder for the given table.
   * @param {string} tableName
   * @returns {QueryBuilder}
   */
  table(tableName) {
    return new QueryBuilder(this, tableName);
  }

  // ─────────────────────────────────────────────
  // ORM-like Interface
  // ─────────────────────────────────────────────

  /**
   * Registers a model schema.
   * @param {string} name - Model name.
   * @param {object} schema - { fieldName: { type, required, default, validate } }
   * @returns {DatabaseEngine}
   */
  model(name, schema) {
    this._models.set(name, { schema, name });
    if (!this._modelData.has(name)) this._modelData.set(name, new Map());
    return this;
  }

  _validateSchema(name, data) {
    const modelDef = this._models.get(name);
    if (!modelDef) throw new Error(`Model "${name}" not registered`);
    const { schema } = modelDef;
    const validated = {};
    for (const [field, def] of Object.entries(schema)) {
      let val = data[field];
      if (val === undefined && def.default !== undefined) {
        val = typeof def.default === 'function' ? def.default() : def.default;
      }
      if (def.required && (val === undefined || val === null)) {
        throw new Error(`Field "${field}" is required in model "${name}"`);
      }
      if (val !== undefined && def.type) {
        if (def.type === 'string' && typeof val !== 'string') val = String(val);
        else if (def.type === 'number' && typeof val !== 'number') val = Number(val);
        else if (def.type === 'boolean' && typeof val !== 'boolean') val = Boolean(val);
        else if (def.type === 'date' && !(val instanceof Date)) val = new Date(val);
      }
      if (def.validate && typeof def.validate === 'function') {
        const ok = def.validate(val);
        if (!ok) throw new Error(`Validation failed for field "${field}" in model "${name}"`);
      }
      if (val !== undefined) validated[field] = val;
    }
    return validated;
  }

  _genId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Creates a new record for the given model.
   * Uses database if connected, otherwise falls back to in-memory.
   * @param {string} modelName
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(modelName, data) {
    const validated = this._validateSchema(modelName, data);
    validated.id = validated.id || this._genId();
    validated.createdAt = new Date().toISOString();
    validated.updatedAt = new Date().toISOString();

    switch (this._type) {
      case 'mysql': return this.mysqlInsert(modelName, validated);
      case 'pg': return this.pgInsert(modelName, validated);
      case 'mongo': return this.mongoInsertOne(modelName, validated);
      case 'sqlite': {
        const res = await this.sqliteRun(
          `INSERT INTO ${modelName} (${Object.keys(validated).join(', ')}) VALUES (${Object.keys(validated).map(() => '?').join(', ')})`,
          Object.values(validated)
        );
        return { ...validated, rowid: res.lastID };
      }
      default: {
        const store = this._modelData.get(modelName);
        store.set(validated.id, validated);
        return { ...validated };
      }
    }
  }

  /**
   * Finds a record by ID.
   * @param {string} modelName
   * @param {string|number} id
   * @returns {Promise<object|null>}
   */
  async findById(modelName, id) {
    switch (this._type) {
      case 'mysql': { const rows = await this.mysqlSelect(modelName, ['*'], 'id = ?', [id]); return rows[0] || null; }
      case 'pg': { const rows = await this.pgSelect(modelName, ['*'], 'id = ?', [id]); return rows[0] || null; }
      case 'mongo': { const Model = this._getMongoModel(modelName); return Model.findById(id).lean(); }
      case 'sqlite': { const rows = await this.sqliteQuery(`SELECT * FROM ${modelName} WHERE id = ?`, [id]); return rows[0] || null; }
      default: return this._modelData.get(modelName)?.get(String(id)) || null;
    }
  }

  /**
   * Finds multiple records matching a filter.
   * @param {string} modelName
   * @param {object} filter - { fieldName: value }
   * @returns {Promise<object[]>}
   */
  async findMany(modelName, filter = {}) {
    const keys = Object.keys(filter);
    switch (this._type) {
      case 'mysql': {
        if (!keys.length) return this.mysqlSelect(modelName);
        const cond = keys.map((k) => `\`${k}\` = ?`).join(' AND ');
        return this.mysqlSelect(modelName, ['*'], cond, Object.values(filter));
      }
      case 'pg': {
        if (!keys.length) return this.pgSelect(modelName);
        const cond = keys.map((k) => `"${k}" = ?`).join(' AND ');
        return this.pgSelect(modelName, ['*'], cond, Object.values(filter));
      }
      case 'mongo': return this.mongoFind(modelName, filter);
      case 'sqlite': {
        if (!keys.length) return this.sqliteQuery(`SELECT * FROM ${modelName}`, []);
        const cond = keys.map((k) => `${k} = ?`).join(' AND ');
        return this.sqliteQuery(`SELECT * FROM ${modelName} WHERE ${cond}`, Object.values(filter));
      }
      default: {
        const store = this._modelData.get(modelName);
        if (!store) return [];
        return [...store.values()].filter((record) =>
          keys.every((k) => record[k] === filter[k])
        );
      }
    }
  }

  /**
   * Updates a record by ID.
   * @param {string} modelName
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateById(modelName, id, data) {
    data.updatedAt = new Date().toISOString();
    switch (this._type) {
      case 'mysql': return this.mysqlUpdate(modelName, data, 'id = ?', [id]);
      case 'pg': return this.pgUpdate(modelName, data, 'id = ?', [id]);
      case 'mongo': { const Model = this._getMongoModel(modelName); return Model.findByIdAndUpdate(id, data, { new: true }).lean(); }
      case 'sqlite': {
        const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ');
        await this.sqliteRun(`UPDATE ${modelName} SET ${sets} WHERE id = ?`, [...Object.values(data), id]);
        return this.findById(modelName, id);
      }
      default: {
        const store = this._modelData.get(modelName);
        const existing = store?.get(String(id));
        if (!existing) throw new Error(`Record ${id} not found in ${modelName}`);
        const updated = { ...existing, ...data };
        store.set(String(id), updated);
        return { ...updated };
      }
    }
  }

  /**
   * Deletes a record by ID.
   * @param {string} modelName
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async deleteById(modelName, id) {
    switch (this._type) {
      case 'mysql': { const r = await this.mysqlDelete(modelName, 'id = ?', [id]); return r.affectedRows > 0; }
      case 'pg': { const r = await this.pgDelete(modelName, 'id = ?', [id]); return r.length > 0; }
      case 'mongo': { const Model = this._getMongoModel(modelName); const r = await Model.findByIdAndDelete(id); return !!r; }
      case 'sqlite': { const r = await this.sqliteRun(`DELETE FROM ${modelName} WHERE id = ?`, [id]); return r.changes > 0; }
      default: { const store = this._modelData.get(modelName); return store ? store.delete(String(id)) : false; }
    }
  }

  // ─────────────────────────────────────────────
  // Auto-reconnect
  // ─────────────────────────────────────────────

  _autoReconnect(connectFn) {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('[DatabaseEngine] Max reconnect attempts reached. Giving up.');
      return;
    }
    this._reconnectAttempts++;
    const delay = this._reconnectDelay * this._reconnectAttempts;
    console.log(`[DatabaseEngine] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})...`);
    setTimeout(async () => {
      try {
        await connectFn();
        this._reconnectAttempts = 0;
        console.log('[DatabaseEngine] Reconnected successfully.');
      } catch (err) {
        console.error('[DatabaseEngine] Reconnect failed:', err.message);
        this._autoReconnect(connectFn);
      }
    }, delay);
  }

  // ─────────────────────────────────────────────
  // Close connection
  // ─────────────────────────────────────────────

  async close() {
    if (!this._connection) return;
    switch (this._type) {
      case 'mysql': await this._connection.end(); break;
      case 'pg': await this._connection.end(); break;
      case 'mongo': await mongoose.disconnect(); break;
      case 'redis': await this._connection.quit(); break;
      case 'sqlite': await new Promise((res, rej) => this._connection.close((e) => e ? rej(e) : res())); break;
    }
    this._connection = null;
    console.log('[DatabaseEngine] Connection closed.');
  }
}

module.exports = DatabaseEngine;

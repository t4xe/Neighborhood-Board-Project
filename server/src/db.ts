import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

export interface DbStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { lastInsertRowid: number; changes: number };
}

export interface Db {
  exec(sql: string): void;
  prepare(sql: string): DbStatement;
}

let db: SqlJsDatabase | null = null;
let dbWrapper: Db | null = null;

function rowToObject(columns: string[], values: unknown[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  columns.forEach((c, i) => { o[c] = values[i]; });
  return o;
}

function createStatement(sql: string, database: SqlJsDatabase, saveToFile: () => void): DbStatement {
  return {
    get(...params: unknown[]) {
      const stmt = database.prepare(sql);
      try {
        if (params.length) stmt.bind(params as number[]);
        if (stmt.step()) {
          const columns = stmt.getColumnNames();
          const values = stmt.get();
          return rowToObject(columns, values);
        }
        return undefined;
      } finally {
        stmt.free();
      }
    },
    all(...params: unknown[]) {
      const stmt = database.prepare(sql);
      const rows: Record<string, unknown>[] = [];
      try {
        if (params.length) stmt.bind(params as number[]);
        const columns = stmt.getColumnNames();
        while (stmt.step()) {
          rows.push(rowToObject(columns, stmt.get() as unknown[]));
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
    run(...params: unknown[]) {
      const stmt = database.prepare(sql);
      try {
        if (params.length) stmt.bind(params as (string | number | null)[]);
        stmt.step();
        stmt.free();
      } catch (e) {
        stmt.free();
        throw e;
      }
      const r = database.exec('SELECT last_insert_rowid() as id, changes() as changes');
      const id = r.length && r[0].values[0] ? (r[0].values[0][0] as number) : 0;
      const changes = r.length && r[0].values[0] ? (r[0].values[0][1] as number) : 0;
      saveToFile();
      return { lastInsertRowid: id, changes };
    },
  };
}

function createDbWrapper(database: SqlJsDatabase, saveToFile: () => void): Db {
  return {
    exec(sql: string) {
      database.run(sql);
      saveToFile();
    },
    prepare(sql: string) {
      return createStatement(sql, database, saveToFile);
    },
  };
}

export function getDb(): Db {
  if (!dbWrapper) throw new Error('Database not initialized. Call initDb() first.');
  return dbWrapper;
}

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      roles TEXT NOT NULL DEFAULT 'regular',
      types TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      rules TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      post_id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL,
      zone TEXT NOT NULL,
      geo_point TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(user_id),
      FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      edited_at TEXT,
      FOREIGN KEY (post_id) REFERENCES posts(post_id),
      FOREIGN KEY (author_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS reactions (
      reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(post_id, author_id),
      FOREIGN KEY (post_id) REFERENCES posts(post_id),
      FOREIGN KEY (author_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (actor_id) REFERENCES users(user_id)
    );
`;

export async function initDb(): Promise<void> {
  if (db) return;
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      const candidate = path.join(__dirname, '../../node_modules/sql.js/dist', file);
      if (fs.existsSync(candidate)) return candidate;
      return path.join(__dirname, '../node_modules/sql.js/dist', file);
    },
  });
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data.db');
  let data: Uint8Array | undefined;
  if (fs.existsSync(dbPath)) {
    data = new Uint8Array(fs.readFileSync(dbPath));
  }
  const database = new SQL.Database(data);
  db = database;
  const saveToFile = () => {
    if (db && dbPath) {
      try {
        const d = db.export();
        fs.writeFileSync(dbPath, Buffer.from(d));
      } catch (_) {}
    }
  };
  const originalRun = database.run.bind(database);
  database.run = function (sql: string, params?: (string | number | null)[]) {
    originalRun(sql, params);
    saveToFile();
  };
  dbWrapper = createDbWrapper(database, saveToFile);

  SCHEMA.split(');')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('CREATE'))
    .forEach((s) => database.run(s + ');'));

  const row = dbWrapper.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (row.c === 0) {
    database.run(`
      INSERT INTO categories (name, description) VALUES
        ('News', 'Community news and announcements'),
        ('Lost and Found', 'Lost or found items'),
        ('For Sale', 'Items for sale'),
        ('Services', 'Offered or requested services'),
        ('Events', 'Local events')
    `);
  }

  const userCount = dbWrapper.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    dbWrapper.prepare(`
      INSERT INTO users (email, password_hash, display_name, roles, status)
      VALUES (?, ?, 'Administrator', 'administrator', 'active')
    `).run('admin@example.com', hash);
  }

}

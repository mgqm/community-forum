// 数据库初始化模块 - 使用 SQLite (sql.js) 存储用户数据
// sql.js 是纯 JavaScript 实现，无需原生编译，跨平台可用
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'forum.db');

let db = null;       // SQL.js 数据库实例
let _SQL = null;     // SQL.js 模块引用

// 获取数据库实例（异步初始化，首次调用时加载 WASM）
async function getDb() {
  if (db) return db;

  // 初始化 SQL.js（加载 WebAssembly）
  _SQL = await initSqlJs();

  // 尝试从磁盘加载已有数据库文件
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new _SQL.Database(buffer);
  } else {
    db = new _SQL.Database();
  }

  // 创建用户表（如果不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      photo_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 持久化到磁盘
  saveDb();
  return db;
}

// 将数据库内容写入磁盘文件
function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDb, saveDb };

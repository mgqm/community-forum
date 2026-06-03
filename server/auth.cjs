// 用户认证 API 路由 - 处理注册、登录、获取当前用户
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb, saveDb } = require('./db.cjs');

const router = express.Router();

// JWT 密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'forum-dev-secret-key-2024';
const TOKEN_EXPIRY = '7d'; // Token 7 天过期

// 生成唯一用户 ID
function generateUid() {
  return crypto.randomUUID();
}

// 执行 SQL 查询并返回单行结果（对象格式）
function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

// JWT 认证中间件 - 验证请求头中的 Bearer token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将解析后的用户信息挂载到请求上
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// POST /api/auth/register - 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    const db = await getDb();

    // 参数校验
    if (!username || !password || !displayName) {
      return res.status(400).json({ error: '用户名、密码和昵称为必填项' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少需要 6 个字符' });
    }

    // 检查用户名是否已被注册
    const existing = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }

    // 创建新用户
    const uid = generateUid();
    const passwordHash = bcrypt.hashSync(password, 10);
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    const role = username === 'admin' ? 'admin' : 'user';

    db.run(
      'INSERT INTO users (id, email, username, password_hash, display_name, photo_url, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uid, username, username, passwordHash, displayName, photoUrl, role]
    );
    saveDb(); // 持久化到磁盘

    // 生成 JWT token
    const token = jwt.sign(
      { uid, email, displayName, photoURL: photoUrl, role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: { uid, email, displayName, photoURL: photoUrl, role }
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '服务器内部错误，注册失败' });
  }
});

// POST /api/auth/login - 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await getDb();

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    // 查找用户（支持用户名或邮箱）
    let user = queryOne(db, 'SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      user = queryOne(db, 'SELECT * FROM users WHERE email = ?', [username]);
    }
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 JWT token
    const token = jwt.sign(
      {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio,
        role: user.role
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器内部错误，登录失败' });
  }
});

// GET /api/auth/me - 获取当前登录用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user.uid]);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio,
        role: user.role
      }
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = { router, authMiddleware };

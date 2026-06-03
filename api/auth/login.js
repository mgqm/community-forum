// Vercel Serverless Function - 用户登录 POST /api/auth/login
import { getDb } from '../_lib/firebase-admin.js';
import { signToken, verifyPassword } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { username, email, password } = req.body;
    const loginName = username || email; // 兼容新旧前端

    if (!loginName || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const db = getDb();

    // 查找用户（支持用户名或邮箱登录）
    let snapshot = await db.collection('users')
      .where('username', '==', loginName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // 兼容旧数据：尝试用 email 字段查找
      snapshot = await db.collection('users')
        .where('email', '==', loginName)
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    // 验证密码
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成 JWT
    const token = signToken({
      uid: user.id,
      email: user.email || user.username,
      displayName: user.display_name,
      photoURL: user.photo_url,
      role: user.role
    });

    return res.json({
      message: '登录成功',
      token,
      user: {
        uid: user.id,
        email: user.email || user.username,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio || '',
        role: user.role
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    return res.status(500).json({ error: '服务器内部错误: ' + (err.message || '登录失败') });
  }
}

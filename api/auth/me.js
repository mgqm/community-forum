// Vercel Serverless Function - 获取当前用户 GET /api/auth/me
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '仅支持 GET 请求' });
  }

  // 从 Authorization header 提取 Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const db = getDb();

    // 从 Firestore 获取用户数据
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userDoc.data();

    return res.json({
      user: {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        photoURL: user.photo_url,
        bio: user.bio || '',
        role: user.role
      }
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    console.error('获取用户信息失败:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}

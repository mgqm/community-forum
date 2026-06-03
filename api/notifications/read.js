// POST /api/notifications/read - 标记通知已读
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    verifyToken(authHeader.split(' ')[1]);
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: '参数错误' });

    const db = getDb();
    await db.collection('notifications').doc(notificationId).update({ read: true });
    return res.json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

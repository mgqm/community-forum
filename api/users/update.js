// POST /api/users/update - 更新用户资料
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { displayName, bio, photoURL } = req.body;
    const db = getDb();

    const updateData = {};
    if (displayName !== undefined) updateData.display_name = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (photoURL !== undefined) updateData.photo_url = photoURL;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '无更新内容' });
    }

    await db.collection('users').doc(decoded.uid).update(updateData);
    return res.json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/posts/follow - 关注/取消关注
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { targetUserId, follow } = req.body;
    if (!targetUserId) return res.status(400).json({ error: '缺少 targetUserId' });

    const db = getDb();
    const uid = decoded.uid;
    const followingRef = db.collection('users').doc(uid).collection('following').doc(targetUserId);
    const followerRef = db.collection('users').doc(targetUserId).collection('followers').doc(uid);

    if (follow) {
      await followingRef.set({ userId: targetUserId, createdAt: new Date().toISOString() });
      await followerRef.set({ userId: uid, createdAt: new Date().toISOString() });
    } else {
      await followingRef.delete();
      await followerRef.delete();
    }

    return res.json({ success: true, following: follow });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/posts/like - 点赞/取消点赞
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: '缺少 postId' });

    const db = getDb();
    const likeRef = db.collection('posts').doc(postId).collection('likes').doc(decoded.uid);
    const likeDoc = await likeRef.get();

    if (likeDoc.exists) {
      await likeRef.delete();
      await db.collection('posts').doc(postId).update({ likesCount: admin.firestore.FieldValue.increment(-1) });
      return res.json({ liked: false });
    } else {
      await likeRef.set({ userId: decoded.uid, createdAt: new Date().toISOString() });
      await db.collection('posts').doc(postId).update({ likesCount: admin.firestore.FieldValue.increment(1) });
      return res.json({ liked: true });
    }
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/posts/delete - 删除帖子
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: '仅支持 DELETE' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: '缺少 postId' });

    const db = getDb();
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: '帖子不存在' });

    const post = postDoc.data();
    if (post.authorId !== decoded.uid) {
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (userDoc.data()?.role !== 'admin') return res.status(403).json({ error: '无权限' });
    }

    await postRef.delete();
    return res.json({ deleted: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

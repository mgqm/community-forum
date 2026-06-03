// POST /api/posts/update - 编辑帖子
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { postId, content, location, mediaUrl } = req.body;
    if (!postId || !content?.trim()) return res.status(400).json({ error: '参数错误' });

    const db = getDb();
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: '帖子不存在' });
    if (postDoc.data().authorId !== decoded.uid) return res.status(403).json({ error: '无权限' });

    await postRef.update({
      content: content.trim(),
      location: location || null,
      mediaUrl: mediaUrl || null
    });
    return res.json({ success: true });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

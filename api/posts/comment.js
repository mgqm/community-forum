// POST /api/posts/comment - 添加/删除评论
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const db = getDb();

    if (req.method === 'POST') {
      // 添加评论
      const { postId, content } = req.body;
      if (!postId || !content?.trim()) return res.status(400).json({ error: '参数错误' });

      const ref = await db.collection('posts').doc(postId).collection('comments').add({
        authorId: decoded.uid,
        authorName: decoded.displayName || 'Anonymous',
        authorPhoto: decoded.photoURL || '',
        content: content.trim(),
        createdAt: new Date().toISOString()
      });
      await db.collection('posts').doc(postId).update({ commentsCount: admin.firestore.FieldValue.increment(1) });
      return res.status(201).json({ commentId: ref.id });

    } else if (req.method === 'DELETE') {
      // 删除评论
      const { postId, commentId } = req.body;
      if (!postId || !commentId) return res.status(400).json({ error: '参数错误' });

      const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
      const commentDoc = await commentRef.get();
      if (!commentDoc.exists) return res.status(404).json({ error: '评论不存在' });

      const comment = commentDoc.data();
      if (comment.authorId !== decoded.uid) {
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        if (userDoc.data()?.role !== 'admin') return res.status(403).json({ error: '无权限' });
      }

      await commentRef.delete();
      await db.collection('posts').doc(postId).update({ commentsCount: admin.firestore.FieldValue.increment(-1) });
      return res.json({ deleted: true });
    }

    return res.status(405).json({ error: '方法不允许' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

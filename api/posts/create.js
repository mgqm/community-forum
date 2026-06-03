// Vercel Serverless Function - 创建帖子 POST /api/posts/create
// 通过 Firebase Admin SDK 写入 Firestore，绕过客户端安全规则
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  // 验证 JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const { content, location, mediaUrl, tags, moderationStatus, moderationScore } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '内容不能为空' });
    }

    const db = getDb();

    const postData = {
      authorId: decoded.uid,
      authorName: decoded.displayName || 'Anonymous',
      authorPhoto: decoded.photoURL || '',
      content: content.trim(),
      location: location || null,
      mediaUrl: mediaUrl || null,
      tags: tags || [],
      embedding: null,
      moderationStatus: moderationStatus || 'clean',
      moderationScore: moderationScore || 0,
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('posts').add(postData);

    return res.status(201).json({
      message: '发布成功',
      postId: docRef.id
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
    console.error('发布失败:', err);
    return res.status(500).json({ error: '服务器内部错误: ' + (err.message || '发布失败') });
  }
}

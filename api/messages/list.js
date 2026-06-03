// GET /api/messages/list - 获取会话列表和消息
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: '405' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const db = getDb();
    const { conversationId } = req.query || {};

    if (conversationId) {
      // 获取某个会话的消息
      const msgsSnap = await db.collection('conversations').doc(conversationId)
        .collection('messages').orderBy('createdAt', 'asc').get();
      const messages = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ messages });
    }

    // 获取当前用户的会话列表
    const convSnap = await db.collection('conversations')
      .where('participants', 'array-contains', decoded.uid)
      .orderBy('updatedAt', 'desc')
      .get();
    const conversations = convSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ conversations });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/messages/send - 发送私信
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { receiverId, content } = req.body;
    if (!receiverId || !content?.trim()) return res.status(400).json({ error: '参数错误' });

    const db = getDb();
    const uid = decoded.uid;
    const convId = [uid, receiverId].sort().join('_');
    const convRef = db.collection('conversations').doc(convId);

    const receiverDoc = await db.collection('users').doc(receiverId).get();
    if (!receiverDoc.exists) return res.status(404).json({ error: '用户不存在' });
    const receiverData = receiverDoc.data();

    // 发送消息
    const msgRef = await convRef.collection('messages').add({
      senderId: uid,
      senderName: decoded.displayName || 'Anonymous',
      content: content.trim(),
      createdAt: new Date().toISOString()
    });

    // 更新会话
    const convDoc = await convRef.get();
    const unreadCount = convDoc.exists ? (convDoc.data().unreadCount || {}) : {};
    unreadCount[receiverId] = (unreadCount[receiverId] || 0) + 1;

    await convRef.set({
      participants: [uid, receiverId],
      lastMessage: content.trim(),
      lastSenderId: uid,
      updatedAt: new Date().toISOString(),
      unreadCount
    }, { merge: true });

    return res.json({ messageId: msgRef.id, conversationId: convId });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(401).json({ error: '登录过期' });
    return res.status(500).json({ error: err.message });
  }
}

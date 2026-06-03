// POST /api/messages/read - 标记会话已读
import { getDb } from '../_lib/firebase-admin.js';
import { verifyToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '405' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: '参数错误' });

    const db = getDb();
    const convRef = db.collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();
    if (!convDoc.exists) return res.status(404).json({ error: '会话不存在' });

    const ucount = convDoc.data().unreadCount || {};
    ucount[decoded.uid] = 0;
    await convRef.update({ unreadCount: ucount });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

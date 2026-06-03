// Vercel Serverless Function - 用户注册 POST /api/auth/register
import { getDb } from '../_lib/firebase-admin.js';
import { generateUid, hashPassword, signToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { username, email, password, displayName } = req.body;
    const loginName = username || email;

    if (!loginName || !password || !displayName) {
      return res.status(400).json({ error: '用户名、密码和昵称为必填项' });
    }
    if (loginName.length < 2) {
      return res.status(400).json({ error: '用户名至少需要 2 个字符' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少需要 6 个字符' });
    }

    const db = getDb();

    const existing = await db.collection('users')
      .where('username', '==', loginName)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: '该用户名已被注册' });
    }

    const uid = generateUid();
    const passwordHash = hashPassword(password);
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    const role = loginName === 'admin' ? 'admin' : 'user';

    await db.collection('users').doc(uid).set({
      id: uid,
      username: loginName,
      email: loginName,
      password_hash: passwordHash,
      display_name: displayName,
      photo_url: photoUrl,
      bio: '',
      role,
      created_at: new Date().toISOString()
    });

    const token = signToken({
      uid,
      username: loginName,
      email: loginName,
      displayName,
      photoURL: photoUrl,
      role
    });

    return res.status(201).json({
      message: '注册成功',
      token,
      user: { uid, email: loginName, displayName, photoURL: photoUrl, role }
    });
  } catch (err) {
    console.error('注册失败:', err);
    return res.status(500).json({ error: '服务器内部错误: ' + (err.message || '注册失败') });
  }
}

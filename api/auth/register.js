// Vercel Serverless Function - 用户注册 POST /api/auth/register
// 将用户数据存储到 Firestore 的 users 集合
import { getDb } from '../_lib/firebase-admin.js';
import { generateUid, hashPassword, signToken } from '../_lib/auth-utils.js';

export default async function handler(req, res) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  try {
    const { email, password, displayName } = req.body;

    // 参数校验
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: '邮箱、密码和昵称为必填项' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少需要 6 个字符' });
    }

    const db = getDb();

    // 检查邮箱是否已被注册
    const existing = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    // 创建用户
    const uid = generateUid();
    const passwordHash = hashPassword(password);
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;
    const role = email === 'admin@root.com' ? 'admin' : 'user';

    const userData = {
      id: uid,
      email,
      password_hash: passwordHash,
      display_name: displayName,
      photo_url: photoUrl,
      bio: '',
      role,
      created_at: new Date().toISOString()
    };

    await db.collection('users').doc(uid).set(userData);

    // 生成 JWT
    const token = signToken({
      uid,
      email,
      displayName,
      photoURL: photoUrl,
      role
    });

    return res.status(201).json({
      message: '注册成功',
      token,
      user: { uid, email, displayName, photoURL: photoUrl, role }
    });
  } catch (err) {
    console.error('注册失败:', err);
    return res.status(500).json({ error: '服务器内部错误: ' + (err.message || '注册失败') });
  }
}

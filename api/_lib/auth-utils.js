// Vercel Serverless Functions - 认证工具（JWT + 密码哈希）
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'forum-dev-secret-key-2024';
const TOKEN_EXPIRY = '7d';

// 生成唯一用户 ID
export function generateUid() {
  return crypto.randomUUID();
}

// 密码哈希
export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// 密码验证
export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// 生成 JWT
export function signToken(user) {
  return jwt.sign(
    {
      uid: user.uid || user.id,
      email: user.email,
      displayName: user.displayName || user.display_name,
      photoURL: user.photoURL || user.photo_url || '',
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// 验证 JWT（中间件用）
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

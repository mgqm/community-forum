// Firebase 客户端初始化
// 仅用于 Firestore 数据存储（帖子、评论、消息等）
// 用户认证已迁移到本地 JWT + SQLite，不再使用 Firebase Auth
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// 使用长轮询模式解决某些网络环境下的代理问题
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

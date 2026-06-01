// Vercel Serverless Functions - Firebase Admin 初始化（服务端）
// 使用环境变量中的服务账号 JSON 访问 Firestore
import admin from 'firebase-admin';

let adminApp = null;

function getAdminApp() {
  if (adminApp) return adminApp;

  // 从环境变量中解析服务账号 JSON
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson || saJson === '{"type":"service_account","project_id":"..."}') {
    throw new Error('未配置 FIREBASE_SERVICE_ACCOUNT_JSON 环境变量');
  }

  try {
    const serviceAccount = JSON.parse(saJson);
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return adminApp;
  } catch (e) {
    throw new Error('Firebase Admin 初始化失败: ' + e.message);
  }
}

export function getDb() {
  return getAdminApp().firestore();
}

export function getAuth() {
  return getAdminApp().auth();
}

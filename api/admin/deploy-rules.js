// GET /api/admin/deploy-rules - 部署 Firestore 安全规则
// 此端点使用服务端 Firebase Admin SDK 发布规则
import { getAdminApp } from '../_lib/firebase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: '仅支持 GET' });

  try {
    const app = getAdminApp();

    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create, update, delete: if true;
    }
    match /posts/{postId}/likes/{likeId} {
      allow read, write: if true;
    }
    match /posts/{postId}/comments/{commentId} {
      allow read, write: if true;
    }
    match /posts/{postId}/comments/{commentId}/reactions/{reactionId} {
      allow read, write: if true;
    }
    match /users/{userId} {
      allow read: if true;
      allow create, update: if true;
    }
    match /users/{userId}/following/{targetId} {
      allow read, write: if true;
    }
    match /users/{userId}/followers/{followerId} {
      allow read, write: if true;
    }
    match /users/{userId}/likedPosts/{postId} {
      allow read, write: if true;
    }
    match /notifications/{notifId} {
      allow read, write: if true;
    }
    match /conversations/{convId} {
      allow read, write: if true;
    }
    match /conversations/{convId}/messages/{msgId} {
      allow read, write: if true;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

    await app.securityRules().releaseFirestoreRulesetFromSource(rules);
    return res.json({ message: 'Firestore 规则已部署！' });
  } catch (err) {
    return res.status(500).json({ error: '部署失败: ' + err.message });
  }
}

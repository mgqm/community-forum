// GET /api/admin/deploy-rules - 用 REST API 部署 Firestore 安全规则
import { getAdminApp } from '../_lib/firebase-admin.js';

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create, update, delete: if true;
    }
    match /posts/{postId}/likes/{likeId} { allow read, write: if true; }
    match /posts/{postId}/comments/{commentId} { allow read, write: if true; }
    match /posts/{postId}/comments/{commentId}/reactions/{reactionId} { allow read, write: if true; }
    match /users/{userId} { allow read: if true; allow create, update: if true; }
    match /users/{userId}/following/{targetId} { allow read, write: if true; }
    match /users/{userId}/followers/{followerId} { allow read, write: if true; }
    match /users/{userId}/likedPosts/{postId} { allow read, write: if true; }
    match /notifications/{notifId} { allow read, write: if true; }
    match /conversations/{convId} { allow read, write: if true; }
    match /conversations/{convId}/messages/{msgId} { allow read, write: if true; }
    match /{document=**} { allow read, write: if false; }
  }
}`;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: '405' });

  try {
    const app = getAdminApp();
    const projectId = app.options.projectId || 'opportune-geode-433915-b1';

    // 获取 access token
    const token = await app.options.credential.getAccessToken();

    // Step 1: 创建 ruleset
    const createRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: { files: [{ name: 'firestore.rules', content: RULES }] }
        })
      }
    );
    const ruleset = await createRes.json();
    if (!createRes.ok) return res.status(500).json({ error: '创建 ruleset 失败: ' + JSON.stringify(ruleset) });

    // Step 2: 发布 ruleset
    const rname = ruleset.name; // projects/{projectId}/rulesets/{id}
    const releaseRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `projects/${projectId}/releases/cloud.firestore`,
          ruleset_name: rname,
        })
      }
    );
    const release = await releaseRes.json();

    if (!releaseRes.ok) {
      return res.status(500).json({ error: '发布失败: ' + JSON.stringify(release) });
    }

    return res.json({ message: '规则已部署！', ruleset: name });
  } catch (err) {
    return res.status(500).json({ error: '部署失败: ' + err.message });
  }
}

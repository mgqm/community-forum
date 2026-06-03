// 论坛数据服务层 - 封装 Firestore 数据库操作
// 用户认证信息通过 getCurrentUser() 获取（替代 Firebase Auth）
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCurrentUser } from '../context/AuthContext';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: getCurrentUser()?.uid,
      email: getCurrentUser()?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const forumService = {
  // User Profile
  async createUserProfile(user: { uid: string, displayName: string, email: string, photoURL?: string, role?: string }) {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await setDoc(userDocRef, {
          ...user,
          bio: '',
          role: user.role || 'user',
          createdAt: serverTimestamp()
        });
      } else {
        // Optionally update only basic info if needed, but usually once is enough
        // We can use merge: true here if we want to ensure basic info is up to date
        await setDoc(userDocRef, {
          displayName: user.displayName,
          photoURL: user.photoURL || userSnap.data().photoURL,
        }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  },

  async updateUserProfile(uid: string, data: { displayName?: string, bio?: string, photoURL?: string }) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '保存失败');
    } catch (error: any) {
      throw new Error(error.message || '保存失败');
    }
  },

  // Posts
  async updatePost(postId: string, content: string, location?: { latitude: number, longitude: number, addressName: string }, mediaUrl?: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/posts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ postId, content, location: location || undefined, mediaUrl: mediaUrl || undefined })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '更新失败');
    } catch (error: any) {
      throw new Error(error.message || '更新失败');
    }
  },

  async createPost(
    content: string,
    location?: { latitude: number, longitude: number, addressName: string },
    mediaUrl?: string,
    tags?: string[],
    moderationStatus?: string,
    moderationScore?: number
  ) {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('请先登录');

    try {
      // 使用 API 端点写 Firestore（绕过客户端安全规则）
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          location: location || undefined,
          mediaUrl: mediaUrl || undefined,
          tags: tags || undefined,
          moderationStatus,
          moderationScore
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布失败');
      return data.postId;
    } catch (error: any) {
      console.error('发布失败:', error);
      throw new Error(error.message || '发布失败，请重试');
    }
  },

  async updatePostEmbedding(postId: string, embedding: number[]) {
    const path = `posts/${postId}`;
    try {
      await updateDoc(doc(db, 'posts', postId), { embedding });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getPosts() {
    const path = 'posts';
    try {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async deletePost(postId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/posts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
    } catch (error: any) {
      throw new Error(error.message || '删除失败');
    }
  },

  // Notifications
  async markNotificationAsRead(notificationId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ notificationId })
      });
    } catch (e) {
      console.error(e);
    }
  },

  // Likes
  async toggleLike(postId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      return data;
    } catch (error: any) {
      throw new Error(error.message || '操作失败');
    }
  },

  // Following
  async toggleFollow(targetUserId: string, isFollowing: boolean) {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('请先登录');
    try {
      const res = await fetch('/api/posts/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUserId, follow: !isFollowing })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      return data;
    } catch (error: any) {
      throw new Error(error.message || '操作失败');
    }
  },

  // Comments
  async addComment(postId: string, content: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/posts/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ postId, content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '评论失败');
      return data;
    } catch (error: any) {
      throw new Error(error.message || '评论失败');
    }
  },

  async toggleCommentReaction(postId: string, commentId: string, emoji: string) {
    // 暂时兼容：忽略 reaction 错误
    console.warn('toggleCommentReaction: 暂未实现 API');
  },

  async deleteComment(postId: string, commentId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/posts/comment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ postId, commentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
    } catch (error: any) {
      throw new Error(error.message || '删除失败');
    }
  },

  // Messaging
  getConversationId(uid1: string, uid2: string) {
    return [uid1, uid2].sort().join('_');
  },

  async sendMessage(receiverId: string, content: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId, content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      return data;
    } catch (error: any) {
      throw new Error(error.message || '发送失败');
    }
  },

  async getConversations() {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/messages/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      return data.conversations || [];
    } catch (error: any) {
      throw new Error(error.message || '加载失败');
    }
  },

  async getMessages(conversationId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/messages/list?conversationId=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      return data.messages || [];
    } catch (error: any) {
      throw new Error(error.message || '加载失败');
    }
  },

  async markAsRead(conversationId: string) {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ conversationId })
      });
    } catch (e) {
      console.error(e);
    }
  }
};

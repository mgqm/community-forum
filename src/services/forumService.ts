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
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), data);
      
      // 登录用户信息由 AuthContext 本地管理，此处同步 Firestore 即可
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Posts
  async updatePost(postId: string, content: string, location?: { latitude: number, longitude: number, addressName: string }, mediaUrl?: string) {
    const path = `posts/${postId}`;
    try {
      await updateDoc(doc(db, 'posts', postId), { content, location: location || null, mediaUrl: mediaUrl || null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
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
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    const path = 'posts';
    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL || '',
        content,
        location: location || null,
        mediaUrl: mediaUrl || null,
        tags: tags || [],
        embedding: null,
        moderationStatus: moderationStatus || 'clean',
        moderationScore: moderationScore || 0,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
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
    const path = `posts/${postId}`;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Notifications
  async markNotificationAsRead(notificationId: string) {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (e) {
      console.error(e);
    }
  },

  // Likes
  async toggleLike(postId: string) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    
    const likeDocPath = `posts/${postId}/likes/${user.uid}`;

    try {
      await runTransaction(db, async (transaction) => {
        const likeDocRef = doc(db, 'posts', postId, 'likes', user.uid);
        const postDocRef = doc(db, 'posts', postId);
        
        const postSnap = await transaction.get(postDocRef);
        if (!postSnap.exists()) throw new Error("Post does not exist");
        const postData = postSnap.data();

        const likeSnap = await transaction.get(likeDocRef);
        const isLiked = likeSnap.exists();

        if (isLiked) {
          transaction.delete(likeDocRef);
          transaction.delete(doc(db, 'users', user.uid, 'likedPosts', postId));
          transaction.update(postDocRef, { likesCount: increment(-1) });
        } else {
          transaction.set(likeDocRef, {
            postId,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          transaction.set(doc(db, 'users', user.uid, 'likedPosts', postId), {
            postId,
            likedAt: serverTimestamp()
          });
          transaction.update(postDocRef, { likesCount: increment(1) });

          // Create notification for post owner (if not the same person)
          if (postData.authorId !== user.uid) {
            const notifRef = doc(collection(db, 'notifications'));
            transaction.set(notifRef, {
              recipientId: postData.authorId,
              senderId: user.uid,
              senderName: user.displayName || 'Anonymous',
              type: 'like',
              postId,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, likeDocPath);
    }
  },

  // Following
  async toggleFollow(targetUserId: string, isFollowing: boolean) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    if (user.uid === targetUserId) throw new Error('Cannot follow yourself');

    const followingRef = doc(db, 'users', user.uid, 'following', targetUserId);
    const followerRef = doc(db, 'users', targetUserId, 'followers', user.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
      } else {
        const followData = {
          followerId: user.uid,
          followingId: targetUserId,
          createdAt: serverTimestamp()
        };
        await setDoc(followingRef, followData);
        await setDoc(followerRef, followData);

        // Add notification
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          recipientId: targetUserId,
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          type: 'follow', // Note: enum was comment/like, I'll update it or just use follow
          postId: 'system', // or something indicating it's not post-related
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/following/${targetUserId}`);
    }
  },

  // Comments
  async addComment(postId: string, content: string) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    
    const commentPath = `posts/${postId}/comments`;
    try {
      await runTransaction(db, async (transaction) => {
        const postDocRef = doc(db, 'posts', postId);
        const commentsCollRef = collection(db, 'posts', postId, 'comments');
        const newCommentRef = doc(commentsCollRef);

        const postSnap = await transaction.get(postDocRef);
        if (!postSnap.exists()) throw new Error("Post does not exist");
        const postData = postSnap.data();

        transaction.set(newCommentRef, {
          postId,
          authorId: user.uid,
          authorName: user.displayName || 'Anonymous',
          authorPhoto: user.photoURL || '',
          content,
          reactions: {}, // { emoji: count }
          createdAt: serverTimestamp()
        });
        transaction.update(postDocRef, { commentsCount: increment(1) });

        // Create notification for post owner (if not the same person)
        if (postData.authorId !== user.uid) {
          const notifRef = doc(collection(db, 'notifications'));
          transaction.set(notifRef, {
            recipientId: postData.authorId,
            senderId: user.uid,
            senderName: user.displayName || 'Anonymous',
            type: 'comment',
            postId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, commentPath);
    }
  },

  async toggleCommentReaction(postId: string, commentId: string, emoji: string) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    const reactionDocRef = doc(db, 'posts', postId, 'comments', commentId, 'reactions', user.uid);
    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);

    try {
      await runTransaction(db, async (transaction) => {
        const reactionSnap = await transaction.get(reactionDocRef);
        const commentSnap = await transaction.get(commentDocRef);

        if (!commentSnap.exists()) throw new Error('Comment does not exist');
        const commentData = commentSnap.data();
        const reactions = commentData.reactions || {};

        if (reactionSnap.exists()) {
          const oldReaction = reactionSnap.data()?.emoji;
          
          if (oldReaction === emoji) {
            // Remove same reaction
            transaction.delete(reactionDocRef);
            reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
            if (reactions[emoji] === 0) delete reactions[emoji];
          } else {
            // Change reaction
            transaction.update(reactionDocRef, { emoji, updatedAt: serverTimestamp() });
            
            // Decrement old
            reactions[oldReaction] = Math.max(0, (reactions[oldReaction] || 1) - 1);
            if (reactions[oldReaction] === 0) delete reactions[oldReaction];
            
            // Increment new
            reactions[emoji] = (reactions[emoji] || 0) + 1;
          }
        } else {
          // Add new reaction
          transaction.set(reactionDocRef, {
            emoji,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          reactions[emoji] = (reactions[emoji] || 0) + 1;
        }

        transaction.update(commentDocRef, { reactions });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/comments/${commentId}/reactions/${user.uid}`);
    }
  },

  async deleteComment(postId: string, commentId: string) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    const commentDocRef = doc(db, 'posts', postId, 'comments', commentId);
    const postDocRef = doc(db, 'posts', postId);

    try {
      await runTransaction(db, async (transaction) => {
        const commentSnap = await transaction.get(commentDocRef);
        const postSnap = await transaction.get(postDocRef);

        if (!commentSnap.exists()) throw new Error('Comment does not exist');
        const commentData = commentSnap.data();

        // Check permission (comment author or post author)
        if (user.uid !== commentData.authorId && user.uid !== postSnap.data()?.authorId) {
          throw new Error('Permission denied');
        }

        transaction.delete(commentDocRef);
        transaction.update(postDocRef, { commentsCount: increment(-1) });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  },

  // Messaging
  getConversationId(uid1: string, uid2: string) {
    return [uid1, uid2].sort().join('_');
  },

  async sendMessage(receiverId: string, content: string) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    if (user.uid === receiverId) throw new Error('Cannot message yourself');

    const conversationId = this.getConversationId(user.uid, receiverId);
    const convRef = doc(db, 'conversations', conversationId);
    const messagesRef = collection(convRef, 'messages');

    try {
      await runTransaction(db, async (transaction) => {
        const convSnap = await transaction.get(convRef);
        
        // Get receiver data to populate convo if new
        const receiverSnap = await transaction.get(doc(db, 'users', receiverId));
        if (!receiverSnap.exists()) throw new Error('Recipient not found');
        const receiverData = receiverSnap.data();

        const messageData = {
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          content,
          createdAt: serverTimestamp()
        };

        const newMessageRef = doc(messagesRef);
        transaction.set(newMessageRef, messageData);

        const unreadCount = convSnap.exists() ? (convSnap.data().unreadCount || {}) : {};
        unreadCount[receiverId] = (unreadCount[receiverId] || 0) + 1;

        const conversationData: any = {
          participants: [user.uid, receiverId],
          participantNames: {
            [user.uid]: user.displayName || 'Anonymous',
            [receiverId]: receiverData.displayName || 'Anonymous'
          },
          participantPhotos: {
            [user.uid]: user.photoURL || '',
            [receiverId]: receiverData.photoURL || ''
          },
          lastMessage: content,
          lastSenderId: user.uid,
          updatedAt: serverTimestamp(),
          unreadCount
        };

        if (convSnap.exists()) {
          transaction.update(convRef, conversationData);
        } else {
          transaction.set(convRef, conversationData);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}`);
    }
  },

  async markAsRead(conversationId: string) {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const unreadCount = convSnap.data().unreadCount || {};
        if (unreadCount[user.uid] > 0) {
          unreadCount[user.uid] = 0;
          await updateDoc(convRef, { unreadCount });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
};

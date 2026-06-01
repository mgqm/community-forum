// 用户个人主页 - 展示用户信息、帖子、关注/粉丝列表
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import { PostCard } from './Forum';
import { ArrowLeft, UserPlus, Users, Grid, Settings, X, Save, Heart, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { forumService } from '../services/forumService';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// User List Modal (Followers/Following)
function UserListModal({ isOpen, onClose, title, userIds }: { isOpen: boolean, onClose: () => void, title: string, userIds: string[] }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-natural-text/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-natural-border flex flex-col max-h-[70vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif font-bold text-natural-text">{title}</h2>
              <button onClick={onClose} className="p-2 hover:bg-natural-bg rounded-full transition-colors">
                <X size={20} className="text-natural-muted" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-2">
              {userIds.length > 0 ? (
                userIds.map(uid => <UserListItem key={uid} userId={uid} onSelect={onClose} />)
              ) : (
                <div className="text-center py-10 text-natural-muted italic text-sm">
                  暂无内容
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function UserListItem({ userId, onSelect }: { userId: string, onSelect: () => void, key?: string }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [userSnap] = useDocument(doc(db, 'users', userId));
  const userData = userSnap?.data();

  // Check if current user is following this member
  const [isFollowingSnap] = useDocument(
    currentUser && userId && currentUser.uid !== userId
      ? doc(db, 'users', currentUser.uid, 'following', userId)
      : null
  );
  const isFollowing = isFollowingSnap?.exists();

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't navigate to profile
    if (!currentUser) return;
    try {
      await forumService.toggleFollow(userId, !!isFollowing);
    } catch (e) {
      console.error(e);
    }
  };

  if (!userData) return <div className="h-12 bg-natural-bg rounded-2xl animate-pulse" />;

  return (
    <div 
      onClick={() => {
        navigate(`/profile/${userId}`);
        onSelect();
      }}
      className="w-full flex items-center gap-3 p-3 hover:bg-natural-bg rounded-2xl transition-all text-left cursor-pointer group"
    >
      <img src={userData.photoURL || undefined} alt="" className="w-10 h-10 rounded-full object-cover border border-natural-border shadow-sm group-hover:scale-105 transition-transform" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-natural-text truncate uppercase">{userData.displayName}</p>
        <p className="text-[10px] text-natural-muted font-medium">查看主页</p>
      </div>
      
      {currentUser && currentUser.uid !== userId && (
        <button 
          onClick={handleFollow}
          className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${
            isFollowing 
              ? 'bg-natural-bg text-natural-muted border border-natural-border hover:bg-red-50 hover:text-red-500 hover:border-red-100' 
              : 'bg-natural-primary text-white shadow-sm hover:bg-natural-primary/90'
          }`}
        >
          {isFollowing ? '取消关注' : '关注'}
        </button>
      )}
      
      <ArrowLeft size={16} className="text-natural-muted rotate-180 group-hover:translate-x-1 transition-transform" />
    </div>
  );
}

// Edit Profile Modal
function EditProfileModal({ isOpen, onClose, profile }: { isOpen: boolean, onClose: () => void, profile: any }) {
  const [displayName, setDisplayName] = React.useState(profile.displayName || '');
  const [bio, setBio] = React.useState(profile.bio || '');
  const [photoURL, setPhotoURL] = React.useState(profile.photoURL || '');
  const [loading, setLoading] = React.useState(false);

  const GIF_AVATARS = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKMGpxxyrqvXvY4/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlO39YkNoV5O80M/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKVUn7iM8FMEU24/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKp7tO8U7GpxZ9K/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKMGx0P5Z0Zk8ZG/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlJ8E53RUMcZqV2/giphy.gif',
    'https://media.giphy.com/media/fveK9uBVrASPUK3NAt/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/vfkv9HNBpWfzq/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/S9pB16zYfK5fL0I5Qf/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/13st7qhSyS6yFq/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzyTuYCmvSORqs1ABM/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeXpneXo5eGZzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JIX9t2j0ZTN9S/giphy.gif'
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      await forumService.updateUserProfile(profile.uid, { displayName, bio, photoURL });
      onClose();
    } catch (e) {
      console.error(e);
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-natural-text/20 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl border border-natural-border overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-serif font-bold text-natural-text">编辑资料</h2>
              <button onClick={onClose} className="p-2 hover:bg-natural-bg rounded-full transition-colors">
                <X size={20} className="text-natural-muted" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <img 
                    src={photoURL || undefined} 
                    alt="Preview" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-natural-border shadow-sm group-hover:scale-105 transition-transform" 
                  />
                  <div className="absolute inset-0 rounded-full bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold uppercase">预览</span>
                  </div>
                </div>
                
                <div className="w-full">
                  <label className="block text-[10px] font-bold text-natural-muted uppercase tracking-widest mb-3 text-center">选择 GIF 头像</label>
                  <div className="grid grid-cols-4 gap-2">
                    {GIF_AVATARS.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoURL(url)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          photoURL === url ? 'border-natural-primary scale-95 shadow-inner' : 'border-transparent hover:border-natural-muted/30'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="w-full">
                  <label className="block text-[10px] font-bold text-natural-muted uppercase tracking-widest mb-1 ml-2">自定义头像 URL</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full px-5 py-3 bg-natural-bg rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-natural-primary/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-natural-muted uppercase tracking-widest mb-1 ml-2">显示名称</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-5 py-3 bg-natural-bg rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-primary/20 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-natural-muted uppercase tracking-widest mb-1 ml-2">个人简介</label>
                <textarea 
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-5 py-3 bg-natural-bg rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-primary/20 transition-all font-medium resize-none"
                  placeholder="写点什么介绍一下你自己..."
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full mt-8 py-4 bg-natural-primary text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:bg-natural-primary/90 transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? '正在保存...' : '保存更改'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState('posts');
  const [likedPosts, setLikedPosts] = React.useState<any[]>([]);
  const [likedLoading, setLikedLoading] = React.useState(false);

  // Fetch liked posts when tab changes
  React.useEffect(() => {
    if (activeTab === 'liked' && userId) {
      setLikedLoading(true);
      const fetchLiked = async () => {
        try {
          const snap = await getDocs(query(collection(db, 'users', userId, 'likedPosts'), orderBy('likedAt', 'desc')));
          const postIds = snap.docs.map(doc => doc.id);
          
          if (postIds.length > 0) {
            // Fetch post details (limit to 30 for simplicity with 'in' query)
            const postsQuery = query(collection(db, 'posts'), where('__name__', 'in', postIds.slice(0, 30)));
            const postSnap = await getDocs(postsQuery);
            const postsData = postSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by likedAt
            const sortedPosts = postIds.slice(0, 30).map(id => postsData.find(p => p.id === id)).filter(Boolean);
            setLikedPosts(sortedPosts);
          } else {
            setLikedPosts([]);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLikedLoading(false);
        }
      };
      fetchLiked();
    }
  }, [activeTab, userId]);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isFollowersModalOpen, setIsFollowersModalOpen] = React.useState(false);
  const [isFollowingModalOpen, setIsFollowingModalOpen] = React.useState(false);

  // Fetch user profile data
  const [profileSnap, profileLoading] = useDocument(
    userId ? doc(db, 'users', userId) : null
  );
  const profile = profileSnap?.data();

  // Fetch user's posts
  const [postsSnap] = useCollection(
    userId 
      ? query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'))
      : null
  );
  const posts = postsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

  // Fetch following count
  const [followingSnap] = useCollection(
    userId ? collection(db, 'users', userId, 'following') : null
  );
  
  // Fetch followers count
  const [followersSnap] = useCollection(
    userId ? collection(db, 'users', userId, 'followers') : null
  );

  // Check if current user is following this profile
  const [isFollowingSnap] = useDocument(
    currentUser && userId && currentUser.uid !== userId
      ? doc(db, 'users', currentUser.uid, 'following', userId)
      : null
  );
  const isFollowing = isFollowingSnap?.exists();

  const handleFollow = async () => {
    if (!currentUser) return;
    if (!userId) return;
    try {
      await forumService.toggleFollow(userId, !!isFollowing);
    } catch (e) {
      console.error(e);
    }
  };

  if (profileLoading) return <div className="p-10 text-center">加载中...</div>;
  if (!profile) return <div className="p-10 text-center text-natural-muted italic">用户不存在</div>;

  return (
    <div className="min-h-screen bg-natural-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/50 backdrop-blur-md border-b border-natural-border px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-natural-bg rounded-full transition-colors">
            <ArrowLeft size={20} className="text-natural-primary" />
          </button>
          <h2 className="font-serif font-bold text-natural-text">{profile.displayName}</h2>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 pt-8">
        {/* Profile Card */}
        <div className="bg-white rounded-[32px] p-8 border border-natural-border shadow-sm mb-8">
          <div className="flex flex-col items-center text-center">
            <img 
              src={profile.photoURL || undefined} 
              alt="" 
              className="w-24 h-24 rounded-full border-4 border-natural-bg shadow-md mb-4 object-cover"
            />
            <h1 className="text-2xl font-serif font-bold text-natural-text mb-1">{profile.displayName}</h1>
            <p className="text-xs text-natural-muted font-medium mb-6">UID: {userId?.slice(0, 8)}</p>

            <div className="flex gap-8 mb-8">
              <div className="text-center group">
                <p className="text-xl font-bold text-natural-text">{posts.length}</p>
                <p className="text-[10px] text-natural-muted font-bold uppercase tracking-wider">动态</p>
              </div>
              <button 
                onClick={() => setIsFollowersModalOpen(true)}
                className="text-center group hover:bg-natural-bg/50 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <p className="text-xl font-bold text-natural-text group-hover:text-natural-primary transition-colors">{followersSnap?.size || 0}</p>
                <p className="text-[10px] text-natural-muted font-bold uppercase tracking-wider">粉丝</p>
              </button>
              <button 
                onClick={() => setIsFollowingModalOpen(true)}
                className="text-center group hover:bg-natural-bg/50 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <p className="text-xl font-bold text-natural-text group-hover:text-natural-primary transition-colors">{followingSnap?.size || 0}</p>
                <p className="text-[10px] text-natural-muted font-bold uppercase tracking-wider">关注</p>
              </button>
            </div>

            {currentUser?.uid === userId ? (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full py-3 bg-natural-bg text-natural-muted rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-natural-border transition-all"
              >
                <Settings size={16} />
                编辑资料
              </button>
            ) : (
              <div className="flex w-full gap-3">
                <button 
                  onClick={handleFollow}
                  className={`flex-[2] py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all group ${
                    isFollowing 
                      ? 'bg-white border-2 border-natural-border text-natural-muted hover:text-red-500 hover:border-red-200 hover:bg-red-50' 
                      : 'bg-natural-primary text-white shadow-md hover:bg-natural-primary/90 active:scale-95'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <span className="group-hover:hidden whitespace-nowrap">已关注</span>
                      <span className="hidden group-hover:inline whitespace-nowrap">取消关注</span>
                    </>
                  ) : (
                    <><UserPlus size={16} /> 关注作者</>
                  )}
                </button>
                <button 
                  onClick={() => {
                    if (currentUser && userId) {
                      navigate(`/messages/${forumService.getConversationId(currentUser.uid, userId)}`);
                    } else if (!currentUser) {
                      alert('请先登录');
                    }
                  }}
                  className="flex-1 py-3 bg-white border-2 border-natural-border text-natural-primary rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-natural-bg transition-all"
                  title="发送私信"
                >
                  <MessageSquare size={16} />
                  私信
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-natural-border mb-6">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'posts' ? 'text-natural-primary' : 'text-natural-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Grid size={14} /> 他的动态
            </div>
            {activeTab === 'posts' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('liked')}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'liked' ? 'text-natural-primary' : 'text-natural-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Heart size={14} className={activeTab === 'liked' ? 'fill-current' : ''} /> 赞过的
            </div>
            {activeTab === 'liked' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'about' ? 'text-natural-primary' : 'text-natural-muted'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users size={14} /> 关于 TA
            </div>
            {activeTab === 'about' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'posts' ? (
            <div className="space-y-6">
              {posts.length > 0 ? (
                posts.map((post: any) => <PostCard key={post.id} post={post} />)
              ) : (
                <div className="text-center py-20 bg-white/40 rounded-[32px] border border-white/20">
                  <p className="text-natural-muted font-serif italic">还没有发布过动态...</p>
                </div>
              )}
            </div>
          ) : activeTab === 'liked' ? (
            <div className="space-y-6">
              {likedLoading ? (
                <div className="p-10 text-center animate-pulse text-natural-muted font-medium">寻找记忆中...</div>
              ) : likedPosts.length > 0 ? (
                likedPosts.map((post: any) => <PostCard key={post.id} post={post} />)
              ) : (
                <div className="text-center py-20 bg-white/40 rounded-[32px] border border-white/20">
                  <p className="text-natural-muted font-serif italic">还没有收藏过精彩...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[32px] p-8 border border-natural-border shadow-sm">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-natural-muted uppercase tracking-widest mb-2">个人简介</h3>
                  <p className="text-sm text-natural-text leading-relaxed whitespace-pre-wrap">
                    {profile.bio || '这个人很懒，什么都没有留下。'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-natural-muted uppercase tracking-widest mb-2">加入时间</h3>
                  <p className="text-sm text-natural-text">
                    {profile.createdAt?.toDate ? format(profile.createdAt.toDate(), 'yyyy年 MMMM', { locale: zhCN }) : '探索者'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-natural-muted uppercase tracking-widest mb-2">UID</h3>
                  <p className="text-sm text-natural-text font-mono">
                    {userId}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        profile={{...profile, uid: userId}}
      />

      <UserListModal 
        isOpen={isFollowersModalOpen}
        onClose={() => setIsFollowersModalOpen(false)}
        title="粉丝列表"
        userIds={followersSnap?.docs.map(doc => doc.id) || []}
      />

      <UserListModal 
        isOpen={isFollowingModalOpen}
        onClose={() => setIsFollowingModalOpen(false)}
        title="关注列表"
        userIds={followingSnap?.docs.map(doc => doc.id) || []}
      />
    </div>
  );
}

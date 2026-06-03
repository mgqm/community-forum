// 社区互动论坛 - 主组件文件
// 包含：通知中心、消息徽章、登录弹窗、导航栏、图片预览、发帖、评论、帖子卡片、帖子列表
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, User as UserIcon, PlusCircle, MessageSquare, ThumbsUp, Trash2, Send, Image as ImageIcon, Bell, Search, UserPlus, Edit2, Share2, Check, MapPin, ShieldAlert } from 'lucide-react';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { useAuth } from '../context/AuthContext';
import { forumService } from '../services/forumService';
import { collection, query, orderBy, where, doc, deleteDoc, limit, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { checkContent } from '../services/ml/contentModeration';
import ModerationWarning from './ml/ModerationWarning';
import { smartCategorize } from '../services/ml/smartCategorization';
import CategoryBadge from './ml/CategoryBadge';
import UserAvatar from './UserAvatar';

// Notification Bell Component
export function Notifications() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  // Listen for unread notifications
  const [snapshot] = useCollection(
    user 
      ? query(
          collection(db, 'notifications'), 
          where('recipientId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      : null
  );

  const notifications = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markAllAsRead = async () => {
    notifications.forEach((n: any) => {
      if (!n.read) forumService.markNotificationAsRead(n.id);
    });
  };

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) markAllAsRead();
        }}
        className="relative p-2 text-natural-primary hover:bg-natural-bg rounded-full transition-colors"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-natural-border z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-natural-bg flex justify-between items-center">
                <span className="text-sm font-bold">通知中心</span>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] text-natural-primary font-bold uppercase tracking-wider">
                    全部已读
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((n: any) => (
                    <Link 
                      key={n.id} 
                      to={`/profile/${n.senderId}`}
                      className={`block p-3 border-b border-natural-bg last:border-0 transition-colors ${n.read ? 'opacity-60 bg-white' : 'bg-natural-bg/20'}`}
                    >
                      <div className="flex gap-2">
                        <span className="text-sm shrink-0">
                          {n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : '👤'}
                        </span>
                        <div className="space-y-0.5">
                          <p className="text-xs text-natural-text">
                            <span className="font-bold">{n.senderName}</span> {n.type === 'like' ? '赞了你的动态' : n.type === 'comment' ? '评论了你的动态' : '关注了你'}
                          </p>
                          <p className="text-[9px] text-natural-muted font-medium uppercase">
                            {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : '刚刚'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-natural-muted italic">
                    暂无通知
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Global Message Badge
function MessageBadge({ userId }: { userId: string }) {
  const [snapshot] = useCollection(
    query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    )
  );

  const conversations = snapshot?.docs.map(doc => doc.data()) || [];
  const totalUnread = conversations.reduce((acc, conv) => acc + (conv.unreadCount?.[userId] || 0), 0);

  if (totalUnread === 0) return null;

  return (
    <span className="absolute top-1 right-1 w-4 h-4 bg-natural-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
      {totalUnread > 9 ? '9+' : totalUnread}
    </span>
  );
}

// 登录弹窗组件 - 支持邮箱注册/登录，用户数据存储在 SQLite 数据库
export function LoginModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  // 弹窗关闭时重置表单状态
  React.useEffect(() => {
    if (!isOpen) {
      setMessage(null);
      setIsRegisterMode(false);
      setUsername('');
      setPassword('');
      setDisplayName('');
    }
  }, [isOpen]);

  // 邮箱登录/注册处理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (password.length < 6) {
        throw new Error('密码长度至少需要 6 个字符');
      }
      if (isRegisterMode) {
        if (!displayName.trim()) throw new Error('请输入昵称');
        await register(username, password, displayName.trim());
      } else {
        await login(username, password);
      }
      onClose();
    } catch (error: any) {
      setMessage(error.message || '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 管理员快捷登录（首次使用时自动注册管理员账号）
  const handleAdminLogin = async () => {
    setMessage(null);
    setIsLoading(true);
    try {
      try {
        await login('admin', 'admin123456');
      } catch (e: any) {
        // 如果管理员账号不存在，自动创建
        if (e.message.includes('用户名或密码错误')) {
          await register('admin', 'admin123456', 'ROOT 管理员');
        } else {
          throw e;
        }
      }
      onClose();
    } catch (e: any) {
      setMessage(e.message || '管理员登录失败');
    } finally {
      setIsLoading(false);
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
            className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl border border-natural-border"
          >
            {/* 标题区域 */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-serif font-bold text-natural-primary mb-2">
                {isRegisterMode ? '创建账户' : '欢迎回来'}
              </h2>
              <p className="text-xs text-natural-muted font-medium">加入 ROOT 社区，记录精彩时刻</p>
            </div>

            {/* 错误提示 */}
            {message && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-3 bg-red-50 text-red-600 text-[10px] rounded-xl font-bold leading-relaxed border border-red-100"
              >
                {message}
              </motion.div>
            )}

            {/* 邮箱登录/注册表单 */}
            <form onSubmit={handleAuth} className="space-y-4 mb-6">
              {isRegisterMode && (
                <input
                  type="text"
                  placeholder="昵称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-natural-bg rounded-2xl px-5 py-3 text-xs border border-transparent focus:border-natural-primary/20 outline-none"
                  required
                />
              )}
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-natural-bg rounded-2xl px-5 py-3 text-xs border border-transparent focus:border-natural-primary/20 outline-none"
                required
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-natural-bg rounded-2xl px-5 py-3 text-xs border border-transparent focus:border-natural-primary/20 outline-none"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-natural-primary text-white rounded-2xl text-xs font-bold shadow-lg shadow-natural-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {isLoading ? '处理中...' : (isRegisterMode ? '立即注册' : '登录')}
              </button>
            </form>

            {/* 分隔线 */}
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-natural-border"></div>
              </div>
              <span className="relative px-4 text-[10px] font-bold text-natural-muted bg-white uppercase tracking-widest">
                快捷操作
              </span>
            </div>

            {/* 管理员快捷登录按钮 */}
            {!isRegisterMode && (
              <button
                onClick={handleAdminLogin}
                type="button"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl text-[10px] font-bold hover:bg-amber-100 transition-all uppercase tracking-widest disabled:opacity-50"
              >
                <span>{isLoading ? '连接中...' : '管理员快捷登录'}</span>
              </button>
            )}

            {/* 注册/登录模式切换 */}
            <div className="mt-8 text-center space-y-2">
              <button
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-[11px] text-natural-primary font-bold hover:underline"
              >
                {isRegisterMode ? '已有账号？立即登录' : '没有账号？创建免费账户'}
              </button>
              <button
                onClick={onClose}
                className="block w-full text-[10px] text-natural-muted hover:text-natural-primary transition-colors font-medium uppercase tracking-widest"
              >
                稍后再说
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Navbar Component
export function Navbar({
  searchQuery,
  setSearchQuery,
  searchMode,
  setSearchMode,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchMode: 'keyword' | 'semantic';
  setSearchMode: (mode: 'keyword' | 'semantic') => void;
}) {
  const { user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const [localQuery, setLocalQuery] = React.useState(searchQuery);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 500);

    return () => clearTimeout(handler);
  }, [localQuery, setSearchQuery]);

  // Sync local query if search query changes externally (e.g. clearing)
  React.useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/50 backdrop-blur-md border-b border-natural-border px-8 py-3">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-8">
          <div className="flex items-center gap-8 flex-1">
            <Link to="/" className="text-2xl font-serif font-bold text-natural-primary tracking-tight shrink-0 hidden sm:block">
              ROOTS
            </Link>

            <div className="relative flex-1 max-w-md flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-natural-muted w-4 h-4" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder={searchMode === 'semantic' ? '语义搜索...' : '搜索动态或分类...'}
                  className="w-full bg-natural-input/80 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-natural-primary/20 transition-all font-medium"
                />
              </div>
              <button
                onClick={() => setSearchMode(searchMode === 'keyword' ? 'semantic' : 'keyword')}
                className={`flex-shrink-0 text-[10px] font-bold px-2 py-1.5 rounded-full transition-all ${
                  searchMode === 'semantic'
                    ? 'bg-natural-primary text-white'
                    : 'bg-white border border-natural-border text-natural-muted hover:border-natural-primary'
                }`}
                title={searchMode === 'keyword' ? '切换到语义搜索' : '切换到关键词搜索'}
              >
                {searchMode === 'keyword' ? '关键词' : '语义'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link 
                  to="/messages" 
                  className="relative p-2 text-natural-primary hover:bg-natural-bg rounded-full transition-colors"
                  title="私信"
                >
                  <MessageSquare size={22} />
                  <MessageBadge userId={user.uid} />
                </Link>
                <Notifications />
                <div className="h-4 w-[1px] bg-natural-border mx-1" />
                <Link to={`/profile/${user.uid}`} className="flex items-center gap-4">
                  <UserAvatar uid={user.uid} fallback={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                </Link>
                <button 
                  onClick={() => logout()}
                  className="flex items-center gap-2 text-sm font-medium text-natural-muted hover:text-red-700 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-2 px-5 py-2 bg-natural-primary text-white rounded-full text-sm font-medium hover:bg-natural-primary-dark transition-all"
              >
                <LogIn size={18} />
                <span>登录</span>
              </button>
            )}
          </div>
        </div>
      </nav>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}

// Image Zoom Modal
export function ImageZoomModal({ isOpen, onClose, src }: { isOpen: boolean, onClose: () => void, src: string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl cursor-zoom-out"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center pointer-events-none"
          >
            <img 
              src={src} 
              alt="Zoomed" 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl pointer-events-auto"
            />
            <button 
              onClick={onClose}
              className="absolute -top-4 -right-4 p-2 bg-white rounded-full shadow-lg text-natural-text hover:text-natural-primary transition-colors pointer-events-auto"
            >
              <PlusCircle className="rotate-45" size={24} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// CreatePost Component
export function CreatePost() {
  const { user } = useAuth();
  const [content, setContent] = React.useState('');
  const [location, setLocation] = React.useState<{ latitude: number, longitude: number, addressName: string } | null>(null);
  const [isLocating, setIsLocating] = React.useState(false);
  const [mediaUrl, setMediaUrl] = React.useState('');
  const [showMediaInput, setShowMediaInput] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 内容审核状态
  const [isModerating, setIsModerating] = React.useState(false);
  const [moderationResult, setModerationResult] = React.useState<any>(null);
  const [showModerationWarning, setShowModerationWarning] = React.useState(false);
  const [pendingPublish, setPendingPublish] = React.useState(false);

  // 智能分类状态
  const [assignedTags, setAssignedTags] = React.useState<string[]>([]);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理位置服务');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          setLocation({
            latitude,
            longitude,
            addressName: `坐标: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
        } catch (error) {
          console.error(error);
          setLocation({
            latitude,
            longitude,
            addressName: '未知地点'
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        alert('无法获取位置，请检查权限设置');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片过大，请选择 2MB 以下的图片');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result as string);
        setShowMediaInput(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // 执行发布（审核通过后调用）
  const doPublish = async (forcePublish = false, moderationStatus = 'clean', moderationScore = 0) => {
    setIsSubmitting(true);
    try {
      const postId = await forumService.createPost(
        content,
        location || undefined,
        mediaUrl || undefined,
        assignedTags.length > 0 ? assignedTags : undefined,
        moderationStatus,
        moderationScore
      );
      setContent('');
      setMediaUrl('');
      setLocation(null);
      setShowMediaInput(false);
      setAssignedTags([]);
      setModerationResult(null);

      // 异步生成嵌入向量（不阻塞发布流程）
      if (postId) {
        import('../services/ml/semanticSearch').then(({ generateDocumentEmbedding }) => {
          generateDocumentEmbedding(content).then(embedding => {
            if (embedding) {
              forumService.updatePostEmbedding(postId, embedding);
            }
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch (error) {
      alert('发布失败，请重试');
    } finally {
      setIsSubmitting(false);
      setPendingPublish(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    // 执行内容审核
    setIsModerating(true);
    try {
      const result = await checkContent(content);
      setModerationResult(result);

      if (!result.isClean) {
        // 内容有问题，显示警告弹窗
        setPendingPublish(true);
        setShowModerationWarning(true);
        setIsModerating(false);
        return;
      }
    } catch (err) {
      // 审核失败，允许发布但标记为未审核
      console.warn('内容审核失败，允许发布:', err);
    }
    setIsModerating(false);

    // 内容审核通过，尝试分类
    try {
      const catResult = await smartCategorize(content);
      if (catResult.tags.length > 0) {
        setAssignedTags(catResult.tags);
      }
    } catch (err) {
      // 分类失败不影响发布
    }

    await doPublish(false, 'clean', moderationResult?.score || 0);
  };

  // 用户坚持发布（忽略审核警告）
  const handleProceedAnyway = async () => {
    setShowModerationWarning(false);
    // 尝试分类
    try {
      const catResult = await smartCategorize(content);
      if (catResult.tags.length > 0) {
        setAssignedTags(catResult.tags);
      }
    } catch (err) {}
    await doPublish(true, 'flagged', moderationResult?.score || 0);
  };

  if (!user) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-6 shadow-sm border border-white/40 mb-8"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <UserAvatar uid={user.uid} fallback={user.photoURL} className="w-12 h-12 rounded-full border-2 border-natural-bg" />
            <div className="flex-1 space-y-3">
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setAssignedTags([]); }}
                placeholder="分享你的想法..."
                className="w-full bg-natural-input rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-natural-primary/10 resize-none h-28"
              />
              {location && (
                <div className="flex items-center gap-2 px-3 py-1 bg-natural-primary/5 rounded-full w-fit">
                  <MapPin size={12} className="text-natural-primary" />
                  <span className="text-[10px] font-bold text-natural-primary">{location.addressName}</span>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-natural-muted hover:text-red-500 transition-colors"
                  >
                    <PlusCircle size={12} className="rotate-45" />
                  </button>
                </div>
              )}
              {/* 自动分类标签预览 */}
              {assignedTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-text">自动标记：</span>
                  {assignedTags.map(tag => (
                    <React.Fragment key={tag}><CategoryBadge label={tag} /></React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showMediaInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3"
              >
                <div className="relative inline-block w-40 h-40 rounded-2xl overflow-hidden border border-natural-border group">
                  {mediaUrl && <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />}
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="或者输入图片链接 (URL)..."
                  className="w-full bg-natural-input rounded-xl px-4 py-2 text-[10px] border border-transparent focus:border-natural-border focus:outline-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between items-center pt-2 border-t border-natural-bg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors ${mediaUrl ? 'bg-natural-primary text-white' : 'text-natural-muted hover:bg-natural-bg'}`}
              >
                <ImageIcon size={18} />
                <span className="hidden sm:inline">图片</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              <button
                type="button"
                onClick={fetchLocation}
                disabled={isLocating}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-colors ${location ? 'bg-natural-primary text-white' : 'text-natural-muted hover:bg-natural-bg'}`}
              >
                <MapPin size={18} />
                <span className="hidden sm:inline">{isLocating ? '获取中...' : '定位'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className="text-xs text-natural-muted hover:text-natural-primary px-2"
              >
                {showMediaInput ? '收起' : 'URL'}
              </button>
              {/* 审核状态指示 */}
              {isModerating && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <ShieldAlert size={12} />
                  检查中...
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting || isModerating}
              className="bg-natural-primary text-white px-8 py-2 rounded-full text-sm font-medium hover:bg-natural-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-natural-primary/20"
            >
              {isModerating ? '检查中...' : isSubmitting ? '发布中...' : '发布'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* 内容审核警告弹窗 */}
      <ModerationWarning
        isOpen={showModerationWarning}
        result={moderationResult}
        onGoBack={() => {
          setShowModerationWarning(false);
          setPendingPublish(false);
        }}
        onProceedAnyway={handleProceedAnyway}
      />
    </>
  );
}

// Comment Item
export function CommentItem({ comment, postAuthorId, postId }: { comment: any, postAuthorId: string, postId: string, key?: string }) {
  const { user } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const REACTION_EMOJIS = ['❤️', '👏', '🔥', '😂', '😮'];

  const handleToggleReaction = async (emoji: string) => {
    if (!user) return;
    try {
      await forumService.toggleCommentReaction(postId, comment.id, emoji);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSub = async () => {
    if (!window.confirm('确定删除这条评论吗？')) return;
    setIsDeleting(true);
    try {
      await forumService.deleteComment(postId, comment.id);
    } catch (e) {
      console.error(e);
      alert('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to linkify mentions (@username)
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        // We don't have user ID here easily, so we link to a search or a common profile route if we had one.
        // For simplicity, let's assume we can search by username or just style it.
        return (
          <span key={i} className="text-natural-primary font-bold cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="group flex gap-3 py-4 border-b border-natural-bg last:border-0 hover:bg-natural-bg/30 px-3 rounded-2xl transition-colors relative">
      <Link to={`/profile/${comment.authorId}`}>
        <UserAvatar uid={comment.authorId} fallback={comment.authorPhoto} className="w-9 h-9 rounded-full shrink-0 border border-white" />
      </Link>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/profile/${comment.authorId}`} className="text-xs font-bold text-natural-text hover:text-natural-primary truncate">
              {comment.authorName}
            </Link>
            {comment.authorId === postAuthorId && (
              <span className="text-[9px] bg-natural-primary/10 text-natural-primary px-1.5 py-0.5 rounded-md font-bold uppercase tracking-widest whitespace-nowrap">
                作者
              </span>
            )}
          </div>
          <span className="text-[10px] text-natural-muted font-medium whitespace-nowrap">
            {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : '刚刚'}
          </span>
          {user && (user.uid === comment.authorId || user.uid === postAuthorId) && (
            <button 
              onClick={handleDeleteSub}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 p-1 text-natural-muted hover:text-red-500 transition-all rounded-md hover:bg-red-50 ml-1"
              title="删除评论"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <p className="text-sm text-natural-text/80 break-words leading-relaxed">
          {renderContent(comment.content)}
        </p>

        {/* Reactions Section */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {comment.reactions && Object.entries(comment.reactions).map(([emoji, count]: [string, any]) => (
            count > 0 && (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(emoji)}
                className="flex items-center gap-1 bg-natural-bg/50 px-2 py-0.5 rounded-full text-xs hover:bg-natural-bg transition-colors border border-transparent hover:border-natural-border"
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-bold text-natural-muted">{count}</span>
              </button>
            )
          ))}
          
          {user && (
            <div className="relative">
              <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="opacity-0 group-hover:opacity-100 p-1 text-natural-muted hover:text-natural-primary transition-all rounded-full hover:bg-natural-bg"
              >
                <PlusCircle size={14} />
              </button>
              
              <AnimatePresence>
                {showEmojiPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 5 }}
                      className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-lg border border-natural-border px-2 py-1 flex gap-1 z-20 whitespace-nowrap"
                    >
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            handleToggleReaction(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="hover:scale-125 transition-transform p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Post Card Component
export function PostCard({ post }: { post: any, key?: string }) {
  const { user } = useAuth();
  const [showComments, setShowComments] = React.useState(false);
  const [commentContent, setCommentContent] = React.useState('');
  const [mentionSuggestions, setMentionSuggestions] = React.useState<any[]>([]);
  const [showMentions, setShowMentions] = React.useState(false);
  const [isLiking, setIsLiking] = React.useState(false);
  const [isFollowLoading, setIsFollowLoading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(post.content);
  const [editMediaUrl, setEditMediaUrl] = React.useState(post.mediaUrl || '');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [showShareToast, setShowShareToast] = React.useState(false);
  const [isImageZoomed, setIsImageZoomed] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [userDoc] = useDocument(user ? doc(db, 'users', user.uid) : null);
  const isAdmin = userDoc?.data()?.role === 'admin';
  const isAuthor = user?.uid === post.authorId;
  const canManage = isAuthor || isAdmin;

  // Sync edit state with post props when post changes
  React.useEffect(() => {
    setEditContent(post.content);
    setEditMediaUrl(post.mediaUrl || '');
  }, [post.content, post.mediaUrl]);

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片过大，请选择 2MB 以下的图片');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditMediaUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `${post.authorName} 的动态 - ROOTS`,
      text: post.content.slice(0, 100),
      url: `${window.location.origin}/profile/${post.authorId}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  // Check if current user liked this post
  const [likesSnapshot] = useCollection(
    user ? query(collection(db, 'posts', post.id, 'likes'), where('userId', '==', user.uid)) : null
  );
  const isLiked = (likesSnapshot?.docs.length ?? 0) > 0;

  // Check if following author
  const [followSnapshot] = useDocument(
    user ? doc(db, 'users', user.uid, 'following', post.authorId) : null
  );
  const isFollowing = followSnapshot?.exists();

  const handleToggleFollow = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    if (isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      await forumService.toggleFollow(post.authorId, !!isFollowing);
    } catch (e: any) {
      console.error(e);
      alert('关注失败: ' + (e.message || '未知错误'));
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Comments stream
  const [commentsSnapshot] = useCollection(
    query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'))
  );
  const comments = commentsSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

  const handleLike = async () => {
    if (!user) {
      alert('请先登录');
      return;
    }
    if (isLiking) return;
    setIsLiking(true);
    try {
      await forumService.toggleLike(post.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('请先登录');
      return;
    }
    if (!commentContent.trim()) return;
    try {
      await forumService.addComment(post.id, commentContent);
      setCommentContent('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('确定删除这条动态吗？')) {
      try {
        await forumService.deletePost(post.id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim() || isUpdating) return;
    setIsUpdating(true);
    try {
      await forumService.updatePost(post.id, editContent, post.location, editMediaUrl);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('更新失败');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[32px] shadow-sm border border-white/40 overflow-hidden mb-8"
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/profile/${post.authorId}`}>
            <UserAvatar uid={post.authorId} fallback={post.authorPhoto} className="w-12 h-12 rounded-full border-2 border-natural-bg object-cover" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.authorId}`} className="text-sm font-bold text-natural-text hover:text-natural-primary">
                {post.authorName}
              </Link>
              {isAdmin && post.authorId === user?.uid && (
                <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-200">Admin</span>
              )}
              {user && user.uid !== post.authorId && (
                <button
                  onClick={handleToggleFollow}
                  disabled={isFollowLoading}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                    isFollowing 
                      ? 'border-natural-border text-natural-muted bg-white' 
                      : 'border-natural-primary text-natural-primary hover:bg-natural-primary hover:text-white'
                  }`}
                >
                  {isFollowLoading ? '...' : isFollowing ? '已关注' : '+ 关注'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-natural-muted font-medium uppercase tracking-wider">
                {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : '刚刚'}
              </p>
              {post.location && (
                <div className="flex items-center gap-1 text-[10px] text-natural-primary font-bold">
                  <span className="w-0.5 h-0.5 bg-natural-muted rounded-full" />
                  <MapPin size={10} />
                  <span>{post.location.addressName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            {isAuthor && (
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`p-2 transition-colors ${isEditing ? 'text-natural-primary' : 'text-natural-muted hover:text-natural-primary'}`}
              >
                <Edit2 size={18} />
              </button>
            )}
            <button 
              onClick={() => {
                if (window.confirm(isAdmin && !isAuthor ? '确定要以管理员身份删除此内容吗？' : '确定要删除这条动态吗？')) {
                  forumService.deletePost(post.id);
                }
              }} 
              className="p-2 text-natural-muted hover:text-red-500 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-6 pb-3 flex items-center gap-1.5 flex-wrap">
          {post.tags.map((tag: string) => (
            <React.Fragment key={tag}><CategoryBadge label={tag} /></React.Fragment>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-6 pb-6 space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-natural-bg rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-natural-primary/10 resize-none h-32"
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-natural-muted uppercase ml-2">媒体内容</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-natural-bg hover:bg-natural-border rounded-xl text-[10px] font-bold transition-colors"
                >
                  更换图片
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleEditFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {editMediaUrl && (
                  <button
                    type="button"
                    onClick={() => setEditMediaUrl('')}
                    className="px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-[10px] font-bold transition-colors"
                  >
                    移除图片
                  </button>
                )}
              </div>
              <input
                type="text"
                value={editMediaUrl}
                onChange={(e) => setEditMediaUrl(e.target.value)}
                placeholder="图片链接 (URL)..."
                className="w-full bg-natural-bg rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-natural-primary/10"
              />
              {editMediaUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-natural-bg h-24 w-40 relative group">
                  <img 
                    src={editMediaUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold uppercase">预览</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(post.content);
                  setEditMediaUrl(post.mediaUrl || '');
                }}
                className="px-4 py-1.5 text-xs font-bold text-natural-muted hover:bg-natural-bg rounded-full transition-all"
              >
                取消
              </button>
              <button 
                onClick={handleUpdate}
                disabled={isUpdating || !editContent.trim()}
                className="px-6 py-1.5 text-xs font-bold bg-natural-primary text-white rounded-full shadow-md hover:bg-natural-primary-dark transition-all disabled:opacity-50"
              >
                {isUpdating ? '保存中...' : '提交修改'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-natural-text leading-relaxed whitespace-pre-wrap">{post.content}</p>
            {post.mediaUrl && (
              <>
                <div 
                  className="rounded-[24px] overflow-hidden border border-natural-bg cursor-zoom-in hover:opacity-95 transition-opacity"
                  onClick={() => setIsImageZoomed(true)}
                >
                  <img 
                    src={post.mediaUrl} 
                    alt="" 
                    className="w-full max-h-[400px] object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
                <ImageZoomModal 
                  isOpen={isImageZoomed} 
                  onClose={() => setIsImageZoomed(false)} 
                  src={post.mediaUrl} 
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-natural-bg/30 flex items-center gap-8 border-t border-natural-bg/50">
        <button 
          onClick={handleLike}
          className={`group flex items-center gap-2 transition-colors ${isLiked ? 'text-red-500' : 'text-natural-primary hover:text-red-500'}`}
        >
          <ThumbsUp size={20} className={isLiked ? 'fill-current' : ''} />
          <span className="text-xs font-bold">{post.likesCount || 0}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-natural-primary hover:text-brown-700 transition-colors"
        >
          <MessageSquare size={20} />
          <span className="text-xs font-bold">{post.commentsCount || 0}</span>
        </button>

        <button 
          onClick={handleShare}
          className="flex items-center gap-2 text-natural-primary hover:text-brown-700 transition-colors relative"
        >
          {showShareToast ? <Check size={20} className="text-green-500" /> : <Share2 size={20} />}
          <span className="text-xs font-bold">{showShareToast ? '已复制' : '分享'}</span>
          
          <AnimatePresence>
            {showShareToast && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-natural-text text-white text-[10px] py-1.5 px-3 rounded-full whitespace-nowrap shadow-lg z-20 flex items-center gap-2 border border-white/20"
              >
                <Check size={12} strokeWidth={3} />
                链接已复制
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-natural-bg/50 bg-white"
          >
            <div className="p-6 space-y-6">
              {/* Comment Form */}
              {user && (
                <form onSubmit={handleCommentSubmit} className="flex gap-4">
                  <UserAvatar uid={user.uid} fallback={user.photoURL} className="w-10 h-10 rounded-full border border-natural-bg" />
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={commentContent}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommentContent(val);
                          
                          // Mention logic
                          const lastAt = val.lastIndexOf('@');
                          if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
                            const query = val.slice(lastAt + 1).split(' ')[0];
                            // Filter unique commenters
                            const uniqueCommenters = Array.from(new Set(comments.map((c: any) => c.authorName)))
                              .map(name => comments.find((c: any) => c.authorName === name))
                              .filter((c: any) => c && c.authorName.toLowerCase().includes(query.toLowerCase()) && c.authorId !== user.uid);
                            
                            setMentionSuggestions(uniqueCommenters);
                            setShowMentions(uniqueCommenters.length > 0);
                          } else {
                            setShowMentions(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setShowMentions(false);
                        }}
                        placeholder="加入讨论..."
                        className="w-full bg-natural-input border border-transparent rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-natural-primary"
                      />

                      <AnimatePresence>
                        {showMentions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-natural-border overflow-hidden z-20"
                          >
                            <div className="p-2 bg-natural-bg/50 border-b border-natural-border text-[9px] font-bold text-natural-muted uppercase tracking-wider">
                              提及用户
                            </div>
                            {mentionSuggestions.map((c: any) => (
                              <button
                                key={c.authorId}
                                type="button"
                                onClick={() => {
                                  const lastAt = commentContent.lastIndexOf('@');
                                  const newVal = commentContent.slice(0, lastAt) + '@' + c.authorName + ' ';
                                  setCommentContent(newVal);
                                  setShowMentions(false);
                                }}
                                className="w-full flex items-center gap-2 p-2 hover:bg-natural-bg text-left transition-colors"
                              >
                                <UserAvatar uid={c.authorId} fallback={c.authorPhoto} className="w-6 h-6 rounded-full border border-white" />
                                <span className="text-xs font-medium text-natural-text truncate">{c.authorName}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button 
                      type="submit"
                      disabled={!commentContent.trim()}
                      className="bg-natural-primary text-white p-2 rounded-xl disabled:opacity-30 self-center"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              )}

              {/* List */}
              <div className="space-y-1">
                {comments.length > 0 ? (
                  comments.map(c => <CommentItem key={c.id} comment={c} postAuthorId={post.authorId} postId={post.id} />)
                ) : (
                  <p className="text-center text-xs text-natural-muted py-6 italic">暂无评论，分享你的见解吧</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Post List Component
export function PostList({ searchQuery, searchMode }: { searchQuery: string; searchMode: 'keyword' | 'semantic' }) {
  const { user } = useAuth();
  const [sortBy, setSortBy] = React.useState<'createdAt' | 'likesCount' | 'commentsCount'>('createdAt');
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [semanticResults, setSemanticResults] = React.useState<any[] | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = React.useState(false);

  const postQuery = React.useMemo(() => {
    const base = collection(db, 'posts');
    const constraints: any[] = [orderBy(sortBy, 'desc')];

    // Add createdAt as a secondary sort to ensure consistency if counts are equal
    if (sortBy !== 'createdAt') {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    return query(base, ...constraints);
  }, [sortBy]);

  const [snapshot, loading, error] = useCollection(postQuery);

  // 提取所有不重复的标签
  const allTags = React.useMemo(() => {
    const allPosts = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
    const tagSet = new Set<string>();
    allPosts.forEach((post: any) => {
      if (post.tags) {
        post.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [snapshot]);

  const posts = React.useMemo(() => {
    let allPosts = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

    // 标签筛选
    if (selectedTag) {
      allPosts = allPosts.filter((post: any) => post.tags?.includes(selectedTag));
    }

    // 语义搜索模式：使用预计算的语义排序结果
    if (searchMode === 'semantic' && semanticResults && searchQuery.trim()) {
      const filtered = semanticResults.filter((r: any) =>
        selectedTag ? r.post.tags?.includes(selectedTag) : true
      );
      return filtered.map((r: any) => ({ ...r.post, _similarity: r.similarity }));
    }

    // 关键词搜索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      allPosts = allPosts.filter((post: any) =>
        post.content?.toLowerCase().includes(q) ||
        post.location?.addressName?.toLowerCase().includes(q) ||
        post.authorName?.toLowerCase().includes(q)
      );
    }

    return allPosts;
  }, [snapshot, searchQuery, selectedTag, searchMode, semanticResults]);

  // 语义搜索异步执行
  React.useEffect(() => {
    if (searchMode !== 'semantic' || !searchQuery.trim()) {
      setSemanticResults(null);
      return;
    }

    setIsSemanticSearching(true);
    const allPosts = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

    // 动态导入语义搜索模块
    import('../services/ml/semanticSearch').then(({ semanticSearchPosts }) => {
      semanticSearchPosts(searchQuery, allPosts).then(results => {
        setSemanticResults(results);
        setIsSemanticSearching(false);
      }).catch(() => {
        setIsSemanticSearching(false);
      });
    }).catch(() => {
      setIsSemanticSearching(false);
    });
  }, [searchMode, searchQuery, snapshot]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    console.error(error);
    return <div className="text-center py-10 text-red-500">加载失败，请刷新页面</div>;
  }

  return (
    <div className="flex flex-col pb-20">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-serif font-bold text-natural-text">社区广场</h2>

        {/* Sort Toggle */}
        <div className="flex items-center bg-white/50 backdrop-blur-sm self-start sm:self-center p-1 rounded-xl border border-natural-border shadow-sm">
          <button
            onClick={() => setSortBy('createdAt')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              sortBy === 'createdAt'
                ? 'bg-natural-primary text-white shadow-sm'
                : 'text-natural-muted hover:text-natural-primary'
            }`}
          >
            最新
          </button>
          <button
            onClick={() => setSortBy('likesCount')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              sortBy === 'likesCount'
                ? 'bg-natural-primary text-white shadow-sm'
                : 'text-natural-muted hover:text-natural-primary'
            }`}
          >
            最热
          </button>
          <button
            onClick={() => setSortBy('commentsCount')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              sortBy === 'commentsCount' 
                ? 'bg-natural-primary text-white shadow-sm' 
                : 'text-natural-muted hover:text-natural-primary'
            }`}
          >
            热议
          </button>
        </div>
      </div>

      {/* Tag Filter Bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedTag(null)}
            className={`flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
              !selectedTag
                ? 'bg-natural-primary text-white'
                : 'bg-white border border-natural-border text-natural-muted hover:border-natural-primary'
            }`}
          >
            全部
          </button>
          {allTags.map(tag => (
            <React.Fragment key={tag}>
              <CategoryBadge
                label={tag}
                active={selectedTag === tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                size="md"
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 语义搜索状态提示 */}
      {searchMode === 'semantic' && searchQuery.trim() && (
        <div className="mb-4 text-xs text-natural-muted flex items-center gap-2">
          {isSemanticSearching ? (
            <>
              <span className="w-3 h-3 border-2 border-natural-primary border-t-transparent rounded-full animate-spin" />
              语义搜索中...
            </>
          ) : (
            <span>语义搜索结果 · 按相似度排序</span>
          )}
        </div>
      )}

      {posts.length > 0 ? (
        <>
          {posts.map((post: any) => <PostCard key={post.id} post={post} />)}
          {!user && (
            <div className="py-12 px-6 text-center bg-white/20 rounded-[40px] border border-white/40 mb-20">
              <h3 className="text-xl font-serif font-bold text-natural-primary mb-2">看到这里的灵感了吗？</h3>
              <p className="text-sm text-natural-muted mb-6">加入社区，记录你的每一个精彩瞬间。</p>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-3 bg-natural-primary text-white rounded-full text-sm font-bold shadow-lg hover:shadow-natural-primary/20 transition-all"
              >
                立即登录参与讨论
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-white/40 rounded-[32px] border border-white/20">
          <div className="inline-flex p-4 bg-natural-bg rounded-full text-natural-muted/30 mb-4">
            <PlusCircle size={48} />
          </div>
          <p className="text-natural-muted font-serif italic">此处暂时风平浪静，等待你的位置记录...</p>
        </div>
      )}
    </div>
  );
}

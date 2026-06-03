// 私信系统 - 会话列表 + 聊天窗口
// 通过 API 端点在服务端读写 Firestore
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import { forumService } from '../services/forumService';
import { ArrowLeft, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function Messages() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-serif font-bold text-natural-primary">请先登录</h2>
          <p className="text-xs text-natural-muted font-medium">登录后即可开启私人对话</p>
          <Link to="/" className="inline-block px-8 py-3 bg-natural-primary text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-md hover:bg-natural-primary-dark transition-all">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg flex flex-col md:flex-row h-screen overflow-hidden">
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-natural-border flex flex-col transition-all ${conversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-natural-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-natural-bg rounded-full transition-colors">
               <ArrowLeft size={20} className="text-natural-primary" />
            </Link>
            <h1 className="text-2xl font-serif font-bold text-natural-text">收件箱</h1>
          </div>
          <Link to={`/profile/${user.uid}`} className="w-10 h-10 rounded-full overflow-hidden border-2 border-natural-bg shrink-0">
             <UserAvatar uid={user.uid} fallback={user.photoURL} className="w-full h-full object-cover" />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList userId={user.uid} activeId={conversationId} />
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-natural-bg relative ${!conversationId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {conversationId ? (
          <ChatWindow conversationId={conversationId} currentUser={user} />
        ) : (
          <div className="text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-natural-border">
              <Send size={32} className="text-natural-primary/40" />
            </div>
            <h2 className="text-xl font-serif font-bold text-natural-text">你的私人空间</h2>
            <p className="text-xs text-natural-muted font-medium">发送私密消息给社区中的朋友</p>
            <Link to="/" className="inline-block mt-4 text-[10px] text-natural-primary font-bold uppercase tracking-widest hover:underline">
              去社区看看动态
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationList({ userId, activeId }: { userId: string; activeId?: string }) {
  const [conversations, setConversations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    forumService.getConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));

    // 每 10 秒刷新一次
    const interval = setInterval(() => {
      forumService.getConversations().then(setConversations).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) return (
    <div className="divide-y divide-natural-bg">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-4 p-5 animate-pulse">
          <div className="w-12 h-12 bg-natural-bg rounded-full shrink-0" />
          <div className="flex-1 space-y-2 mt-1">
            <div className="h-3 bg-natural-bg rounded-full w-1/3" />
            <div className="h-2 bg-natural-bg rounded-full w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  if (conversations.length === 0) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-xs text-natural-muted font-serif italic">暂无对话，开启第一个交流吧</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-natural-bg">
      {conversations.map((conv: any) => {
        const otherId = conv.participants?.find((id: string) => id !== userId);
        const unread = conv.unreadCount?.[userId] || 0;

        return (
          <Link
            key={conv.id}
            to={`/messages/${conv.id}`}
            className={`flex items-center gap-4 p-5 hover:bg-natural-bg transition-colors ${conv.id === activeId ? 'bg-natural-bg' : ''}`}
          >
            <div className="relative shrink-0">
              <UserAvatar uid={otherId} className="w-12 h-12 rounded-full object-cover" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-natural-text truncate">
                  {conv.participantNames?.[otherId] || otherId}
                </p>
                {conv.lastMessage && (
                  <span className="text-[10px] text-natural-muted shrink-0 ml-2">
                    {formatDistanceToNow(new Date(conv.updatedAt || Date.now()), { addSuffix: true, locale: zhCN })}
                  </span>
                )}
              </div>
              <p className="text-xs text-natural-muted truncate mt-0.5">{conv.lastMessage || '...'}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ChatWindow({ conversationId, currentUser }: { conversationId: string; currentUser: any }) {
  const [messages, setMessages] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newMsg, setNewMsg] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    forumService.getMessages(conversationId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false));
    forumService.markAsRead(conversationId);

    const interval = setInterval(() => {
      forumService.getMessages(conversationId).then(setMessages).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      const otherId = conversationId.split('_').find((id: string) => id !== currentUser.uid);
      await forumService.sendMessage(otherId || '', newMsg.trim());
      setNewMsg('');
      // 刷新消息
      const msgs = await forumService.getMessages(conversationId);
      setMessages(msgs);
    } catch (e: any) {
      alert('发送失败: ' + (e.message || ''));
    } finally {
      setSending(false);
    }
  };

  const otherId = conversationId.split('_').find((id: string) => id !== currentUser.uid);

  return (
    <>
      <div className="p-4 bg-white border-b border-natural-border flex items-center gap-3">
        <Link to="/messages" className="md:hidden p-1">
          <ArrowLeft size={20} className="text-natural-primary" />
        </Link>
        <UserAvatar uid={otherId || ''} className="w-8 h-8 rounded-full" />
        <span className="text-sm font-bold text-natural-text">{otherId}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center text-xs text-natural-muted py-10">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-natural-muted py-10">暂无消息，发送第一条吧</div>
        ) : (
          messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                msg.senderId === currentUser.uid
                  ? 'bg-natural-primary text-white rounded-br-md'
                  : 'bg-white border border-natural-border rounded-bl-md'
              }`}>
                <p className="text-xs">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.senderId === currentUser.uid ? 'text-white/60' : 'text-natural-muted'}`}>
                  {formatDistanceToNow(new Date(msg.createdAt || Date.now()), { addSuffix: true, locale: zhCN })}
                </p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-white border-t border-natural-border flex gap-2">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          className="flex-1 bg-natural-bg rounded-xl px-4 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!newMsg.trim() || sending}
          className="bg-natural-primary text-white p-2 rounded-xl disabled:opacity-30"
        >
          <Send size={18} />
        </button>
      </div>
    </>
  );
}

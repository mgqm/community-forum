// 私信系统 - 会话列表 + 聊天窗口
// 数据存储在 Firestore 的 conversations 集合中
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { forumService } from '../services/forumService';
import { ArrowLeft, Send, MoreVertical, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function Messages() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not logged in
  React.useEffect(() => {
    if (!user && !localStorage.getItem('isAuthenticating')) {
      // Check if we are in the middle of auth, otherwise redirect
    }
  }, [user, navigate]);

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
      {/* Sidebar - Conversation List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-natural-border flex flex-col transition-all ${conversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-natural-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-natural-bg rounded-full transition-colors">
               <ArrowLeft size={20} className="text-natural-primary" />
            </Link>
            <h1 className="text-2xl font-serif font-bold text-natural-text">收件箱</h1>
          </div>
          <Link to={`/profile/${user.uid}`} className="w-10 h-10 rounded-full overflow-hidden border-2 border-natural-bg shrink-0">
             <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="" className="w-full h-full object-cover" />
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <ConversationList userId={user.uid} activeId={conversationId} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-natural-bg relative ${!conversationId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {conversationId ? (
          <ChatWindow conversationId={conversationId} currentUser={user} />
        ) : (
          <div className="text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-natural-border">
              <Send size={32} className="text-natural-primary/40" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-serif font-bold text-natural-text">你的私人空间</h2>
              <p className="text-xs text-natural-muted font-medium">发送私密消息给社区中的朋友</p>
            </div>
            <Link to="/" className="inline-block mt-4 text-[10px] text-natural-primary font-bold uppercase tracking-widest hover:underline">
              去社区看看动态
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationList({ userId, activeId }: { userId: string, activeId?: string }) {
  const [snapshot, loading] = useCollection(
    query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    )
  );

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

  const conversations = snapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

  if (conversations.length === 0) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="w-12 h-12 bg-natural-bg rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
           <Send size={24} className="text-natural-muted" />
        </div>
        <p className="text-xs text-natural-muted font-serif italic">暂无对话，开启第一个交流吧</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-natural-bg">
      {conversations.map((conv: any) => {
        const otherId = conv.participants.find((id: string) => id !== userId);
        const unread = conv.unreadCount?.[userId] || 0;
        
        return (
          <Link 
            key={conv.id}
            to={`/messages/${conv.id}`}
            className={`flex items-center gap-4 p-5 hover:bg-natural-bg transition-all relative group ${activeId === conv.id ? 'bg-natural-bg' : ''}`}
          >
            <div className="relative shrink-0">
              <img 
                src={conv.participantPhotos?.[otherId] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`} 
                alt="" 
                className="w-13 h-13 rounded-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" 
              />
              {unread > 0 && (
                 <span className="absolute -top-1 -right-1 w-5 h-5 bg-natural-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                   {unread}
                 </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h3 className={`text-sm tracking-tight truncate uppercase ${unread > 0 ? 'font-black text-natural-text' : 'font-bold text-natural-text'}`}>
                  {conv.participantNames?.[otherId] || '加载中...'}
                </h3>
                <span className="text-[9px] text-natural-muted font-medium whitespace-nowrap ml-2 uppercase">
                  {conv.updatedAt?.toDate ? formatDistanceToNow(conv.updatedAt.toDate(), { addSuffix: false, locale: zhCN }) : '刚刚'}
                </span>
              </div>
              <p className={`text-xs truncate leading-snug ${unread > 0 ? 'text-natural-text font-medium' : 'text-natural-muted'}`}>
                {conv.lastSenderId === userId ? '你: ' : ''}{conv.lastMessage}
              </p>
            </div>
            {activeId === conv.id && (
              <motion.div layoutId="active-nav" className="absolute right-0 top-4 bottom-4 w-1 bg-natural-primary rounded-l-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function ChatWindow({ conversationId, currentUser }: { conversationId: string, currentUser: any }) {
  const navigate = useNavigate();
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const [convSnap] = useDocument(doc(db, 'conversations', conversationId));
  const convData = convSnap?.data();
  const otherId = convData?.participants.find((id: string) => id !== currentUser.uid);

  const [messagesSnap] = useCollection(
    query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    )
  );
  const messages = messagesSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

  // Mark as read when messages change or entering
  React.useEffect(() => {
    if (conversationId && convData?.unreadCount?.[currentUser.uid] > 0) {
      forumService.markAsRead(conversationId);
    }
  }, [conversationId, messages.length, convData?.unreadCount?.[currentUser.uid]]);

  // Scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending || !otherId) return;

    setIsSending(true);
    const textSnapshot = message;
    setMessage('');
    
    try {
      await forumService.sendMessage(otherId, textSnapshot);
    } catch (e) {
      console.error(e);
      setMessage(textSnapshot); // Restore on failure
      alert('发送失败');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Chat Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-natural-border px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/messages')} className="p-2 hover:bg-natural-bg rounded-full transition-colors md:hidden">
            <ArrowLeft size={20} className="text-natural-primary" />
          </button>
          <Link to={otherId ? `/profile/${otherId}` : '#'} className="flex items-center gap-3">
             <img src={convData?.participantPhotos?.[otherId] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-natural-bg" />
             <div>
               <h3 className="text-sm font-black text-natural-text uppercase tracking-tight">{convData?.participantNames?.[otherId] || '加载中...'}</h3>
               <p className="text-[9px] text-green-500 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 mt-0.5">
                 <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> 对话连接中
               </p>
             </div>
          </Link>
        </div>
        <button className="p-2 text-natural-muted hover:text-natural-primary transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth bg-[#FDFCFB] custom-scrollbar">
        {messages.length > 0 ? (
          messages.map((msg: any, i: number) => {
            const isMe = msg.senderId === currentUser.uid;
            const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
            const prevMsg: any = i > 0 ? messages[i-1] : null;
            const prevMsgDate = prevMsg?.createdAt?.toDate ? prevMsg.createdAt.toDate() : null;
            const showTime = !prevMsgDate || (msgDate.getTime() - prevMsgDate.getTime() > 10 * 60 * 1000); // 10 mins
            
            return (
              <div key={msg.id} className="space-y-3">
                {showTime && (
                  <div className="text-center py-6">
                    <span className="text-[9px] text-natural-muted font-bold uppercase tracking-[0.2em] bg-white px-4 py-1.5 rounded-full border border-natural-border shadow-sm">
                       {formatDistanceToNow(msgDate, { addSuffix: true, locale: zhCN })}
                    </span>
                  </div>
                )}
                <motion.div 
                   initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1 align-middle">
                      <div className={`px-5 py-3 rounded-[28px] text-[13px] leading-[1.6] shadow-sm font-medium ${
                        isMe 
                          ? 'bg-natural-primary text-white rounded-tr-md' 
                          : 'bg-white text-natural-text rounded-tl-md border border-natural-border'
                      }`}>
                        {msg.content}
                      </div>
                      {isMe && i === messages.length - 1 && (
                         <div className="flex justify-end pr-2 pt-1">
                            <CheckCircle2 size={10} className="text-natural-primary/50" />
                         </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
             <div className="w-16 h-16 border-2 border-dashed border-natural-muted rounded-full flex items-center justify-center">
                <Send size={24} className="text-natural-muted ml-0.5" />
             </div>
             <p className="text-[10px] font-serif uppercase tracking-[0.3em] text-natural-muted">
                灵感的共鸣，从这里开始
             </p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-natural-border">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="relative flex-1">
            <input 
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="书写美好，传递温暖..."
              className="w-full bg-natural-bg/50 border border-transparent focus:border-natural-primary/10 rounded-[28px] px-8 py-5 text-sm focus:outline-none focus:ring-4 focus:ring-natural-primary/5 transition-all font-medium pr-16 shadow-inner"
            />
            <button 
              type="submit"
              disabled={!message.trim() || isSending}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-3.5 rounded-full transition-all flex items-center justify-center ${
                message.trim() ? 'bg-natural-primary text-white shadow-lg shadow-natural-primary/20 scale-100 hover:scale-105 active:scale-95' : 'bg-natural-bg text-natural-muted scale-90'
              }`}
            >
              <Send size={20} className={isSending ? 'animate-pulse' : ''} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

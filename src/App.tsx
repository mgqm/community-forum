/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 社区互动论坛 - 应用根组件
// AuthProvider 提供全局认证状态（JWT + SQLite，替代 Firebase Auth）
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar, CreatePost, PostList } from './components/Forum';
import UserProfile from './components/UserProfile';
import Messages from './components/Messages';
import ScrollToTop from './components/ScrollToTop';

function Home() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchMode, setSearchMode] = React.useState<'keyword' | 'semantic'>('keyword');

  return (
    <div className="min-h-screen bg-natural-bg font-sans selection:bg-natural-primary/20 selection:text-natural-primary">
      <Navbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
      />

      <main className="max-w-xl mx-auto px-4 pt-12">
        {/* Welcome Section */}
        <div className="mb-10 space-y-3">
          <h2 className="text-3xl font-serif italic text-natural-primary leading-tight">
            寻回灵感的火花 ✨
          </h2>
          <p className="text-sm text-natural-muted font-medium tracking-wide">
            在这里，我们分享自然之美与设计的共鸣。
          </p>
        </div>

        <CreatePost />
        <PostList searchQuery={searchQuery} searchMode={searchMode} />
      </main>

      {/* Footer */}
      <footer className="text-center py-16 text-[10px] text-natural-muted font-medium uppercase tracking-[0.2em] opacity-40">
        Roots Collective — Created with Purpose
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
        </Routes>
        <ScrollToTop />
      </Router>
    </AuthProvider>
  );
}

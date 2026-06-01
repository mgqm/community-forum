// 认证上下文 - 替代 Firebase Auth，使用本地后端 API
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 用户数据类型（与 Firebase User 接口兼容）
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role?: string;
}

interface AuthContextType {
  user: AppUser | null;       // 当前登录用户，null 表示未登录
  loading: boolean;            // 初始化加载中
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<AppUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// API 请求基础路径（开发时通过 Vite 代理转发到后端）
const API_BASE = '/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化时从 localStorage 恢复登录状态
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
          else localStorage.removeItem('auth_token');
        })
        .catch(() => localStorage.removeItem('auth_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');

    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
  }, []);

  // 注册
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');

    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  // 退出登录
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 自定义 Hook：获取当前认证状态
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}

// 获取当前登录用户的工具函数（非组件中调用）
export function getCurrentUser(): AppUser | null {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  try {
    // 解析 JWT payload 获取用户信息（不验证签名，仅用于快速获取）
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      photoURL: payload.photoURL,
      role: payload.role
    };
  } catch {
    return null;
  }
}

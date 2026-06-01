# 社区互动论坛 (Roots Collective)

一个支持用户注册登录、发布动态、点赞评论和私信交流的社区互动平台。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式方案 | Tailwind CSS v4 |
| 动画 | Framer Motion (motion) |
| 路由 | react-router-dom v7 |
| 后端 | Express (Node.js) |
| 数据库 | SQLite (sql.js) |
| 认证 | JWT + bcryptjs |
| 图标 | lucide-react |
| 日期 | date-fns |

## 功能特性

- **用户系统** — 邮箱注册/登录，JWT 令牌认证，用户数据存储在本地 SQLite
- **动态发布** — 支持文字、图片、地理位置
- **点赞评论** — 动态点赞、评论回复、Emoji 表态
- **关注系统** — 用户关注/粉丝、通知推送
- **私信聊天** — 一对一实时对话
- **个人主页** — 用户信息编辑、帖子展示
- **搜索筛选** — 按关键词搜索，按最新/最热/热议排序

## 快速开始

**环境要求：** Node.js >= 18

```bash
# 1. 安装依赖
npm install

# 2. 启动后端（端口 3001）
npm run server

# 3. 新开终端，启动前端（端口 3000）
npm run dev
```

打开浏览器访问 `http://localhost:3000`，点击右上角 **登录** 即可使用。

> 首次启动后端时会自动创建 `server/forum.db` 数据库文件。

## 管理员账号

在登录弹窗中点击 **"管理员快捷登录"** 按钮，系统会自动创建管理员账号：

- 邮箱：`admin@root.com`
- 密码：`admin123456`

也可以直接使用邮箱注册页面创建新账号。

## 项目结构

```
社区互动论坛/
├── server/                    # 后端服务
│   ├── index.cjs             # Express 服务器入口
│   ├── auth.cjs              # 认证 API（注册/登录/获取用户）
│   └── db.cjs                # SQLite 数据库初始化
├── src/
│   ├── main.tsx              # 应用入口
│   ├── App.tsx               # 根组件 + 路由配置
│   ├── index.css             # 全局样式（Tailwind + 自定义主题）
│   ├── context/
│   │   └── AuthContext.tsx   # 认证状态管理（JWT + localStorage）
│   ├── lib/
│   │   └── firebase.ts       # Firebase 客户端（Firestore 数据存储）
│   ├── services/
│   │   └── forumService.ts   # 数据服务层（帖子/评论/点赞/私信）
│   └── components/
│       ├── Forum.tsx         # 主页组件（导航栏/登录弹窗/发帖/帖子列表/评论区）
│       ├── UserProfile.tsx   # 用户个人主页
│       ├── Messages.tsx      # 私信系统
│       └── ScrollToTop.tsx   # 回到顶部按钮
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息（需 Bearer Token） |

## 在线访问

[https://www.mgqm.cn/](https://www.mgqm.cn/)

// 社区互动论坛 - 后端服务器入口
// 提供用户认证 API，使用 SQLite 存储用户数据
const express = require('express');
const cors = require('cors');
const path = require('path');
const { router: authRouter } = require('./auth.cjs');

const app = express();
const PORT = process.env.API_PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json());

// 认证 API 路由
app.use('/api/auth', authRouter);

// 启动服务器
app.listen(PORT, () => {
  console.log(`论坛后端服务已启动: http://localhost:${PORT}`);
  console.log(`API 接口:`);
  console.log(`  POST /api/auth/register - 用户注册`);
  console.log(`  POST /api/auth/login    - 用户登录`);
  console.log(`  GET  /api/auth/me       - 获取当前用户`);
});

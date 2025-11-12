require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入路由
const labRoutes = require('./routes/labs');
const itemRoutes = require('./routes/items');
const containerRoutes = require('./routes/containers');

// 导入数据库连接
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 检查环境变量加载情况
console.log('🔧 环境变量检查:');
console.log('- PORT:', process.env.PORT);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '已设置' : '未设置');
console.log('- DB_NAME:', process.env.DB_NAME);

// ===== 简化的 CORS 配置 =====
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'], // 允许的方法（包括OPTIONS预检）
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // 预检请求返回200而非204
};

// 应用 CORS 中间件
app.use(cors(corsOptions));

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 连接数据库
connectDB();

// 路由
app.use('/api/labs', labRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/containers', containerRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: '实验室物料管理系统 API',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API文档端点
app.get('/', (req, res) => {
  res.json({ 
    message: '🏢 实验室物料管理系统后端API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      labs: '/api/labs',
      items: '/api/items',
      containers: '/api/containers',
      health: '/health'
    },
    documentation: {
      description: '完整的实验室物料管理API',
      features: [
        '实验室管理',
        '容器层级管理', 
        '物品管理',
        '搜索功能',
        '过期物品检测'
      ]
    }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API端点未找到',
    requestedUrl: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/labs',
      'GET /api/labs/:id',
      'POST /api/labs',
      'PUT /api/labs/:id',
      'DELETE /api/labs/:id',
      'GET /api/items/search',
      'POST /api/items/containers/:containerId/items',
      'PUT /api/items/:itemId',
      'DELETE /api/items/:itemId',
      'GET /api/items/expiring',
      'POST /api/containers',
      'PUT /api/containers/:containerId',
      'DELETE /api/containers/:containerId'
    ]
  });
});

// 全局错误处理
app.use((error, req, res, next) => {
  console.error('🚨 未处理的错误:', error);
  
  // 如果是路由参数错误，提供更友好的错误信息
  if (error.message.includes('Missing parameter name')) {
    return res.status(400).json({
      success: false,
      message: '路由参数语法错误',
      error: '请检查路由定义中的参数名称',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? error.message : '内部服务器错误'
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`🎯 服务器运行在 http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/`);
  console.log(`❤️  健康检查: http://localhost:${PORT}/health`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
  console.log(`🌐 允许的源: ${corsOptions.origin.join(', ')}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

module.exports = app;
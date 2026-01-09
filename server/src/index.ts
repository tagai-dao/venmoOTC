import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { testConnection } from './db/config.js';
import { initDatabase, seedDatabase } from './db/init.js';
import authRoutes from './routes/auth.js';
import blockchainRoutes from './routes/blockchain.js';
import socialRoutes from './routes/social.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import socialInteractionRoutes from './routes/socialInteractions.js';
import bidRoutes from './routes/bids.js';
import multisigRoutes from './routes/multisig.js';

const app = express();

// 中间件
// 开发环境下放宽 CORS 限制，支持 localhost 不同端口（如 3000/3001/3002 等）
if (config.nodeEnv === 'development') {
  app.use(cors({
    origin: (origin, callback) => {
      // 允许本地开发环境的所有来源（包括无 origin 的本地请求）
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }));
} else {
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
}

// 增加请求体大小限制（50MB），以支持 base64 图片上传
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/social-interactions', socialInteractionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/multisig', multisigRoutes);

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    },
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = config.port;

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 1. 测试数据库连接
    console.log('🔌 Testing database connection...');
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.error('❌ Failed to connect to database. Please check your database configuration.');
      process.exit(1);
    }
    
    // 2. 初始化数据库表结构
    console.log('📊 Initializing database schema...');
    await initDatabase();
    
    // 3. 导入种子数据（仅在开发环境或数据库为空时）
    if (config.nodeEnv === 'development') {
      console.log('🌱 Seeding database with initial data...');
      await seedDatabase();
    }
    
    // 4. 启动服务器
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 Environment: ${config.nodeEnv}`);
      console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
      console.log(`💾 Database: Connected`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();


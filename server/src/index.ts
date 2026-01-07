import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import blockchainRoutes from './routes/blockchain.js';
import socialRoutes from './routes/social.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/users.js';

const app = express();

// 中间件
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.frontendUrl}`);
});


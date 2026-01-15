import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types.js';

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env }>();

// CORS 中间件
app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin: string) => {
      const allowedOrigins = [
        c.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'https://pay.tagai.fun',
        'https://venmootc-frontend.pages.dev',
        'https://f2f01c88.venmootc-frontend.pages.dev',
        'https://b9a495ea.venmootc-frontend.pages.dev',
      ];
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      // 默认允许配置的前端 URL
      return c.env.FRONTEND_URL || 'http://localhost:3000';
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// 健康检查
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'venmootc-api'
  });
});

// API 路由
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import transactionRoutes from './routes/transactions.js';
import notificationRoutes from './routes/notifications.js';
import bidRoutes from './routes/bids.js';
import multisigRoutes from './routes/multisig.js';
import blockchainRoutes from './routes/blockchain.js';
import socialRoutes from './routes/social.js';
import socialInteractionRoutes from './routes/socialInteractions.js';

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/bids', bidRoutes);
app.route('/api/multisig', multisigRoutes);
app.route('/api/blockchain', blockchainRoutes);
app.route('/api/social', socialRoutes);
app.route('/api/social-interactions', socialInteractionRoutes);

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ 
    error: { 
      message: err.message || 'Internal Server Error' 
    } 
  }, 500);
});

export default app;

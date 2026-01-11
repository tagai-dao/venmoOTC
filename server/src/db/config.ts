import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 数据库连接配置
const dbConfig: any = {
  database: process.env.DB_NAME || 'venmootc',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 30000, // 30 秒连接超时
};

// 优先使用 TCP 连接（根据记忆，数据库在 localhost:3306）
// 如果指定了 socket 路径，使用 socket；否则使用 TCP
if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
  // 默认使用 TCP 连接
  dbConfig.host = process.env.DB_HOST || 'localhost';
  dbConfig.port = parseInt(process.env.DB_PORT || '3306');
}

export const pool = mysql.createPool(dbConfig);

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT NOW() as now');
    connection.release();
    const result = rows as any[];
    console.log('✅ Database connected successfully:', result[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
};


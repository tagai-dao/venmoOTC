import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'venmootc',
};

async function migrate() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('📜 Attempting manual migration...');
    
    try {
      await connection.execute('ALTER TABLE users ADD COLUMN twitter_refresh_token TEXT');
      console.log('✅ Added twitter_refresh_token');
    } catch (e: any) {
      console.log('ℹ️ twitter_refresh_token might already exist:', e.message);
    }

    try {
      await connection.execute('ALTER TABLE users ADD COLUMN twitter_token_expires_at BIGINT');
      console.log('✅ Added twitter_token_expires_at');
    } catch (e: any) {
      console.log('ℹ️ twitter_token_expires_at might already exist:', e.message);
    }

    try {
      await connection.execute('CREATE INDEX idx_users_twitter_refresh_token ON users(twitter_refresh_token(50))');
      console.log('✅ Created index');
    } catch (e: any) {
      console.log('ℹ️ index might already exist:', e.message);
    }

    console.log('🚀 Manual migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();

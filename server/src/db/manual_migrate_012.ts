import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'venmootc',
};

async function migrate() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log('📜 Running migration 012: Add country column to users table...');
    
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN country VARCHAR(100) NULL AFTER account_name
      `);
      console.log('✅ Added country column to users table');
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060) {
        console.log('ℹ️  country column already exists, skipping...');
      } else {
        throw e;
      }
    }

    console.log('🚀 Migration 012 completed!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();

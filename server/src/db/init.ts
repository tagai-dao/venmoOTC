import { pool } from './config.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 初始化数据库：创建表结构
 */
export const initDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    
    try {
      // 读取并执行迁移脚本
      const migrationPath = join(__dirname, 'migrations', '001_initial_schema.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // 为了更好地调试，在逐条执行的基础上增加错误输出
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          if (statement) {
            console.log('📜 Executing migration statement:\n', statement);
            await client.query(statement);
          }
        } catch (err: any) {
          console.error('❌ Error executing migration statement:\n', statement);
          console.error('❌ Migration error details:', err);

          // 如果是在创建索引时因为表不存在报错（42P01），先跳过索引创建，保证服务能启动
          // 这种情况通常出现在手工误删表或 schema 半初始化的场景
          if (
            typeof err.code === 'string' &&
            err.code === '42P01' &&
            /^CREATE\s+INDEX/i.test(statement)
          ) {
            console.warn(
              '⚠️ Skipping index creation because base table does not exist yet. ' +
                'You may need to recreate schema manually if this persists.'
            );
            continue;
          }

          // 其他错误仍然中断启动
          throw err;
        }
      }

      console.log('✅ Database schema initialized successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};

/**
 * 导入种子数据
 */
export const seedDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    
    try {
      // 读取并执行种子数据脚本
      const seedPath = join(__dirname, 'migrations', '002_seed_data.sql');
      const seedSQL = readFileSync(seedPath, 'utf-8');
      
      // 执行 SQL（按分号分割，逐个执行）
      const statements = seedSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          await client.query(statement);
        }
      }
      
      console.log('✅ Database seeded successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }
};


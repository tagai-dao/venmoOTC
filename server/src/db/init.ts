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
    const connection = await pool.getConnection();
    
    try {
      // 读取并执行迁移脚本
      const migrationPaths = [
        join(__dirname, 'migrations', '001_initial_schema.sql'),
        join(__dirname, 'migrations', '004_create_notifications.sql'),
        join(__dirname, 'migrations', '006_create_social_interactions.sql'),
        join(__dirname, 'migrations', '007_add_bidding_and_multisig.sql'),
        join(__dirname, 'migrations', '008_add_multisig_signatures.sql'),
      ];

      for (const migrationPath of migrationPaths) {
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          try {
            if (statement) {
              console.log('📜 Executing migration statement:\n', statement);
              await connection.execute(statement);
            }
          } catch (err: any) {
            // 先检查是否是已知的可忽略错误，避免打印错误信息
            
            // 处理死锁错误 - 重试机制
            if (
              (typeof err.code === 'string' && err.code === 'ER_LOCK_DEADLOCK') ||
              (typeof err.errno === 'number' && err.errno === 1213) ||
              (typeof err.code === 'number' && err.code === 1213)
            ) {
              console.warn('⚠️ Deadlock detected, retrying statement after delay...');
              // 等待一小段时间后重试（最多重试 3 次）
              let retries = 3;
              let success = false;
              while (retries > 0 && !success) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 等待 500ms
                try {
                  await connection.execute(statement);
                  success = true;
                  console.log('✅ Statement executed successfully after retry');
                } catch (retryErr: any) {
                  retries--;
                  if (retries === 0) {
                    // 如果是创建索引的死锁，尝试使用 IF NOT EXISTS 或直接跳过
                    if (/^CREATE\s+INDEX/i.test(statement)) {
                      console.warn('⚠️ Index creation deadlock persisted, skipping (index may already exist)');
                      continue;
                    }
                    throw retryErr;
                  }
                }
              }
              continue;
            }
            
            // 如果索引已存在（ER_DUP_KEYNAME），跳过（允许重复执行迁移）
            if (
              (typeof err.code === 'string' && err.code === 'ER_DUP_KEYNAME') ||
              (typeof err.errno === 'number' && err.errno === 1061) ||
              (typeof err.code === 'number' && err.code === 1061)
            ) {
              console.warn('⚠️ Index already exists, skipping:', statement.substring(0, 50) + '...');
              continue;
            }

            // 如果表已存在（ER_TABLE_EXISTS_ERROR），跳过（允许重复执行迁移）
            if (
              (typeof err.code === 'string' && err.code === 'ER_TABLE_EXISTS_ERROR') ||
              (typeof err.errno === 'number' && err.errno === 1050) ||
              (typeof err.code === 'number' && err.code === 1050)
            ) {
              console.warn('⚠️ Table already exists, skipping:', statement.substring(0, 50) + '...');
              continue;
            }

            // 如果字段已存在（ER_DUP_FIELDNAME），跳过（允许重复执行迁移）
            if (
              (typeof err.code === 'string' && err.code === 'ER_DUP_FIELDNAME') ||
              (typeof err.errno === 'number' && err.errno === 1060) ||
              (typeof err.code === 'number' && err.code === 1060)
            ) {
              console.warn('⚠️ Column already exists, skipping:', statement.substring(0, 50) + '...');
              continue;
            }

            // 如果是在创建索引时因为表不存在报错（ER_NO_SUCH_TABLE），先跳过索引创建
            if (
              (typeof err.code === 'string' && err.code === 'ER_NO_SUCH_TABLE') ||
              (typeof err.errno === 'number' && err.errno === 1146) ||
              (typeof err.code === 'number' && err.code === 1146)
            ) {
              if (/^CREATE\s+INDEX/i.test(statement)) {
                console.warn(
                  '⚠️ Skipping index creation because base table does not exist yet. ' +
                    'You may need to recreate schema manually if this persists.'
                );
                continue;
              } else if (/^CREATE\s+TABLE/i.test(statement)) {
                console.warn(
                  '⚠️ Table creation failed (possibly due to foreign key constraints). ' +
                    'This may be expected if referenced tables do not exist yet.'
                );
                continue;
              }
            }

            // 其他错误才记录并中断启动
            console.error('❌ Error executing migration statement:\n', statement);
            console.error('❌ Migration error details:', err);
            throw err;
          }
        }
      }

      // 执行额外的 migration（003_add_fiat_rejection_count.sql）
      try {
        const additionalMigrationPath = join(__dirname, 'migrations', '003_add_fiat_rejection_count.sql');
        const additionalMigrationSQL = readFileSync(additionalMigrationPath, 'utf-8');
        const statements = additionalMigrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement) {
            try {
              console.log('📜 Executing additional migration statement:\n', statement);
              await connection.execute(statement);
            } catch (err: any) {
              // 处理死锁错误 - 重试机制
              if (
                (typeof err.code === 'string' && err.code === 'ER_LOCK_DEADLOCK') ||
                (typeof err.errno === 'number' && err.errno === 1213) ||
                (typeof err.code === 'number' && err.code === 1213)
              ) {
                console.warn('⚠️ Deadlock detected in additional migration, retrying...');
                let retries = 3;
                let success = false;
                while (retries > 0 && !success) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  try {
                    await connection.execute(statement);
                    success = true;
                    console.log('✅ Additional migration statement executed after retry');
                  } catch (retryErr: any) {
                    retries--;
                    if (retries === 0) {
                      console.warn('⚠️ Additional migration deadlock persisted, skipping:', err.message);
                    }
                  }
                }
                continue;
              }
              
              // 如果字段已存在，忽略错误（允许重复执行）
              if (err.code === 'ER_DUP_FIELDNAME' || err.code === 1060) {
                console.log('ℹ️  Field fiat_rejection_count already exists, skipping...');
              } else {
                console.warn('⚠️  Additional migration warning:', err.message);
              }
            }
          }
        }
        console.log('✅ Additional migrations executed successfully');
      } catch (err: any) {
        console.warn('⚠️  Additional migration warning:', err.message);
      }

      console.log('✅ Database schema initialized successfully');
    } finally {
      connection.release();
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
    const connection = await pool.getConnection();
    
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
          await connection.execute(statement);
        }
      }
      
      console.log('✅ Database seeded successfully');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }
};


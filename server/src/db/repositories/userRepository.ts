import { pool } from '../config.js';
import { User } from '../../types.js';

/**
 * 用户数据仓库
 */
export class UserRepository {
  /**
   * 将数据库行转换为 User 对象
   */
  private static rowToUser(row: any): User {
    return {
      id: row.id,
      handle: row.handle,
      name: row.name,
      avatar: row.avatar,
      walletAddress: row.wallet_address,
      isVerified: row.is_verified,
      fiatDetails: row.bank_name ? {
        bankName: row.bank_name,
        accountNumber: row.account_number,
        accountName: row.account_name,
      } : undefined,
    };
  }

  /**
   * 获取所有用户
   */
  static async findAll(search?: string, verified?: boolean): Promise<User[]> {
    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(handle) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    if (verified !== undefined) {
      query += ` AND is_verified = $${paramIndex}`;
      params.push(verified);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map(this.rowToUser);
  }

  /**
   * 根据 ID 获取用户
   */
  static async findById(id: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToUser(result.rows[0]);
  }

  /**
   * 根据 handle 获取用户
   */
  static async findByHandle(handle: string): Promise<User | null> {
    const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(handle) = LOWER($1)',
      [normalizedHandle]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToUser(result.rows[0]);
  }

  /**
   * 根据钱包地址获取用户
   */
  static async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [walletAddress]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToUser(result.rows[0]);
  }

  /**
   * 创建用户
   */
  static async create(user: Omit<User, 'id'> & { id?: string }): Promise<User> {
    const id = user.id || `u${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const result = await pool.query(
      `INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        user.handle,
        user.name,
        user.avatar,
        user.walletAddress,
        user.isVerified || false,
        user.fiatDetails?.bankName || null,
        user.fiatDetails?.accountNumber || null,
        user.fiatDetails?.accountName || null,
      ]
    );
    
    return this.rowToUser(result.rows[0]);
  }

  /**
   * 更新用户
   */
  static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.handle !== undefined) {
      fields.push(`handle = $${paramIndex++}`);
      values.push(updates.handle);
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.avatar !== undefined) {
      fields.push(`avatar = $${paramIndex++}`);
      values.push(updates.avatar);
    }
    if (updates.walletAddress !== undefined) {
      fields.push(`wallet_address = $${paramIndex++}`);
      values.push(updates.walletAddress);
    }
    if (updates.isVerified !== undefined) {
      fields.push(`is_verified = $${paramIndex++}`);
      values.push(updates.isVerified);
    }
    if (updates.fiatDetails) {
      if (updates.fiatDetails.bankName !== undefined) {
        fields.push(`bank_name = $${paramIndex++}`);
        values.push(updates.fiatDetails.bankName);
      }
      if (updates.fiatDetails.accountNumber !== undefined) {
        fields.push(`account_number = $${paramIndex++}`);
        values.push(updates.fiatDetails.accountNumber);
      }
      if (updates.fiatDetails.accountName !== undefined) {
        fields.push(`account_name = $${paramIndex++}`);
        values.push(updates.fiatDetails.accountName);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }
    return this.rowToUser(result.rows[0]);
  }
}


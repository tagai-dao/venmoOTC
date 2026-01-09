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
      isVerified: Boolean(row.is_verified),
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

    if (search) {
      query += ` AND (LOWER(name) LIKE ? OR LOWER(handle) LIKE ?)`;
      const searchPattern = `%${search.toLowerCase()}%`;
      params.push(searchPattern, searchPattern);
    }

    if (verified !== undefined) {
      query += ` AND is_verified = ?`;
      params.push(verified ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    const result = rows as any[];
    return result.map(this.rowToUser);
  }

  /**
   * 根据 ID 获取用户
   */
  static async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToUser(result[0]);
  }

  /**
   * 根据 handle 获取用户
   */
  static async findByHandle(handle: string): Promise<User | null> {
    const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE LOWER(handle) = LOWER(?)',
      [normalizedHandle]
    );
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToUser(result[0]);
  }

  /**
   * 根据钱包地址获取用户
   */
  static async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE LOWER(wallet_address) = LOWER(?)',
      [walletAddress]
    );
    const result = rows as any[];
    if (result.length === 0) {
      return null;
    }
    return this.rowToUser(result[0]);
  }

  /**
   * 创建用户
   */
  static async create(user: Omit<User, 'id'> & { id?: string }): Promise<User> {
    const id = user.id || `u${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await pool.execute(
      `INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.handle,
        user.name,
        user.avatar,
        user.walletAddress,
        user.isVerified ? 1 : 0,
        user.fiatDetails?.bankName || null,
        user.fiatDetails?.accountNumber || null,
        user.fiatDetails?.accountName || null,
      ]
    );
    
    return this.findById(id) as Promise<User>;
  }

  /**
   * 更新用户
   */
  static async update(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.handle !== undefined) {
      fields.push(`handle = ?`);
      values.push(updates.handle);
    }
    if (updates.name !== undefined) {
      fields.push(`name = ?`);
      values.push(updates.name);
    }
    if (updates.avatar !== undefined) {
      fields.push(`avatar = ?`);
      values.push(updates.avatar);
    }
    if (updates.walletAddress !== undefined) {
      fields.push(`wallet_address = ?`);
      values.push(updates.walletAddress);
    }
    if (updates.isVerified !== undefined) {
      fields.push(`is_verified = ?`);
      values.push(updates.isVerified ? 1 : 0);
    }
    if (updates.fiatDetails) {
      if (updates.fiatDetails.bankName !== undefined) {
        fields.push(`bank_name = ?`);
        values.push(updates.fiatDetails.bankName);
      }
      if (updates.fiatDetails.accountNumber !== undefined) {
        fields.push(`account_number = ?`);
        values.push(updates.fiatDetails.accountNumber);
      }
      if (updates.fiatDetails.accountName !== undefined) {
        fields.push(`account_name = ?`);
        values.push(updates.fiatDetails.accountName);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }
}


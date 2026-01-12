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
    // twitterAccessToken 不暴露给前端（安全考虑），只在内部使用
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
      // twitterAccessToken 存储在数据库中，但不包含在 User 类型中（安全考虑）
      // 需要时直接从数据库查询
    } as User;
  }
  
  /**
   * 获取用户的 Twitter accessToken（内部使用，不暴露给前端）
   */
  static async getTwitterAccessToken(userId: string): Promise<string | null> {
    try {
      const [rows] = await pool.execute(
        'SELECT twitter_access_token FROM users WHERE id = ?',
        [userId]
      );
      const result = rows as any[];
      const token = result[0]?.twitter_access_token || null;
      
      if (token) {
        console.log('✅ Found Twitter accessToken in database:', {
          userId,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 30) + '...',
        });
      } else {
        console.log('⚠️ No Twitter accessToken found in database for user:', userId);
      }
      
      return token;
    } catch (error: any) {
      console.error('❌ Error retrieving Twitter accessToken:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户的 Twitter refresh token
   */
  static async getTwitterRefreshToken(userId: string): Promise<string | null> {
    try {
      const [rows] = await pool.execute(
        'SELECT twitter_refresh_token FROM users WHERE id = ?',
        [userId]
      );
      const result = rows as any[];
      return result[0]?.twitter_refresh_token || null;
    } catch (error: any) {
      console.error('❌ Error retrieving Twitter refreshToken:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户的 Twitter token 过期时间
   */
  static async getTwitterTokenExpiresAt(userId: string): Promise<number | null> {
    try {
      const [rows] = await pool.execute(
        'SELECT twitter_token_expires_at FROM users WHERE id = ?',
        [userId]
      );
      const result = rows as any[];
      return result[0]?.twitter_token_expires_at || null;
    } catch (error: any) {
      console.error('❌ Error retrieving Twitter token expiresAt:', error.message);
      throw error;
    }
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
      `INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name, twitter_access_token, twitter_refresh_token, twitter_token_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        (user as any).twitterAccessToken || null,
        (user as any).twitterRefreshToken || null,
        (user as any).twitterTokenExpiresAt || null,
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
    if ((updates as any).twitterAccessToken !== undefined) {
      const tokenValue = (updates as any).twitterAccessToken;
      fields.push(`twitter_access_token = ?`);
      values.push(tokenValue || null);
      
      // 添加调试日志
      if (tokenValue) {
        console.log('💾 Storing Twitter accessToken:', {
          userId: id,
          tokenLength: tokenValue.length,
          tokenPreview: tokenValue.substring(0, 30) + '...',
        });
      } else {
        console.log('🗑️ Clearing Twitter accessToken for user:', id);
      }
    }

    if ((updates as any).twitterRefreshToken !== undefined) {
      const refreshTokenValue = (updates as any).twitterRefreshToken;
      fields.push(`twitter_refresh_token = ?`);
      values.push(refreshTokenValue || null);
      
      if (refreshTokenValue) {
        console.log('💾 Storing Twitter refreshToken:', {
          userId: id,
          tokenLength: refreshTokenValue.length,
        });
      } else {
        console.log('🗑️ Clearing Twitter refreshToken for user:', id);
      }
    }

    if ((updates as any).twitterTokenExpiresAt !== undefined) {
      const expiresAtValue = (updates as any).twitterTokenExpiresAt;
      fields.push(`twitter_token_expires_at = ?`);
      values.push(expiresAtValue || null);
      
      if (expiresAtValue) {
        console.log('💾 Storing Twitter token expiresAt:', {
          userId: id,
          expiresAt: new Date(expiresAtValue * 1000).toISOString(),
        });
      } else {
        console.log('🗑️ Clearing Twitter token expiresAt for user:', id);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    console.log('💾 Executing SQL update:', {
      userId: id,
      sql: sql.substring(0, 200) + '...',
      fieldCount: fields.length - 1, // 减去 updated_at
      hasTwitterToken: fields.some(f => f.includes('twitter_access_token')),
    });
    
    const [result] = await pool.execute(sql, values);
    const updateResult = result as any;
    console.log('💾 SQL update result:', {
      userId: id,
      affectedRows: updateResult.affectedRows,
      changedRows: updateResult.changedRows,
    });

    // 立即验证更新是否成功
    if ((updates as any).twitterAccessToken !== undefined) {
      const tokenValue = (updates as any).twitterAccessToken;
      if (tokenValue) {
        // 等待一小段时间确保写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 直接查询数据库验证
        const [verifyRows] = await pool.execute(
          'SELECT twitter_access_token FROM users WHERE id = ?',
          [id]
        );
        const verifyResult = verifyRows as any[];
        const storedToken = verifyResult[0]?.twitter_access_token || null;
        
        if (storedToken) {
          console.log('✅ Verified: Twitter accessToken stored in database');
          console.log('✅ Stored token length:', storedToken.length);
        } else {
          console.error('❌ ERROR: Twitter accessToken NOT found in database after update!');
          console.error('❌ User ID:', id);
          console.error('❌ Expected token length:', tokenValue.length);
        }
      }
    }

    return this.findById(id);
  }
}


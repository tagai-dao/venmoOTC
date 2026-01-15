import { D1Adapter } from '../d1Adapter.js';
import { User } from '../../types.js';

/**
 * 用户数据仓库（D1 版本）
 */
export class UserRepository {
  constructor(private db: D1Adapter) {}

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
        country: row.country || undefined,
      } : undefined,
    } as User;
  }
  
  /**
   * 获取用户的 Twitter accessToken（内部使用，不暴露给前端）
   */
  async getTwitterAccessToken(userId: string): Promise<string | null> {
    try {
      const row = await this.db.queryOne<{ twitter_access_token: string | null }>(
        'SELECT twitter_access_token FROM users WHERE id = ?',
        [userId]
      );
      
      const token = row?.twitter_access_token || null;
      
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
  async getTwitterRefreshToken(userId: string): Promise<string | null> {
    try {
      const row = await this.db.queryOne<{ twitter_refresh_token: string | null }>(
        'SELECT twitter_refresh_token FROM users WHERE id = ?',
        [userId]
      );
      return row?.twitter_refresh_token || null;
    } catch (error: any) {
      console.error('❌ Error retrieving Twitter refreshToken:', error.message);
      throw error;
    }
  }

  /**
   * 获取用户的 Twitter token 过期时间
   */
  async getTwitterTokenExpiresAt(userId: string): Promise<number | null> {
    try {
      const row = await this.db.queryOne<{ twitter_token_expires_at: number | null }>(
        'SELECT twitter_token_expires_at FROM users WHERE id = ?',
        [userId]
      );
      return row?.twitter_token_expires_at || null;
    } catch (error: any) {
      console.error('❌ Error retrieving Twitter token expiresAt:', error.message);
      throw error;
    }
  }

  /**
   * 获取所有用户
   */
  async findAll(search?: string, verified?: boolean): Promise<User[]> {
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

    const rows = await this.db.query(query, params);
    return rows.map(UserRepository.rowToUser);
  }

  /**
   * 根据 ID 获取用户
   */
  async findById(id: string): Promise<User | null> {
    const row = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) {
      return null;
    }
    return UserRepository.rowToUser(row);
  }

  /**
   * 根据 handle 获取用户
   */
  async findByHandle(handle: string): Promise<User | null> {
    const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE LOWER(handle) = LOWER(?)',
      [normalizedHandle]
    );
    if (!row) {
      return null;
    }
    return UserRepository.rowToUser(row);
  }

  /**
   * 根据钱包地址获取用户
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const row = await this.db.queryOne(
      'SELECT * FROM users WHERE LOWER(wallet_address) = LOWER(?)',
      [walletAddress]
    );
    if (!row) {
      return null;
    }
    return UserRepository.rowToUser(row);
  }

  /**
   * 创建用户
   */
  async create(user: Omit<User, 'id'> & { id?: string; twitterAccessToken?: string; twitterRefreshToken?: string; twitterTokenExpiresAt?: number }): Promise<User> {
    const id = user.id || `u${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    await this.db.execute(
      `INSERT INTO users (id, handle, name, avatar, wallet_address, is_verified, bank_name, account_number, account_name, country, twitter_access_token, twitter_refresh_token, twitter_token_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        user.fiatDetails?.country || null,
        user.twitterAccessToken || null,
        user.twitterRefreshToken || null,
        user.twitterTokenExpiresAt || null,
      ]
    );
    
    return this.findById(id) as Promise<User>;
  }

  /**
   * 更新用户
   */
  async update(id: string, updates: Partial<User> & { twitterAccessToken?: string | null; twitterRefreshToken?: string | null; twitterTokenExpiresAt?: number | null }): Promise<User | null> {
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
      if (updates.fiatDetails.country !== undefined) {
        fields.push(`country = ?`);
        values.push(updates.fiatDetails.country);
      }
    }
    if (updates.twitterAccessToken !== undefined) {
      const tokenValue = updates.twitterAccessToken;
      fields.push(`twitter_access_token = ?`);
      values.push(tokenValue || null);
      
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

    if (updates.twitterRefreshToken !== undefined) {
      const refreshTokenValue = updates.twitterRefreshToken;
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

    if (updates.twitterTokenExpiresAt !== undefined) {
      const expiresAtValue = updates.twitterTokenExpiresAt;
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

    // SQLite 使用 strftime 更新时间戳
    fields.push(`updated_at = strftime('%s', 'now')`);
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    console.log('💾 Executing SQL update:', {
      userId: id,
      sql: sql.substring(0, 200) + '...',
      fieldCount: fields.length - 1,
      hasTwitterToken: fields.some(f => f.includes('twitter_access_token')),
    });
    
    await this.db.execute(sql, values);

    return this.findById(id);
  }
}

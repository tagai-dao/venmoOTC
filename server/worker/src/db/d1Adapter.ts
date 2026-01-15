import { D1Database, D1Result } from '@cloudflare/workers-types';

/**
 * D1 数据库适配器
 * 将原来的 MySQL pool 调用转换为 D1 调用
 */
export class D1Adapter {
  constructor(private db: D1Database) {}

  /**
   * 执行 SQL 语句（INSERT, UPDATE, DELETE）
   */
  async execute(query: string, params: any[] = []): Promise<D1Result> {
    const statement = this.db.prepare(query);
    return statement.bind(...params).run();
  }

  /**
   * 查询多条记录
   */
  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    const statement = this.db.prepare(query);
    const result = await statement.bind(...params).all<T>();
    return result.results || [];
  }

  /**
   * 查询单条记录
   */
  async queryOne<T = any>(query: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(query, params);
    return results[0] || null;
  }

  /**
   * 获取第一条记录（兼容 MySQL 的 first() 方法）
   */
  async first<T = any>(query: string, params: any[] = []): Promise<T | null> {
    const statement = this.db.prepare(query);
    const result = await statement.bind(...params).first<T>();
    return result || null;
  }

  /**
   * 兼容原来的 pool.execute 方法
   * 返回格式：[rows, fields] 类似 MySQL
   */
  async executeCompat(query: string, params: any[] = []): Promise<[any[], any]> {
    const result = await this.execute(query, params);
    // D1 的 run() 返回 { success, meta }，我们需要模拟 MySQL 的格式
    return [[], {}]; // 简化版本，实际使用时可能需要调整
  }

  /**
   * 获取连接（兼容性方法，D1 不需要连接池）
   */
  async getConnection() {
    return {
      execute: this.execute.bind(this),
      query: this.query.bind(this),
      queryOne: this.queryOne.bind(this),
      first: this.first.bind(this),
      release: () => {}, // D1 不需要释放连接
    };
  }

  /**
   * 开始事务（D1 支持事务）
   */
  async transaction<T>(callback: (tx: D1Adapter) => Promise<T>): Promise<T> {
    // D1 使用 batch() 进行事务
    // 这里简化处理，实际使用时需要根据具体需求实现
    return callback(this);
  }
}

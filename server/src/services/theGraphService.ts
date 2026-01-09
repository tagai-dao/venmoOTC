import axios from 'axios';
import { config } from '../config.js';

/**
 * The Graph 服务
 * 用于查询链上历史交易、转账记录等
 */
export class TheGraphService {
  private endpoint: string;

  constructor() {
    this.endpoint = config.theGraph.endpoint;
    
    if (!this.endpoint || this.endpoint.includes('username')) {
      console.warn('⚠️ The Graph endpoint not configured. Set THE_GRAPH_ENDPOINT in .env to enable.');
    }
  }

  /**
   * 查询 USDT 转账历史
   */
  async getUSDTTransfers(
    address: string,
    limit: number = 10,
    skip: number = 0
  ): Promise<any[]> {
    if (!this.endpoint || this.endpoint.includes('username')) {
      console.warn('The Graph endpoint not configured');
      return [];
    }

    try {
      const query = `
        query GetUSDTTransfers($address: String!, $limit: Int!, $skip: Int!) {
          transfers(
            where: {
              or: [
                { from: $address },
                { to: $address }
              ]
            }
            first: $limit
            skip: $skip
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            from
            to
            value
            timestamp
            transaction {
              id
              blockNumber
            }
          }
        }
      `;

      const response = await axios.post(this.endpoint, {
        query,
        variables: {
          address: address.toLowerCase(),
          limit,
          skip,
        },
      });

      if (response.data.errors) {
        console.error('The Graph query errors:', response.data.errors);
        return [];
      }

      return response.data.data?.transfers || [];
    } catch (error: any) {
      console.error('Failed to query The Graph:', error.message);
      return [];
    }
  }

  /**
   * 查询特定交易对之间的转账
   */
  async getTransfersBetween(
    fromAddress: string,
    toAddress: string,
    limit: number = 10
  ): Promise<any[]> {
    if (!this.endpoint || this.endpoint.includes('username')) {
      return [];
    }

    try {
      const query = `
        query GetTransfersBetween($from: String!, $to: String!, $limit: Int!) {
          transfers(
            where: {
              from: $from
              to: $to
            }
            first: $limit
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            from
            to
            value
            timestamp
            transaction {
              id
              blockNumber
            }
          }
        }
      `;

      const response = await axios.post(this.endpoint, {
        query,
        variables: {
          from: fromAddress.toLowerCase(),
          to: toAddress.toLowerCase(),
          limit,
        },
      });

      if (response.data.errors) {
        console.error('The Graph query errors:', response.data.errors);
        return [];
      }

      return response.data.data?.transfers || [];
    } catch (error: any) {
      console.error('Failed to query The Graph:', error.message);
      return [];
    }
  }

  /**
   * 查询地址的总接收金额
   */
  async getTotalReceived(address: string): Promise<number> {
    if (!this.endpoint || this.endpoint.includes('username')) {
      return 0;
    }

    try {
      const query = `
        query GetTotalReceived($address: String!) {
          transfers(
            where: { to: $address }
            first: 1000
          ) {
            value
          }
        }
      `;

      const response = await axios.post(this.endpoint, {
        query,
        variables: {
          address: address.toLowerCase(),
        },
      });

      if (response.data.errors) {
        console.error('The Graph query errors:', response.data.errors);
        return 0;
      }

      const transfers = response.data.data?.transfers || [];
      const total = transfers.reduce((sum: number, transfer: any) => {
        // value 通常是 BigInt，需要转换为数字
        return sum + parseFloat(transfer.value || '0');
      }, 0);

      return total;
    } catch (error: any) {
      console.error('Failed to query The Graph:', error.message);
      return 0;
    }
  }

  /**
   * 查询地址的总发送金额
   */
  async getTotalSent(address: string): Promise<number> {
    if (!this.endpoint || this.endpoint.includes('username')) {
      return 0;
    }

    try {
      const query = `
        query GetTotalSent($address: String!) {
          transfers(
            where: { from: $address }
            first: 1000
          ) {
            value
          }
        }
      `;

      const response = await axios.post(this.endpoint, {
        query,
        variables: {
          address: address.toLowerCase(),
        },
      });

      if (response.data.errors) {
        console.error('The Graph query errors:', response.data.errors);
        return 0;
      }

      const transfers = response.data.data?.transfers || [];
      const total = transfers.reduce((sum: number, transfer: any) => {
        return sum + parseFloat(transfer.value || '0');
      }, 0);

      return total;
    } catch (error: any) {
      console.error('Failed to query The Graph:', error.message);
      return 0;
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return !!(this.endpoint && !this.endpoint.includes('username'));
  }
}

// 导出单例实例
export const theGraphService = new TheGraphService();

import { Currency, Transaction, User } from './utils';

const API_BASE_URL = 'http://localhost:3001';

// API 请求辅助函数
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    // 如果有 token，添加到请求头
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🌐 API Request:', url, options.method || 'GET');
    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        console.log('📥 API Response status:', response.status, response.statusText);

        if (!response.ok) {
            let errorMessage = `API error: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
                console.error('❌ API Error:', errorData);
            } catch (e) {
                const text = await response.text();
                console.error('❌ API Error (non-JSON):', text);
                errorMessage = text || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('✅ API Response data:', data);
        return data;
    } catch (error: any) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error('❌ Network error - 无法连接到服务器。请确保服务器正在运行。');
            throw new Error('无法连接到服务器。请确保服务器正在运行在 http://localhost:3001');
        }
        throw error;
    }
}

export const Services = {
    // --- 1. Authentication Service ---
    auth: {
        loginWithX: async (xHandle?: string, xToken?: string, xTokenSecret?: string): Promise<User> => {
            console.log('🔐 Attempting login with xHandle:', xHandle);
            try {
                const response = await apiRequest<{ user: User; token: string }>('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        xHandle,
                        xToken,
                        xTokenSecret,
                    }),
                });
                
                // 存储 token 供后续请求使用
                if (response.token) {
                    localStorage.setItem('auth_token', response.token);
                    console.log('✅ Login successful, token stored');
                }
                
                if (!response.user) {
                    throw new Error('服务器返回的用户数据无效');
                }
                
                console.log('✅ Login successful, user:', response.user.handle);
                return response.user;
            } catch (error: any) {
                console.error('❌ Login failed:', error);
                throw error;
            }
        },
        logout: async () => {
            try {
                await apiRequest('/api/auth/logout', {
                    method: 'POST',
                });
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                localStorage.removeItem('auth_token');
            }
        }
    },

    // --- 2. Blockchain Service ---
    blockchain: {
        getBalance: async (walletAddress: string, currency: Currency): Promise<number> => {
            const response = await apiRequest<{ balance: number; currency: string; address: string; timestamp: number }>(
                `/api/blockchain/balance/${walletAddress}/${currency}`
            );
            return response.balance;
        },

        sendUSDT: async (toAddress: string, amount: number, fromAddress: string): Promise<string> => {
            const response = await apiRequest<{
                txHash: string;
                toAddress: string;
                amount: number;
                fromAddress: string;
                status: string;
                blockNumber: number;
                timestamp: number;
            }>('/api/blockchain/send', {
                method: 'POST',
                body: JSON.stringify({
                    fromAddress,
                    toAddress,
                    amount,
                }),
            });
            return response.txHash;
        }
    },

    // --- 3. X (Twitter) Service ---
    social: {
        postTweet: async (content: string, accessToken?: string): Promise<string> => {
            const response = await apiRequest<{
                tweetId: string;
                content: string;
                createdAt: string;
                url: string;
            }>('/api/social/tweet', {
                method: 'POST',
                body: JSON.stringify({
                    content,
                    accessToken,
                }),
            });
            return response.tweetId;
        },

        replyToTweet: async (originalTweetId: string, content: string, accessToken?: string): Promise<string> => {
            const response = await apiRequest<{
                replyId: string;
                originalTweetId: string;
                content: string;
                createdAt: string;
                url: string;
            }>('/api/social/reply', {
                method: 'POST',
                body: JSON.stringify({
                    originalTweetId,
                    content,
                    accessToken,
                }),
            });
            return response.replyId;
        }
    },

    // --- 4. Transactions Service ---
    transactions: {
        getTransactions: async (userId?: string, type?: string, privacy?: string): Promise<Transaction[]> => {
            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);
            if (type) params.append('type', type);
            if (privacy) params.append('privacy', privacy);
            
            const queryString = params.toString();
            const endpoint = `/api/transactions${queryString ? `?${queryString}` : ''}`;
            
            const response = await apiRequest<{ transactions: Transaction[] }>(endpoint);
            return response.transactions;
        },

        createTransaction: async (transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> => {
            const response = await apiRequest<{ transaction: Transaction }>('/api/transactions', {
                method: 'POST',
                body: JSON.stringify({ transaction }),
            });
            return response.transaction;
        },

        updateTransaction: async (id: string, updates: Partial<Transaction> & { newReply?: any }): Promise<Transaction> => {
            const response = await apiRequest<{ transaction: Transaction }>(`/api/transactions/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ updates }),
            });
            return response.transaction;
        }
    },

    // --- 5. Users Service ---
    users: {
        getUsers: async (search?: string, verified?: boolean): Promise<User[]> => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (verified !== undefined) params.append('verified', verified.toString());
            
            const queryString = params.toString();
            const endpoint = `/api/users${queryString ? `?${queryString}` : ''}`;
            
            const response = await apiRequest<{ users: User[] }>(endpoint);
            return response.users;
        },

        getUser: async (id: string): Promise<User> => {
            const response = await apiRequest<{ user: User }>(`/api/users/${id}`);
            return response.user;
        }
    }
};
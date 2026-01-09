import { Currency, Transaction, User } from './utils';

// API 基础地址
// 如果需要更改端口，请直接修改下面的地址
// 例如：如果后端运行在 3001 端口，改为 'http://localhost:3001'
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
        /**
         * Privy 登录（同步用户到后端）
         */
        loginWithPrivy: async (privyData: {
            walletAddress: string;
            handle?: string;
            name: string;
            avatar?: string;
            privyUserId: string;
        }): Promise<{ user: User; token: string }> => {
            const response = await apiRequest<{ user: User; token: string }>('/api/auth/privy', {
                method: 'POST',
                body: JSON.stringify(privyData),
            });
            
            // 存储 token 和用户信息
            if (response.token) {
                localStorage.setItem('auth_token', response.token);
                localStorage.setItem('current_user', JSON.stringify(response.user));
                console.log('✅ Privy login successful, token stored');
            }
            
            return response;
        },
        
        /**
         * Twitter OAuth 2.0 授权登录
         * 重定向到后端授权端点
         */
        loginWithTwitter: () => {
            window.location.href = `${API_BASE_URL}/api/auth/twitter/authorize`;
        },
        
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
                
                // 存储 token 和用户信息供后续请求使用
                if (response.token) {
                    localStorage.setItem('auth_token', response.token);
                    console.log('✅ Login successful, token stored');
                }
                
                if (!response.user) {
                    throw new Error('服务器返回的用户数据无效');
                }
                
                // 存储用户信息到 localStorage，以便刷新页面后恢复
                localStorage.setItem('current_user', JSON.stringify(response.user));
                
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
                localStorage.removeItem('current_user');
            }
        },
        getCurrentUser: (): User | null => {
            // 从 localStorage 恢复用户信息
            const userStr = localStorage.getItem('current_user');
            if (userStr) {
                try {
                    return JSON.parse(userStr) as User;
                } catch (error) {
                    console.error('Failed to parse current user from localStorage:', error);
                    return null;
                }
            }
            return null;
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
        },

        selectTrader: async (transactionId: string, traderId: string): Promise<Transaction> => {
            const response = await apiRequest<{ transaction: Transaction }>(`/api/transactions/${transactionId}/select-trader`, {
                method: 'POST',
                body: JSON.stringify({ traderId }),
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
    },

    // --- 6. Notifications Service ---
    notifications: {
        getNotifications: async (includeRead: boolean = false): Promise<any[]> => {
            const params = new URLSearchParams();
            if (includeRead) params.append('includeRead', 'true');
            
            const queryString = params.toString();
            const endpoint = `/api/notifications${queryString ? `?${queryString}` : ''}`;
            
            const response = await apiRequest<{ notifications: any[] }>(endpoint);
            return response.notifications;
        },

        getUnreadCount: async (): Promise<number> => {
            const response = await apiRequest<{ count: number }>('/api/notifications/unread/count');
            return response.count;
        },

        markAsRead: async (id: string): Promise<void> => {
            await apiRequest(`/api/notifications/${id}/read`, {
                method: 'PUT',
            });
        },

        markAllAsRead: async (): Promise<void> => {
            await apiRequest('/api/notifications/read/all', {
                method: 'PUT',
            });
        },

        deleteNotification: async (id: string): Promise<void> => {
            await apiRequest(`/api/notifications/${id}`, {
                method: 'DELETE',
            });
        }
    },

    // --- 7. Social Interactions Service ---
    socialInteractions: {
        likeTransaction: async (transactionId: string): Promise<{ hasLiked: boolean; likes: number }> => {
            try {
                const response = await apiRequest<{ success: boolean; hasLiked: boolean; likes: number }>(
                    `/api/social-interactions/${transactionId}/like`,
                    { method: 'POST' }
                );
                return {
                    hasLiked: response.hasLiked,
                    likes: response.likes
                };
            } catch (error: any) {
                console.error('Like transaction API error:', error);
                throw error;
            }
        },

        checkUserLiked: async (transactionId: string): Promise<boolean> => {
            const response = await apiRequest<{ hasLiked: boolean }>(
                `/api/social-interactions/${transactionId}/liked`
            );
            return response.hasLiked;
        },

        addComment: async (transactionId: string, text: string, proof?: string): Promise<{ commentId: string; comments: number; transaction: Transaction }> => {
            const response = await apiRequest<{ commentId: string; comments: number; transaction: Transaction }>(
                `/api/social-interactions/${transactionId}/comment`,
                {
                    method: 'POST',
                    body: JSON.stringify({ text, proof }),
                }
            );
            return response;
        },

        deleteComment: async (commentId: string): Promise<void> => {
            await apiRequest(`/api/social-interactions/comment/${commentId}`, {
                method: 'DELETE',
            });
        }
    },

    // --- 8. Bids Service ---
    bids: {
        createBid: async (transactionId: string, message?: string): Promise<{ bid: any }> => {
            const response = await apiRequest<{ bid: any }>(`/api/bids/${transactionId}`, {
                method: 'POST',
                body: JSON.stringify({ message }),
            });
            return response;
        },
        getBids: async (transactionId: string): Promise<{ bids: any[] }> => {
            const response = await apiRequest<{ bids: any[] }>(`/api/bids/${transactionId}`);
            return response;
        },
        deleteBid: async (bidId: string): Promise<void> => {
            await apiRequest(`/api/bids/${bidId}`, {
                method: 'DELETE',
            });
        },
    },

    // --- 9. Multisig Service ---
    multisig: {
        createContract: async (transactionId: string, traderAddress: string, usdtAmount: number): Promise<{ multisig: any; message: string }> => {
            const response = await apiRequest<{ multisig: any; message: string }>('/api/multisig/create', {
                method: 'POST',
                body: JSON.stringify({ transactionId, traderAddress, usdtAmount }),
            });
            return response;
        },
        sendUSDTToMultisig: async (transactionId: string): Promise<{ txHash: string; contractAddress: string; message: string }> => {
            const response = await apiRequest<{ txHash: string; contractAddress: string; message: string }>('/api/multisig/send-usdt', {
                method: 'POST',
                body: JSON.stringify({ transactionId }),
            });
            return response;
        },
        activateMultisig: async (transactionId: string): Promise<{ txHash: string; message: string }> => {
            const response = await apiRequest<{ txHash: string; message: string }>('/api/multisig/activate', {
                method: 'POST',
                body: JSON.stringify({ transactionId }),
            });
            return response;
        },
        getMultisig: async (transactionId: string): Promise<{ multisig: any }> => {
            const response = await apiRequest<{ multisig: any }>(`/api/multisig/${transactionId}`);
            return response;
        },
        signByTrader: async (transactionId: string): Promise<{ message: string }> => {
            const response = await apiRequest<{ message: string }>('/api/multisig/sign-trader', {
                method: 'POST',
                body: JSON.stringify({ transactionId }),
            });
            return response;
        },
        signByRequester: async (transactionId: string): Promise<{ txHash?: string; message: string }> => {
            const response = await apiRequest<{ txHash?: string; message: string }>('/api/multisig/sign-requester', {
                method: 'POST',
                body: JSON.stringify({ transactionId }),
            });
            return response;
        },
    },
};
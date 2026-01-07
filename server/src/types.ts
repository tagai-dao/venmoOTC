// 共享类型定义（与前端保持一致）
export enum Currency {
  USDT = 'USDT',
  NGN = 'NGN',
  VES = 'VES',
  USD = 'USD'
}

export enum Privacy {
  PUBLIC_X = 'Public_X',
  PUBLIC = 'Public',
  FRIENDS = 'Friends',
  PRIVATE = 'Private'
}

export enum TransactionType {
  PAYMENT = 'PAYMENT',
  REQUEST = 'REQUEST',
}

export enum OTCState {
  NONE = 'NONE',
  OPEN_REQUEST = 'OPEN_REQUEST',
  AWAITING_FIAT_PAYMENT = 'AWAITING_FIAT_PAYMENT',
  AWAITING_FIAT_CONFIRMATION = 'AWAITING_FIAT_CONFIRMATION',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  walletAddress: string;
  isVerified: boolean;
  fiatDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface TransactionReply {
  id: string;
  user: User;
  text: string;
  proof?: string;
  timestamp: number;
}

export interface Transaction {
  id: string;
  fromUser: User;
  toUser: User | null;
  amount: number;
  currency: Currency;
  note: string;
  sticker?: string;
  timestamp: number;
  privacy: Privacy;
  type: TransactionType;
  xPostId?: string;
  isOTC: boolean;
  otcState: OTCState;
  otcFiatCurrency?: Currency;
  otcOfferAmount?: number;
  otcProofImage?: string;
  relatedTransactionId?: string;
  likes: number;
  comments: number;
  replies?: TransactionReply[];
}

// API 请求/响应类型
export interface LoginRequest {
  xToken?: string;
  xTokenSecret?: string;
}

export interface LoginResponse {
  user: User;
  token?: string;
}

export interface BalanceRequest {
  address: string;
  currency: Currency;
}

export interface SendUSDTRequest {
  toAddress: string;
  amount: number;
  fromAddress: string;
}

export interface PostTweetRequest {
  content: string;
  accessToken?: string;
}

export interface ReplyTweetRequest {
  originalTweetId: string;
  content: string;
  accessToken?: string;
}

export interface CreateTransactionRequest {
  transaction: Omit<Transaction, 'id' | 'timestamp'>;
}

export interface UpdateTransactionRequest {
  updates: Partial<Transaction> & { newReply?: TransactionReply };
}


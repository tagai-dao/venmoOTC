// 从原项目复制类型定义
export enum Currency {
  USDT = 'USDT',
  NGN = 'NGN',
  VES = 'VES',
  USD = 'USD',
  BNB = 'BNB'
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
  BIDDING = 'BIDDING',
  SELECTED_TRADER = 'SELECTED_TRADER',
  USDT_IN_ESCROW = 'USDT_IN_ESCROW',
  AWAITING_FIAT_PAYMENT = 'AWAITING_FIAT_PAYMENT',
  AWAITING_FIAT_CONFIRMATION = 'AWAITING_FIAT_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
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
    country?: string;
  };
}

export interface TransactionReply {
  id: string;
  user: User;
  text: string;
  proof?: string;
  privacy?: Privacy;
  xCommentId?: string;
  timestamp: number;
}

export interface Bid {
  id: string;
  userId: string;
  user: User;
  transactionId: string;
  timestamp: number;
  message?: string;
}

export interface Transaction {
  id: string;
  fromUser: User;
  toUser?: User;
  amount: number;
  currency: Currency;
  note?: string;
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
  paymentProofUrl?: string;
  relatedTransactionId?: string;
  selectedTraderId?: string;
  multisigContractAddress?: string;
  usdtInEscrow: boolean;
  likes: number;
  comments: number;
  replies?: TransactionReply[];
  bids?: Bid[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  transactionId?: string;
  relatedUserId?: string;
  isRead: boolean;
  createdAt: number;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Workers 环境类型定义
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
  BNB_CHAIN_RPC_URL: string;
  USDT_CONTRACT_ADDRESS: string;
  MULTISIG_CONTRACT_ADDRESS: string;
  PRIVATE_KEY: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  X_API_KEY?: string;
  X_API_SECRET?: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_TOKEN_SECRET?: string;
  X_BEARER_TOKEN?: string;
  [key: string]: any; // 索引签名，允许动态环境变量
}

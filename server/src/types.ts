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
  BIDDING = 'BIDDING', // People can bid on the request (for fiat requests)
  SELECTED_TRADER = 'SELECTED_TRADER', // Requester selected a trader
  USDT_IN_ESCROW = 'USDT_IN_ESCROW', // USDT sent to multisig contract, waiting for fiat payment
  AWAITING_FIAT_PAYMENT = 'AWAITING_FIAT_PAYMENT', // Kept for backward compatibility
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
  };
}

export interface TransactionReply {
  id: string;
  user: User;
  text: string;
  proof?: string;
  timestamp: number;
  privacy?: Privacy;
  xCommentId?: string;
}

export interface Bid {
  id: string;
  userId: string;
  user: User;
  transactionId: string;
  timestamp: number;
  message?: string; // Optional message from bidder
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
  fiatRejectionCount?: number;
  
  // New fields for fiat request flow
  bids?: Bid[]; // List of bids from traders
  selectedTraderId?: string; // ID of the selected trader
  multisigContractAddress?: string; // Address of the 2/2 multisig contract
  usdtInEscrow?: boolean; // Whether USDT has been sent to multisig
  
  likes: number;
  comments: number;
  replies?: TransactionReply[];
}

// API 请求/响应类型
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
  tweetContent?: string; // 用户编写的推文内容（如果选择 PUBLIC_X）
}

export interface CreateTransactionResponse {
  transaction: Transaction;
  twitterAuthStatus?: {
    needsReauth: boolean; // 是否需要重新授权
    reason?: string; // 原因（如：'no_access_token' | 'tweet_failed'）
    error?: string; // 错误信息（如果有）
  };
}

export interface UpdateTransactionRequest {
  updates: Partial<Transaction> & { newReply?: TransactionReply };
}


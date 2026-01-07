export enum Currency {
  USDT = 'USDT',
  NGN = 'NGN', // Nigerian Naira
  VES = 'VES', // Venezuelan Bolívar
  USD = 'USD' // Standard Fiat
}

export enum Privacy {
  PUBLIC_X = 'Public_X',
  PUBLIC = 'Public',
  FRIENDS = 'Friends',
  PRIVATE = 'Private'
}

export enum TransactionType {
  PAYMENT = 'PAYMENT', // Standard Send
  REQUEST = 'REQUEST', // Standard Request (which triggers OTC flow)
}

export enum OTCState {
  NONE = 'NONE', // Not an OTC transaction
  OPEN_REQUEST = 'OPEN_REQUEST', // Step 1: Request made (e.g., A requests USDT)
  AWAITING_FIAT_PAYMENT = 'AWAITING_FIAT_PAYMENT', // Step 2: USDT paid, waiting for Fiat (B pays A Fiat)
  AWAITING_FIAT_CONFIRMATION = 'AWAITING_FIAT_CONFIRMATION', // Step 3: Fiat sent, waiting for A to confirm
  COMPLETED = 'COMPLETED' // Step 4: Done
}

export interface User {
  id: string;
  handle: string; // @username
  name: string;
  avatar: string;
  walletAddress: string;
  isVerified: boolean; // X verification simulation
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
  toUser: User | null; // Null if open request to public
  amount: number;
  currency: Currency;
  note: string;
  sticker?: string;
  timestamp: number;
  privacy: Privacy;
  type: TransactionType;
  
  // X (Twitter) Integration
  xPostId?: string; // The ID of the tweet if posted to X
  
  // OTC Specifics
  isOTC: boolean;
  otcState: OTCState;
  otcFiatCurrency?: Currency; // The counter currency (e.g. if requesting USDT, this is NGN)
  otcOfferAmount?: number; // The amount offered by the requester (counter to 'amount')
  otcProofImage?: string; // URL/Base64 of receipt
  relatedTransactionId?: string; // If this is a child update of another flow
  
  likes: number;
  comments: number;
  replies?: TransactionReply[];
}
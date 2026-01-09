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
  BIDDING = 'BIDDING', // Step 2: People can bid on the request (for fiat requests)
  SELECTED_TRADER = 'SELECTED_TRADER', // Step 3: Requester selected a trader
  USDT_IN_ESCROW = 'USDT_IN_ESCROW', // Step 4: USDT sent to multisig contract, waiting for fiat payment
  AWAITING_FIAT_PAYMENT = 'AWAITING_FIAT_PAYMENT', // Step 2 (old): USDT paid, waiting for Fiat (B pays A Fiat) - kept for backward compatibility
  AWAITING_FIAT_CONFIRMATION = 'AWAITING_FIAT_CONFIRMATION', // Step 3: Fiat sent, waiting for A to confirm
  COMPLETED = 'COMPLETED', // Step 4: Done
  FAILED = 'FAILED' // Request failed (e.g., fiat not received after rejection)
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
  fiatRejectionCount?: number; // Number of times "没有收到法币转账" was clicked (max 2)
  
  // New fields for fiat request flow
  bids?: Bid[]; // List of bids from traders
  selectedTraderId?: string; // ID of the selected trader
  multisigContractAddress?: string; // Address of the 2/2 multisig contract
  usdtInEscrow?: boolean; // Whether USDT has been sent to multisig
  
  likes: number;
  comments: number;
  replies?: TransactionReply[];
}
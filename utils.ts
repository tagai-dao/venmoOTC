// Add TransactionReply and Bid to the types imported from types.ts and re-exported
import { Currency, Privacy, Transaction, TransactionType, User, OTCState, TransactionReply, Bid } from './types';

export { Currency, Privacy, TransactionType, OTCState };
export type { Transaction, User, TransactionReply, Bid };

export const generateId = () => Math.random().toString(36).substr(2, 9);

// --- PRODUCTION CONFIGURATION ---
export const PRODUCTION_CONFIG = {
  BNB_CHAIN_ID: 56,
  USDT_CONTRACT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955', // Real USDT on BSC
  THE_GRAPH_ENDPOINT: 'https://api.thegraph.com/subgraphs/name/username/venmo-otc-bsc', // Placeholder Subgraph
  X_API_BASE: 'https://api.twitter.com/2',
  PRIVY_APP_ID: 'clp...placeholder_app_id'
};
// --------------------------------

// 使用 DiceBear API 生成基于种子的一致头像，确保同一用户在不同浏览器中显示相同的头像
export const MOCK_USER: User = {
  id: 'u1',
  handle: '@crypto_native',
  name: 'Alex Rivera',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u1&backgroundColor=b6e3f4',
  walletAddress: '0x71C...9A23',
  isVerified: true,
  fiatDetails: {
    bankName: 'Monzo',
    accountNumber: '12345678',
    accountName: 'Alex Rivera'
  }
};

export const FRIENDS: User[] = [
  {
    id: 'u2',
    handle: '@sarah_j',
    name: 'Sarah Jones',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u2&backgroundColor=ffd5dc',
    walletAddress: '0xB2...11AA',
    isVerified: false,
     fiatDetails: {
      bankName: 'Chase',
      accountNumber: '88776655',
      accountName: 'Sarah Jones'
    }
  },
  {
    id: 'u3',
    handle: '@mike_otc',
    name: 'Mike Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u3&backgroundColor=c7d2fe',
    walletAddress: '0xC3...22BB',
    isVerified: true,
    fiatDetails: {
      bankName: 'Zenith Bank',
      accountNumber: '0011223344',
      accountName: 'Michael Chen'
    }
  },
  {
    id: 'u4',
    handle: '@bella_ciao',
    name: 'Bella',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u4&backgroundColor=ffdfbf',
    walletAddress: '0xD4...33CC',
    isVerified: false
  }
];

export const INITIAL_FEED: Transaction[] = [
  {
    id: 't1',
    fromUser: FRIENDS[0],
    toUser: MOCK_USER,
    amount: 15.00,
    currency: Currency.USDT,
    note: 'Pizza night 🍕',
    timestamp: Date.now() - 3600000,
    privacy: Privacy.PUBLIC,
    type: TransactionType.PAYMENT,
    isOTC: false,
    otcState: OTCState.NONE,
    likes: 2,
    comments: 0
  },
  {
    id: 't_ngn_req',
    fromUser: FRIENDS[2], // Mike Chen
    toUser: null,
    amount: 165000, // NGN requested
    currency: Currency.NGN,
    note: 'Selling 100 USDT for NGN. Need it urgently for rent! 🏠',
    timestamp: Date.now() - 1800000,
    privacy: Privacy.PUBLIC_X, // Public on X
    xPostId: '1839201923', // Mock Tweet ID
    type: TransactionType.REQUEST,
    isOTC: true,
    otcState: OTCState.OPEN_REQUEST,
    otcFiatCurrency: Currency.USDT,
    otcOfferAmount: 100.00,
    likes: 3,
    comments: 0
  },
  {
    id: 't2',
    fromUser: FRIENDS[1],
    toUser: null, // Open request
    amount: 50.00,
    currency: Currency.USDT,
    note: 'Need USDT for gas fees ⛽️',
    timestamp: Date.now() - 7200000,
    privacy: Privacy.PUBLIC,
    type: TransactionType.REQUEST,
    isOTC: true,
    otcState: OTCState.OPEN_REQUEST,
    otcFiatCurrency: Currency.NGN,
    otcOfferAmount: 82500, // Implied Fiat offer
    likes: 5,
    comments: 1
  }
];

export const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === Currency.USDT ? '₮' : currency === Currency.NGN ? '₦' : currency === Currency.VES ? 'Bs.' : '$';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};
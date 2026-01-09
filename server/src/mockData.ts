import { User, Transaction, Currency, Privacy, TransactionType, OTCState } from './types.js';

// Mock 用户数据
// 使用 DiceBear API 生成基于种子的一致头像，确保同一用户在不同浏览器中显示相同的头像
export const mockUsers: User[] = [
  {
    id: 'u1',
    handle: '@crypto_native',
    name: 'Alex Rivera',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u1&backgroundColor=b6e3f4',
    walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    isVerified: true,
    fiatDetails: {
      bankName: 'Monzo',
      accountNumber: '12345678',
      accountName: 'Alex Rivera',
    },
  },
  {
    id: 'u2',
    handle: '@sarah_j',
    name: 'Sarah Jones',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u2&backgroundColor=ffd5dc',
    walletAddress: '0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1',
    isVerified: false,
    fiatDetails: {
      bankName: 'Chase',
      accountNumber: '88776655',
      accountName: 'Sarah Jones',
    },
  },
  {
    id: 'u3',
    handle: '@mike_otc',
    name: 'Mike Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u3&backgroundColor=c7d2fe',
    walletAddress: '0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1',
    isVerified: true,
    fiatDetails: {
      bankName: 'Zenith Bank',
      accountNumber: '0011223344',
      accountName: 'Michael Chen',
    },
  },
  {
    id: 'u4',
    handle: '@bella_ciao',
    name: 'Bella',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=u4&backgroundColor=ffdfbf',
    walletAddress: '0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1',
    isVerified: false,
  },
];

// Mock 交易数据
export const mockTransactions: Transaction[] = [
  {
    id: 't1',
    fromUser: mockUsers[1], // Sarah Jones
    toUser: mockUsers[0], // Alex Rivera
    amount: 15.00,
    currency: Currency.USDT,
    note: 'Pizza night 🍕',
    timestamp: Date.now() - 3600000, // 1小时前
    privacy: Privacy.PUBLIC,
    type: TransactionType.PAYMENT,
    isOTC: false,
    otcState: OTCState.NONE,
    likes: 2,
    comments: 0,
  },
  {
    id: 't_ngn_req',
    fromUser: mockUsers[2], // Mike Chen
    toUser: null,
    amount: 165000, // NGN requested
    currency: Currency.NGN,
    note: 'Selling 100 USDT for NGN. Need it urgently for rent! 🏠',
    timestamp: Date.now() - 1800000, // 30分钟前
    privacy: Privacy.PUBLIC_X,
    xPostId: '1839201923',
    type: TransactionType.REQUEST,
    isOTC: true,
    otcState: OTCState.OPEN_REQUEST,
    otcFiatCurrency: Currency.USDT,
    otcOfferAmount: 100.00,
    likes: 3,
    comments: 0,
  },
  {
    id: 't2',
    fromUser: mockUsers[1], // Sarah Jones
    toUser: null,
    amount: 50.00,
    currency: Currency.USDT,
    note: 'Need USDT for gas fees ⛽️',
    timestamp: Date.now() - 7200000, // 2小时前
    privacy: Privacy.PUBLIC,
    type: TransactionType.REQUEST,
    isOTC: true,
    otcState: OTCState.OPEN_REQUEST,
    otcFiatCurrency: Currency.NGN,
    otcOfferAmount: 82500,
    likes: 5,
    comments: 1,
  },
];

// Mock 钱包余额数据
export const mockBalances: Record<string, Record<Currency, number>> = {
  '0x71C7656EC7ab88b098defB751B7401B5f6d8976F': {
    [Currency.USDT]: 1250.50,
    [Currency.NGN]: 50000,
    [Currency.VES]: 0,
    [Currency.USD]: 0,
  },
  '0xB2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1F1A1B1': {
    [Currency.USDT]: 850.25,
    [Currency.NGN]: 30000,
    [Currency.VES]: 0,
    [Currency.USD]: 0,
  },
  '0xC3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1E1': {
    [Currency.USDT]: 2100.75,
    [Currency.NGN]: 75000,
    [Currency.VES]: 0,
    [Currency.USD]: 0,
  },
  '0xD4C3B2A1C1D1E1F1A1B1C1D1E1F1A1B1C1D1': {
    [Currency.USDT]: 500.00,
    [Currency.NGN]: 20000,
    [Currency.VES]: 0,
    [Currency.USD]: 0,
  },
};

// 生成随机交易 ID
export const generateTransactionId = () => {
  return 't' + Math.random().toString(36).substring(2, 9);
};

// 生成随机推文 ID
export const generateTweetId = () => {
  return Math.floor(Math.random() * 1000000000).toString();
};

// 生成随机交易哈希
export const generateTxHash = () => {
  return '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};


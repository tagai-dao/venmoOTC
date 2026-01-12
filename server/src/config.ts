import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // X (Twitter) API
  xApi: {
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
    bearerToken: process.env.X_BEARER_TOKEN || '',
    apiBase: 'https://api.twitter.com/2',
  },
  
  // Twitter OAuth 2.0
  twitterOAuth: {
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    redirectUri: process.env.TWITTER_REDIRECT_URI || 'http://localhost:3001/api/auth/twitter/callback',
    scope: 'tweet.read users.read offline.access',
  },
  
  // Blockchain
  blockchain: {
    bnbChainRpcUrl: process.env.BNB_CHAIN_RPC_URL || 'https://bsc-dataseed.binance.org/',
    usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
    multisigContractAddress: process.env.MULTISIG_CONTRACT_ADDRESS || '0x7989D4b7ABCA813cBA8c87688C3330eb345E3cf6',
    chainId: 56,
    privateKey: process.env.PRIVATE_KEY || '',
  },
  
  // The Graph
  theGraph: {
    endpoint: process.env.THE_GRAPH_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/username/venmo-otc-bsc',
  },
  
  // Privy
  privy: {
    appId: process.env.PRIVY_APP_ID || '',
    appSecret: process.env.PRIVY_APP_SECRET || '',
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};


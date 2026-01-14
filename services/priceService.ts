/**
 * 价格服务
 * 从 CoinGecko API 获取实时加密货币价格
 */

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 60000; // 缓存 60 秒

interface PriceCache {
  data: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache = {
  data: {},
  timestamp: 0,
};

/**
 * 获取 BNB 的 USDT 价格
 */
export async function getBNBPriceInUSDT(): Promise<number> {
  const cacheKey = 'bnb-usdt';
  const now = Date.now();

  // 检查缓存
  if (priceCache.data[cacheKey] && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data[cacheKey];
  }

  try {
    // 直接调用 CoinGecko API（如果遇到 CORS 或 429 错误，会使用 fallback 价格）
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=binancecoin&vs_currencies=usdt`,
      {
        // 添加请求头，但可能仍会遇到 CORS 错误
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    const price = data.binancecoin?.usdt;

    if (!price) {
      throw new Error('BNB price not found in response');
    }

    // 更新缓存
    priceCache.data[cacheKey] = price;
    priceCache.timestamp = now;

    console.log(`📊 BNB/USDT price: ${price}`);
    return price;
  } catch (error: any) {
    console.error('Failed to fetch BNB price:', error.message);
    
    // 如果 API 失败，使用默认值
    const fallbackPrice = 300; // 默认 1 BNB = 300 USDT
    console.warn(`Using fallback BNB price: ${fallbackPrice}`);
    return fallbackPrice;
  }
}

/**
 * 获取 USDT 的法币汇率
 * 使用 CoinGecko 获取 USD 汇率，然后转换为其他法币
 */
export async function getFiatRates(): Promise<Record<string, number>> {
  const cacheKey = 'fiat-rates';
  const now = Date.now();

  // 检查缓存
  if (priceCache.data[cacheKey] && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data[cacheKey] as any;
  }

  try {
    // 使用 exchangerate-api.com 获取法币汇率（免费，无需 API key）
    // 或者使用 CoinGecko 的简单 API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }

    const data = await response.json();
    const usdToNgn = data.rates?.NGN || 1650; // 如果 API 失败，使用默认值
    const usdToVes = data.rates?.VES || 45.5;

    // 由于 USDT ≈ USD，直接使用这些汇率
    const rates: Record<string, number> = {
      NGN: usdToNgn,
      VES: usdToVes,
      USD: 1.00,
    };

    // 更新缓存
    priceCache.data[cacheKey] = rates as any;
    priceCache.timestamp = now;

    console.log(`📊 Fiat rates updated: NGN=${rates.NGN}, VES=${rates.VES}`);
    return rates;
  } catch (error: any) {
    console.error('Failed to fetch fiat rates:', error.message);
    console.warn('Using fallback fiat rates');
    
    // 返回默认汇率
    const fallbackRates = {
      NGN: 1650.00,
      VES: 45.50,
      USD: 1.00,
    };
    
    // 即使失败也更新缓存，避免频繁请求
    priceCache.data[cacheKey] = fallbackRates as any;
    priceCache.timestamp = now;
    
    return fallbackRates;
  }
}

/**
 * 获取所有价格（BNB 和法币汇率）
 */
export async function getAllPrices(): Promise<{
  bnbToUSDT: number;
  fiatRates: Record<string, number>;
}> {
  const [bnbToUSDT, fiatRates] = await Promise.all([
    getBNBPriceInUSDT(),
    getFiatRates(),
  ]);

  return {
    bnbToUSDT,
    fiatRates,
  };
}

/**
 * 清除价格缓存
 */
export function clearPriceCache(): void {
  priceCache = {
    data: {},
    timestamp: 0,
  };
}

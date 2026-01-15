import type { Plugin } from 'vite';

/**
 * Vite 插件：替换 Solana 可选依赖的导入
 * 将 @solana/kit 等导入替换为空模块
 */
export function solanaStubPlugin(): Plugin {
  const solanaModules = [
    '@solana/kit',
    '@solana-program/memo',
    '@solana-program/system',
    '@solana-program/token',
    '@solana-program/token-2022',
    '@solana-program/compute-budget',
  ];

  return {
    name: 'solana-stub',
    enforce: 'pre',
    resolveId(id) {
      // 拦截 Solana 相关依赖的解析
      if (solanaModules.includes(id)) {
        // 返回虚拟模块 ID
        return `\0solana-stub:${id}`;
      }
      return null;
    },
    load(id) {
      // 为虚拟模块提供空内容
      if (id.startsWith('\0solana-stub:')) {
        // 创建一个代理对象，拦截所有属性访问
        return `
          // 空模块，用于替换 Solana 可选依赖
          const stub = () => ({});
          const stubObj = {};
          
          // 导出所有可能需要的函数和对象
          export default stubObj;
          export const getTransactionDecoder = stub;
          export const getBase64Decoder = stub;
          export const getBase58Encoder = stub;
          export const getBase64Encoder = stub;
          export const getBase58Decoder = stub;
          export const createSolanaRpc = stub;
          export const createSolanaRpcSubscriptions = stub;
          export const devnet = stub;
          export const mainnet = stub;
          export const testnet = stub;
          export const getAddressEncoder = stub;
          export const getAddressDecoder = stub;
          
          // 使用 Proxy 拦截所有未定义的导出
          const handler = {
            get: (target, prop) => {
              if (prop === 'default') return stubObj;
              return stub;
            }
          };
          
          // 导出所有可能的属性
          Object.setPrototypeOf(stubObj, new Proxy({}, handler));
        `;
      }
      return null;
    },
    transform(code, id) {
      // 在构建时替换代码中的 Solana 导入
      if (!id.includes('node_modules')) {
        return null;
      }
      
      let modified = false;
      let newCode = code;
      
      for (const module of solanaModules) {
        // 替换 import 语句
        const importRegex = new RegExp(`import\\s+["']${module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'];?\\s*`, 'g');
        if (importRegex.test(newCode)) {
          newCode = newCode.replace(importRegex, '');
          modified = true;
        }
        
        // 替换 import from 语句
        const importFromRegex = new RegExp(`import\\s+.*?\\s+from\\s+["']${module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'];?\\s*`, 'g');
        if (importFromRegex.test(newCode)) {
          newCode = newCode.replace(importFromRegex, '');
          modified = true;
        }
      }
      
      return modified ? { code: newCode, map: null } : null;
    },
  };
}

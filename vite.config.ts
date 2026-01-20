import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // 使用 localhost:3000 供本机访问
        // 注意：在某些环境下监听端口需要允许网络权限
        port: 3000,
        host: 'localhost',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['ethers']
      },
      optimizeDeps: {
        include: ['ethers', '@privy-io/react-auth'],
        esbuildOptions: {
          target: 'es2020'
        }
      },
      build: {
        commonjsOptions: {
          include: [/node_modules/],
          transformMixedEsModules: true
        },
        rollupOptions: {
          // 不将 Solana 依赖标记为 external，让 Vite 正常处理
          output: {
            manualChunks: undefined
          }
        }
      }
    };
});

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  // 可以添加其他环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

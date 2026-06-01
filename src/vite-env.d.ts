/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QQ_APP_ID: string;
  readonly VITE_WECHAT_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

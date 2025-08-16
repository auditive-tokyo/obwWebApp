/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPSYNC_ENDPOINT: string
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string
  readonly VITE_CHAT_LAMBDA_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

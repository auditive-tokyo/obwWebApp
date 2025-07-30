const endpoint = import.meta.env.VITE_APPSYNC_ENDPOINT;
const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

if (!endpoint || !identityPoolId) {
  throw new Error("必要な環境変数が設定されていません: VITE_APPSYNC_ENDPOINT, VITE_COGNITO_IDENTITY_POOL_ID");
}

export const amplifyConfig = {
  API: {
    GraphQL: {
      endpoint,
      region: 'ap-northeast-1',
      defaultAuthMode: 'iam' as const,
    }
  },
  Auth: {
    Cognito: {
      identityPoolId,
      allowGuestAccess: true
    }
  }
} as const;
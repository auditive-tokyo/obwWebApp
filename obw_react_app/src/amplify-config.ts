export const amplifyConfig = {
  API: {
    GraphQL: {
      endpoint: 'https://3tbtd2z3jzarbgw7herqcgxdaq.appsync-api.ap-northeast-1.amazonaws.com/graphql',
      region: 'ap-northeast-1',
      defaultAuthMode: 'iam' as const,
    }
  },
  Auth: {
    Cognito: {
      identityPoolId: 'ap-northeast-1:49e62c1e-b677-431b-8f59-0e552044a1fe'
    }
  }
} as const;
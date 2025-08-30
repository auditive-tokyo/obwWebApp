import type { ResourcesConfig } from 'aws-amplify'

const endpoint = import.meta.env.VITE_APPSYNC_ENDPOINT;
const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
// Admin (User Pool / Hosted UI) related envs
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string | undefined;
const oauthDomain = import.meta.env.VITE_COGNITO_OAUTH_DOMAIN as string | undefined; // e.g. osakabaywheel-admin.auth.ap-northeast-1.amazoncognito.com
const oauthRedirectSignIn = import.meta.env.VITE_COGNITO_REDIRECT_SIGNIN as string | undefined; // comma-separated list
const oauthRedirectSignOut = import.meta.env.VITE_COGNITO_REDIRECT_SIGNOUT as string | undefined; // comma-separated list

if (!endpoint || !identityPoolId) {
  throw new Error("必要な環境変数が設定されていません: VITE_APPSYNC_ENDPOINT, VITE_COGNITO_IDENTITY_POOL_ID");
}

// Conditionally build admin User Pool / Hosted UI config
const adminUserPoolConfigured = Boolean(
  userPoolId && userPoolClientId && oauthDomain && oauthRedirectSignIn && oauthRedirectSignOut
);

const baseCognito = {
  identityPoolId,
  allowGuestAccess: true,
};

const cognitoConfig = adminUserPoolConfigured
  ? {
      ...baseCognito,
      userPoolId: userPoolId!,
      userPoolClientId: userPoolClientId!,
      loginWith: {
        oauth: {
          domain: oauthDomain!,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: oauthRedirectSignIn!.split(',').map(s => s.trim()).filter(Boolean),
          redirectSignOut: oauthRedirectSignOut!.split(',').map(s => s.trim()).filter(Boolean),
          responseType: 'code',
        },
      },
    }
  : baseCognito;

export const amplifyConfig: ResourcesConfig = {
  API: {
    GraphQL: {
      endpoint,
      region: 'ap-northeast-1',
      defaultAuthMode: 'iam',
    }
  },
  Auth: {
    Cognito: cognitoConfig as any,
  }
} as ResourcesConfig;
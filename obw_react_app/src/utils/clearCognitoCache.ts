// Cognito/Amplify のローカルキャッシュを削除（localStorage + sessionStorage）
export function clearCognitoIdentityCache() {
  try {
    const patterns: RegExp[] = [
      /^com\.amplify\.Cognito/,   // com.amplify.Cognito.<region>:<pool>.identityId
      /\.identityId$/,            // 末尾が .identityId
      /^aws\.cognito\.identity-id\./, // aws.cognito.identity-id.<region>:<pool>
      /^aws-amplify-federatedInfo$/,
    ]
    const sweep = (storage: Storage) => {
      const keys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k && patterns.some(p => p.test(k))) keys.push(k)
      }
      keys.forEach(k => storage.removeItem(k))
    }
    sweep(localStorage)
    sweep(sessionStorage)
  } catch { void 0 }
}
import type { Guest } from '../adminpage/types/types';
import type { Client } from 'aws-amplify/api'

type GraphParams = Parameters<Client['graphql']>[0]
type GraphqlResponse<T = unknown> = { data?: T }

type Deps = {
  client: Client;
  guest: Guest;
  setSignedPassportUrl: (v: string | null) => void;
  setSigning: (v: boolean) => void;
};

// 内部ユーティリティ: S3キー抽出
function extractS3Key(url: string) {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}

const gql = `
  mutation GetPresignedUrl($input: GetPresignedUrlInput!) {
    getPresignedUrl(input: $input) {
      getUrl
    }
  }
`;

export async function fetchPassportSignedUrl({
  client,
  guest,
  setSignedPassportUrl,
  setSigning
}: Deps) {
  if (!guest.passportImageUrl) { setSignedPassportUrl(null); return; }
  const key = extractS3Key(guest.passportImageUrl);
  if (!key) { setSignedPassportUrl(null); return; }

  // 期待フォーマット: roomId/timestamp/filename...
  const [roomId, timestamp, ...rest] = key.split('/');
  const filename = rest.join('/');
  if (!roomId || !timestamp || !filename) { setSignedPassportUrl(null); return; }

  setSigning(true);
  try {
    const res = await client.graphql({
      query: gql,
      variables: { input: { roomId, timestamp, filename } }
    } as GraphParams);
    const obj = res as unknown as GraphqlResponse<{ getPresignedUrl?: { getUrl?: string } }>;
    const url = obj.data?.getPresignedUrl?.getUrl ?? null;
    setSignedPassportUrl(url);
  } catch (e: unknown) {
    console.warn('[fetchPassportSignedUrl] failed', e);
    setSignedPassportUrl(null);
  } finally {
    setSigning(false);
  }
}
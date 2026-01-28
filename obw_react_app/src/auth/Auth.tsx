import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateClient } from "aws-amplify/api";
import { clearCognitoIdentityCache } from "@/utils/clearCognitoCache";
import { dbg } from "@/utils/debugLogger";

// ============================================================
// ヘルパー関数（Cognitive Complexity削減のため）
// ============================================================

/**
 * Cognito User PoolのlocalStorageキーをクリア
 */
function clearCognitoUserPoolTokens(): void {
  try {
    const clientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as
      | string
      | undefined;
    if (clientId) {
      const baseKey = `CognitoIdentityServiceProvider.${clientId}`;
      const prefix = `${baseKey}.`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k === `${baseKey}.LastAuthUser` || k.startsWith(prefix)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
    // Hosted UI flags (defensive)
    localStorage.removeItem("amplify-signin-with-hostedUI");
    localStorage.removeItem("amplify-redirected-from-hosted-ui");
  } catch {
    void 0;
  }
}

/**
 * ゲスト認証情報をlocalStorageから削除
 */
function clearGuestAuthStorage(): void {
  localStorage.removeItem("guestId");
  localStorage.removeItem("token");
  localStorage.removeItem("bookingId");
  localStorage.removeItem("responseId");
  clearCognitoIdentityCache();
}

/**
 * ゲスト認証情報をlocalStorageに保存
 */
function saveGuestAuthStorage(
  guestId: string,
  token: string,
  bookingId?: string,
): void {
  localStorage.setItem("guestId", guestId);
  localStorage.setItem("token", token);
  if (bookingId) localStorage.setItem("bookingId", bookingId);
}

/**
 * エラーオブジェクトからメッセージを取得
 */
function getMessageFromError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if ("message" in obj && typeof obj.message === "string") return obj.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}

/**
 * URLからクエリパラメータを取得
 */
function getAuthParams(): {
  guestId: string | null;
  token: string | null;
  source: string | null;
} {
  const url = new URL(window.location.href);
  return {
    guestId: url.searchParams.get("guestId"),
    token: url.searchParams.get("token"),
    source: url.searchParams.get("source"),
  };
}

/**
 * ナビゲーション用のstateを構築
 */
function buildNavigateState(
  roomId: string,
  guestId: string,
  token: string,
  source: string | null,
) {
  return {
    smsAccess: source === "sms",
    originalUrl: `${window.location.origin}/room/${roomId}?guestId=${guestId}&token=${token}`,
  };
}

// ============================================================
// コンポーネント
// ============================================================

export default function Auth() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const client = generateClient({ authMode: "iam" });
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    async function run() {
      // Purge any Cognito User Pool tokens from localStorage
      clearCognitoUserPoolTokens();

      const { guestId, token, source } = getAuthParams();

      if (!roomId || !guestId || !token) {
        setMessage("Missing params. Redirecting...");
        navigate(`/${roomId || ""}`, { replace: true });
        return;
      }

      const query = /* GraphQL */ `
        mutation VerifyAccessToken(
          $roomNumber: String!
          $guestId: String!
          $token: String!
        ) {
          verifyAccessToken(
            roomNumber: $roomNumber
            guestId: $guestId
            token: $token
          ) {
            success
            guest {
              guestId
              bookingId
            }
          }
        }
      `;

      type VerifyAccessTokenPayload = {
        verifyAccessToken: {
          success: boolean;
          guest?: { guestId?: string; bookingId?: string };
        };
      };

      try {
        const res = await client.graphql<VerifyAccessTokenPayload>({
          query,
          variables: { roomNumber: roomId, guestId, token },
        });

        if (import.meta.env.DEV) {
          dbg("VerifyAccessToken result:", res);
          if ("errors" in res && res.errors?.length)
            console.error("GraphQL errors:", res.errors);
        }

        const isSuccess = "data" in res && res.data?.verifyAccessToken?.success;
        if (isSuccess) {
          const g = res.data.verifyAccessToken.guest;
          saveGuestAuthStorage(g?.guestId || guestId, token, g?.bookingId);
          navigate(`/${roomId}`, {
            replace: true,
            state: buildNavigateState(roomId, guestId, token, source),
          });
          return;
        }

        // Verification failed
        const firstErr =
          "errors" in res && res.errors?.[0]?.message
            ? `: ${res.errors[0].message}`
            : "";
        setMessage(`Verification failed${firstErr}`);
        clearGuestAuthStorage();
        setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1000);
      } catch (e: unknown) {
        if (import.meta.env.DEV)
          console.error("VerifyAccessToken exception:", e);
        setMessage(`Verification error: ${getMessageFromError(e)}`);
        clearGuestAuthStorage();
        setTimeout(() => navigate(`/${roomId}`, { replace: true }), 1200);
      }
    }
    run();
  }, [roomId, navigate, client]);

  return <p>{message}</p>;
}

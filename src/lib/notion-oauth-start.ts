import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import crypto from "crypto";

export const NOTION_OAUTH_AUTHORIZE_URL =
  "https://api.notion.com/v1/oauth/authorize";
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export function buildNotionAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const authUrl = new URL(NOTION_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("state", state);
  return authUrl.toString();
}

async function resolveUserKey(
  handoffId: string | null,
): Promise<string | null> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };

  if (handoffId) {
    try {
      const db = await getMongoDb();
      const handoff = await db.collection("oauth_handoffs").findOneAndDelete({
        handoff_id: handoffId,
        expires_at: { $gt: new Date() },
      });

      if (handoff?.user_key) {
        cookieStore.set("user_key", handoff.user_key, {
          ...cookieOptions,
          maxAge: 60 * 60 * 24 * 30,
        });
        return handoff.user_key;
      }
    } catch (error) {
      console.error("Notion OAuth handoff lookup failed:", error);
    }
  }

  let user_key = cookieStore.get("user_key")?.value;
  if (!user_key) {
    user_key = crypto.randomUUID();
    cookieStore.set("user_key", user_key, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return user_key;
}

export async function prepareNotionOAuthRedirect(
  handoffId: string | null = null,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return { ok: false, error: "Missing Notion OAuth environment variables" };
  }

  const user_key = await resolveUserKey(handoffId);
  if (!user_key) {
    return { ok: false, error: "Failed to resolve OAuth session" };
  }

  const randomState = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };

  const stateExpiresAt = Date.now() + OAUTH_STATE_MAX_AGE_SECONDS * 1000;
  cookieStore.set("notion_oauth_state", randomState, {
    ...cookieOptions,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  cookieStore.set("notion_oauth_state_expires", String(stateExpiresAt), {
    ...cookieOptions,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return {
    ok: true,
    authorizeUrl: buildNotionAuthorizeUrl(clientId, redirectUri, randomState),
  };
}

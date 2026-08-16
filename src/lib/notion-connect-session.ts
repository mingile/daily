export const NOTION_CONNECT_HANDOFF_ID_KEY = "notion_connect_handoff_id";
export const NOTION_CONNECT_HANDOFF_LAUNCHED_KEY =
  "notion_connect_handoff_launched";
export const NOTION_CONNECT_HANDOFF_STARTED_AT_KEY =
  "notion_connect_handoff_started_at";
export const NOTION_OAUTH_PENDING_KEY = "notion_oauth_pending";
export const NOTION_CONNECT_AUTH_URL_COPIED_KEY =
  "notion_connect_auth_url_copied";
export const NOTION_CONNECT_SAFARI_GUIDE_LAUNCHED_KEY =
  "notion_connect_safari_guide_launched";

export const HANDOFF_TTL_MS = 10 * 60 * 1000;
export const SAFARI_GUIDE_FALLBACK_DELAY_MS = 3000;

export function buildNotionHandoffAuthUrl(handoffId: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/api/notion/auth?handoff=${handoffId}`;
}

export async function copyNotionHandoffAuthUrl(
  handoffId: string,
): Promise<boolean> {
  const authUrl = buildNotionHandoffAuthUrl(handoffId);

  try {
    await navigator.clipboard.writeText(authUrl);
    sessionStorage.setItem(NOTION_CONNECT_AUTH_URL_COPIED_KEY, "1");
    return true;
  } catch (error) {
    console.error("Failed to copy Notion handoff auth URL:", error);
    sessionStorage.setItem(NOTION_CONNECT_AUTH_URL_COPIED_KEY, "0");
    return false;
  }
}

export function wasNotionHandoffAuthUrlCopied(): boolean {
  return sessionStorage.getItem(NOTION_CONNECT_AUTH_URL_COPIED_KEY) === "1";
}

export function didNotionHandoffAuthUrlCopyFail(): boolean {
  return sessionStorage.getItem(NOTION_CONNECT_AUTH_URL_COPIED_KEY) === "0";
}

export function clearNotionConnectSession() {
  sessionStorage.removeItem(NOTION_CONNECT_HANDOFF_ID_KEY);
  sessionStorage.removeItem(NOTION_CONNECT_HANDOFF_LAUNCHED_KEY);
  sessionStorage.removeItem(NOTION_CONNECT_HANDOFF_STARTED_AT_KEY);
  sessionStorage.removeItem(NOTION_OAUTH_PENDING_KEY);
  sessionStorage.removeItem(NOTION_CONNECT_AUTH_URL_COPIED_KEY);
  sessionStorage.removeItem(NOTION_CONNECT_SAFARI_GUIDE_LAUNCHED_KEY);
}

export function hasNotionConnectPendingFlow(): boolean {
  return (
    sessionStorage.getItem(NOTION_OAUTH_PENDING_KEY) === "1" ||
    sessionStorage.getItem(NOTION_CONNECT_HANDOFF_LAUNCHED_KEY) === "1"
  );
}

export function beginNotionConnectFlow(handoffId: string) {
  sessionStorage.setItem(NOTION_CONNECT_HANDOFF_ID_KEY, handoffId);
  sessionStorage.setItem(NOTION_OAUTH_PENDING_KEY, "1");
}

/** Marks the iOS PWA connect flow as active and starts the handoff expiry clock. */
export function markConnectFlowStarted(handoffId: string) {
  beginNotionConnectFlow(handoffId);
  sessionStorage.setItem(NOTION_CONNECT_HANDOFF_LAUNCHED_KEY, "1");
  sessionStorage.setItem(
    NOTION_CONNECT_HANDOFF_STARTED_AT_KEY,
    String(Date.now()),
  );
}

/** Records that Safari guide was opened (or attempted) for this connect attempt. */
export function markSafariGuideLaunch() {
  sessionStorage.setItem(NOTION_CONNECT_SAFARI_GUIDE_LAUNCHED_KEY, "1");
}

export function wasSafariGuideLaunched(): boolean {
  return (
    sessionStorage.getItem(NOTION_CONNECT_SAFARI_GUIDE_LAUNCHED_KEY) === "1"
  );
}

export function isHandoffAttemptExpired(): boolean {
  const startedAt = sessionStorage.getItem(NOTION_CONNECT_HANDOFF_STARTED_AT_KEY);
  if (!startedAt) {
    return false;
  }

  return Date.now() - Number(startedAt) > HANDOFF_TTL_MS;
}

export async function startNotionConnectHandoff(): Promise<string> {
  const handoffResponse = await fetch("/api/notion/oauth-handoff", {
    method: "POST",
    credentials: "include",
  });
  const handoffData = (await handoffResponse.json()) as {
    handoffId?: string;
    error?: string;
  };

  if (!handoffResponse.ok || !handoffData.handoffId) {
    throw new Error(handoffData.error ?? "OAuth handoff 생성 실패");
  }

  return handoffData.handoffId;
}

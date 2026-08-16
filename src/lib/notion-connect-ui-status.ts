export type NotionConnectUiStatus =
  | "starting"
  | "handoff_started"
  | "notion_authorized"
  | "connected"
  | "failed"
  | "expired";

/** starting = connect page initializing; handoff_started = awaiting Safari OAuth */

export function mapConnectionToUiStatus(
  notionConnected: boolean,
  dbConnected: boolean,
  options?: { failed?: boolean; expired?: boolean },
): NotionConnectUiStatus {
  if (options?.failed) {
    return "failed";
  }

  if (options?.expired) {
    return "expired";
  }

  if (dbConnected) {
    return "connected";
  }

  if (notionConnected) {
    return "notion_authorized";
  }

  return "handoff_started";
}

export function isNotionFullyConnected(dbConnected: boolean): boolean {
  return dbConnected;
}

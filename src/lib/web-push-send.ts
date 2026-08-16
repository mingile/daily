import { getMongoDb } from "@/lib/mongodb";
import webpush from "web-push";

type PushSubscriptionRecord = {
  user_key: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
};

function getVapidConfig() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error("Missing VAPID environment variables");
  }

  return { subject, publicKey, privateKey };
}

function ensureWebPushConfigured() {
  const { subject, publicKey, privateKey } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function listPushSubscriptions(
  user_key: string,
): Promise<PushSubscriptionRecord[]> {
  const db = await getMongoDb();
  const docs = await db
    .collection("push_subscriptions")
    .find({ user_key })
    .toArray();

  return docs as unknown as PushSubscriptionRecord[];
}

async function removePushSubscription(endpoint: string): Promise<void> {
  const db = await getMongoDb();
  await db.collection("push_subscriptions").deleteOne({ endpoint });
}

export async function sendPushToUser(
  user_key: string,
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number }> {
  ensureWebPushConfigured();

  const subscriptions = await listPushSubscriptions(user_key);
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
  });

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        message,
      );
      sent += 1;
    } catch (error) {
      failed += 1;

      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        await removePushSubscription(subscription.endpoint);
      }

      console.error("Web Push send failed:", subscription.endpoint, error);
    }
  }

  return { sent, failed };
}

export function buildNotificationDeliveryKey(
  medication_id: string,
  at: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${medication_id}:${lookup.year}-${lookup.month}-${lookup.day}-${lookup.hour}-${lookup.minute}`;
}

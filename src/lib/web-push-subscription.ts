function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function getVapidPublicKey(): Promise<string> {
  const response = await fetch("/api/push/vapid-public-key");
  const data = (await response.json()) as { publicKey?: string; error?: string };

  if (!response.ok || !data.publicKey) {
    throw new Error(data.error ?? "VAPID public key 조회 실패");
  }

  return data.publicKey;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    throw new Error("이 브라우저는 Notification API를 지원하지 않습니다.");
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export function serializePushSubscription(
  subscription: PushSubscription,
): PushSubscriptionPayload {
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push Subscription 형식이 올바르지 않습니다.");
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function createPushSubscription(): Promise<PushSubscription> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("이 브라우저는 Web Push를 지원하지 않습니다.");
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }

  const registration = await navigator.serviceWorker.ready;
  const publicKey = await getVapidPublicKey();
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    return existingSubscription;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function savePushSubscription(
  subscription: PushSubscription,
): Promise<void> {
  const payload = serializePushSubscription(subscription);
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { ok?: boolean; error?: string };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Push Subscription 저장 실패");
  }
}

export async function subscribeToPushNotifications(): Promise<PushSubscription> {
  const subscription = await createPushSubscription();
  await savePushSubscription(subscription);
  return subscription;
}

export async function getPushSubscriptionStatus(): Promise<{
  subscribed: boolean;
  endpoint?: string;
}> {
  const response = await fetch("/api/push/subscription", {
    credentials: "include",
  });
  const data = (await response.json()) as {
    subscribed?: boolean;
    endpoint?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Push Subscription 상태 조회 실패");
  }

  return {
    subscribed: !!data.subscribed,
    endpoint: data.endpoint,
  };
}

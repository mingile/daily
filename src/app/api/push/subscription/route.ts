import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import crypto from "crypto";
import { NextResponse } from "next/server";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

async function resolveUserKey() {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };

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

function isValidPayload(body: PushSubscriptionPayload): body is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  return !!(
    body.endpoint &&
    body.keys?.p256dh &&
    body.keys?.auth
  );
}

export async function GET() {
  try {
    const user_key = await resolveUserKey();
    const db = await getMongoDb();
    const subscription = await db.collection("push_subscriptions").findOne(
      { user_key },
      {
        sort: { updated_at: -1 },
        projection: { endpoint: 1 },
      },
    );

    return NextResponse.json({
      subscribed: !!subscription,
      endpoint: subscription?.endpoint,
    });
  } catch (error) {
    console.error("Push subscription status check failed:", error);
    return NextResponse.json(
      { error: "Failed to check push subscription" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: PushSubscriptionPayload;

  try {
    body = (await req.json()) as PushSubscriptionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json(
      { error: "Missing push subscription fields" },
      { status: 400 },
    );
  }

  try {
    const user_key = await resolveUserKey();
    const db = await getMongoDb();
    const now = new Date();

    await db.collection("push_subscriptions").updateOne(
      { endpoint: body.endpoint },
      {
        $set: {
          user_key,
          endpoint: body.endpoint,
          keys: {
            p256dh: body.keys.p256dh,
            auth: body.keys.auth,
          },
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscription save failed:", error);
    return NextResponse.json(
      { error: "Failed to save push subscription" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const user_key = await resolveUserKey();
    const db = await getMongoDb();

    await db.collection("push_subscriptions").deleteMany({ user_key });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscription delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete push subscription" },
      { status: 500 },
    );
  }
}

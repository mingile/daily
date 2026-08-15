import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import crypto from "crypto";
import { NextResponse } from "next/server";

const HANDOFF_TTL_MS = 10 * 60 * 1000;

export async function POST() {
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

  const handoffId = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);

  try {
    const db = await getMongoDb();
    await db.collection("oauth_handoffs").insertOne({
      handoff_id: handoffId,
      user_key,
      created_at: now,
      expires_at: expiresAt,
    });

    return NextResponse.json({ handoffId });
  } catch (error) {
    console.error("Notion OAuth handoff creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create OAuth handoff" },
      { status: 500 },
    );
  }
}

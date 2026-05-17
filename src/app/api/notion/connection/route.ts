// 이 브라우저 사용자를 식별할 수 있는 키를 찾기
// MongoDB에서 연결문서 1개를 조회
// 있으면 {connected: true}, 없으면 {connected: false} 응답

import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const user_key = cookieStore.get("user_key")?.value;

    if (!user_key) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const db = await getMongoDb();
    const connectionsInfo = db.collection("connections_info");
    const tempInfo = db.collection("temp_info");
    const connectionDoc = await connectionsInfo.findOne({ user_key });
    const tempDoc = await tempInfo.findOne({ user_key });
    const notionConnected = !!(
      connectionDoc?.access_token || tempDoc?.access_token
    );
    const dbConnected = !!connectionDoc?.daily_health_db_id;

    return NextResponse.json({
      notionConnected,
      dbConnected,
    });
  } catch (error) {
    console.error("Notion connection status check failed:", error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const tempId = cookieStore.get("notion_temp_id")?.value;

  if (!tempId) {
    return NextResponse.json(
      { error: "Missing temp session" },
      { status: 401 },
    );
  }

  const body = await req.json();
  const daily_health_db_id = body.daily_health_db_id;

  if (!daily_health_db_id) {
    return NextResponse.json(
      { error: "Missing daily health database id" },
      { status: 400 },
    );
  }

  const ids = [daily_health_db_id];
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    return NextResponse.json(
      { error: "Duplicate database ids are not allowed" },
      { status: 400 },
    );
  }

  try {
    const db = await getMongoDb();
    const tempCollection = db.collection("temp_info");
    const connectionCollection = db.collection("connections_info");

    const tempDoc = await tempCollection.findOne({ temp_id: tempId });

    if (!tempDoc) {
      return NextResponse.json(
        { error: "Invalid temp session" },
        { status: 401 },
      );
    }

    if (tempDoc.expires_at && new Date(tempDoc.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const now = new Date();

    await connectionCollection.findOneAndUpdate(
      { user_key: tempDoc.user_key },
      {
        $set: {
          user_key: tempDoc.user_key,
          bot_id: tempDoc.bot_id,
          access_token: tempDoc.access_token,
          workspace_id: tempDoc.workspace_id,
          daily_health_db_id,
          updated_at: now,
        },
        $setOnInsert: {
          created_at: now,
        },
      },
      {
        upsert: true,
      },
    );

    await tempCollection.deleteOne({ temp_id: tempId });

    cookieStore.set("notion_temp_id", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notion connection save failed:", error);
    return NextResponse.json(
      { error: "Failed to save notion connection" },
      { status: 500 },
    );
  }
}

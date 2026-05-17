import { getMongoDb } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type NotionTitleItem = {
  plain_text?: string;
};

type NotionDatabase = {
  id: string;

  title?: NotionTitleItem[];
};

export async function GET() {
  const cookieStore = await cookies();
  const tempId = cookieStore.get("notion_temp_id")?.value;

  if (!tempId) {
    return NextResponse.json(
      { error: "먼저 사용자의 Notion을 연동해야 합니다." },
      { status: 401 },
    );
  }

  try {
    const db = await getMongoDb();
    const collection = db.collection("temp_info");

    const tempDoc = await collection.findOne({ temp_id: tempId });

    if (!tempDoc) {
      return NextResponse.json(
        { error: "Invalid temp session" },
        { status: 401 },
      );
    }

    if (tempDoc.expires_at && new Date(tempDoc.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const notionResponse = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tempDoc.access_token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          value: "database",
          property: "object",
        },
      }),
    });

    const notionData = await notionResponse.json();

    if (!notionResponse.ok) {
      console.error("Notion DB search failed:", notionData);
      return NextResponse.json(
        { error: "Notion search failed", details: notionData },
        { status: notionResponse.status },
      );
    }

    const databases = (notionData.results || []).map(
      (dbItem: NotionDatabase) => {
        const titleArr = dbItem.title || [];
        const title =
          titleArr.map((t: NotionTitleItem) => t.plain_text).join("") ||
          "Untitled";

        return {
          id: dbItem.id,
          title,
        };
      },
    );

    return NextResponse.json({ data: databases });
  } catch (error) {
    console.error("Database options error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

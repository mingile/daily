import { MongoClient } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

let cachedClient: MongoClient | null = null;

export async function POST() {
  const cookieStore = await cookies();
  const user_key = cookieStore.get("user_key")?.value;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    return NextResponse.json({ error: "Missing MONGODB_URI" }, { status: 500 });
  }

  if (!user_key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(mongoUri);
      await cachedClient.connect();
    }

    const db = cachedClient.db("daily");

    const connectionsCollection = db.collection("connections_info");
    const tempCollection = db.collection("temp_info");

    await connectionsCollection.deleteOne({ user_key });
    await tempCollection.deleteOne({ user_key });

    return NextResponse.json(
      { message: "Notion 연결 해제 완료" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Notion 연결 해제 중 오류", error);
    return NextResponse.json(
      { error: "Notion 연결 해제 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

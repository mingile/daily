import { getMongoDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = await getMongoDb();
    const connection = db.collection("connections_info");
    const temp = db.collection("temp_info");
    const result = await connection.find({}).toArray();
    const tempResult = await temp.find({}).toArray();
    return NextResponse.json({ data: result, temp: tempResult });
  } catch (error) {
    console.error("MongoDB debug failed:", error);
    return NextResponse.json(
      { error: "MongoDB debug failed" },
      { status: 500 },
    );
  }
}

import { getMongoDb } from "@/lib/mongodb"
import { generateWidgetToken } from "@/lib/token"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const user_key = cookieStore.get("user_key")?.value

    if (!user_key) {
      return NextResponse.json(
        { error: "Unauthorized: Missing user_key" },
        { status: 401 },
      )
    }

    const db = await getMongoDb()
    const collection = db.collection("connections_info")
    const connectionDoc = await collection.findOne({ user_key })

    if (!connectionDoc) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 },
      )
    }

    if (!connectionDoc.access_token) {
      return NextResponse.json(
        { error: "Notion not connected" },
        { status: 401 },
      )
    }

    if (!connectionDoc.daily_health_db_id) {
      return NextResponse.json(
        { error: "Daily health database not configured" },
        { status: 400 },
      )
    }

    if (connectionDoc.widget_token) {
      return NextResponse.json({ widgetToken: connectionDoc.widget_token })
    }

    const newToken = generateWidgetToken()
    const now = new Date()

    await collection.updateOne(
      { user_key },
      {
        $set: {
          widget_token: newToken,
          widget_token_created_at: now,
        },
      },
    )

    return NextResponse.json({ widgetToken: newToken })
  } catch (error) {
    console.error("Failed to get or create widget token:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

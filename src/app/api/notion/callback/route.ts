import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    return NextResponse.json(
      { error: "Missing APP_BASE_URL" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("notion_oauth_state")?.value;
  const user_key = cookieStore.get("user_key")?.value;
  if (!user_key) {
    return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
  }

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
  } else {
    cookieStore.set("notion_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
  }

  const tokenUrl = process.env.NOTION_TOKEN_URL;
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!tokenUrl || !clientId || !clientSecret || !redirectUri) {
    console.error("Missing Notion env vars", {
      hasTokenUrl: !!tokenUrl,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
    });
    return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
  }

  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
  ).toString("base64");
  const authHeader = `Basic ${credentials}`;

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", redirectUri);

  let tokenData: any = null;

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const raw = await tokenResponse.text();
    try {
      tokenData = raw ? JSON.parse(raw) : null;
    } catch {
      tokenData = { raw };
    }
    if (!tokenResponse.ok) {
      console.error("Notion token 교환 실패", {
        status: tokenResponse.status,
        tokenData,
      });
      return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
    }

    console.log("Notion token 교환 성공", {
      hasAccessToken: !!tokenData?.access_token,
      botId: tokenData?.bot_id,
      workspaceId: tokenData?.workspace_id,
    });

    const db = await getMongoDb();
    const collection = db.collection("temp_info");
    const temp_id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    try {
      await collection.findOneAndUpdate(
        { user_key },
        {
          $set: {
            temp_id,
            user_key,
            bot_id: tokenData?.bot_id,
            access_token: tokenData?.access_token,
            workspace_id: tokenData?.workspace_id,
            created_at: now,
            expires_at: expiresAt,
          },
        },
        {
          upsert: true,
        },
      );

      cookieStore.set("notion_temp_id", temp_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 5,
        path: "/",
      });

      return NextResponse.redirect(new URL("/", appBaseUrl));
    } catch (error) {
      console.error("Notion temp 정보 저장 중 예외", error);
      return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
    }
  } catch (error) {
    console.error("Notion token 교환 중 예외", error);
    return NextResponse.redirect(new URL("/api/notion/auth", appBaseUrl));
  }
}

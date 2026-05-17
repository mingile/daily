import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const authorizeUrl = process.env.NOTION_AUTHORIZE_URL;
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!authorizeUrl || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Notion OAuth environment variables" },
      { status: 500 },
    );
  }
  // state 생성 (랜덤)
  const randomState = crypto.randomUUID();
  // state를 HttpOnly 쿠키로 저장 (콜백에서 검증용)
  const cookieStore = await cookies();

  let user_key = cookieStore.get("user_key")?.value;
  if (!user_key) {
    user_key = crypto.randomUUID();
    cookieStore.set("user_key", user_key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: "/",
    });
  }

  cookieStore.set("notion_oauth_state", randomState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  // Notion authorize URL 구성
  const authUrl = new URL(authorizeUrl);
  // client_id
  authUrl.searchParams.set("client_id", clientId);
  // redirect_uri
  authUrl.searchParams.set("redirect_uri", redirectUri);
  // response_type=code
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  // state
  authUrl.searchParams.set("state", randomState);

  // 302 redirect 응답
  return NextResponse.redirect(authUrl);
}

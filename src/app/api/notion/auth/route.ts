import { prepareNotionOAuthRedirect } from "@/lib/notion-oauth-start";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const handoffId = new URL(request.url).searchParams.get("handoff");
  const result = await prepareNotionOAuthRedirect(handoffId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.redirect(result.authorizeUrl, 302);
}

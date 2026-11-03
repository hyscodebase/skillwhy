import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { portalConfig } from "@/lib/config";
export async function GET(request: NextRequest) {
  const config = portalConfig();
  if (!config)
    return new Response("계정 연결을 준비하고 있습니다.", { status: 503 });
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        `${config.origin}${request.nextUrl.searchParams.get("flow") === "recovery" ? "/account/password" : "/account"}`,
      );
  }
  return NextResponse.redirect(
    `${config.origin}/login?notice=confirmation-error`,
  );
}

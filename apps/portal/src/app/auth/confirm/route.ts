import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { portalConfig } from "@/lib/config";
export async function GET(request: NextRequest) {
  const config = portalConfig();
  if (!config)
    return new Response("계정 연결을 준비하고 있습니다.", { status: 503 });
  const hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (hash && (type === "email" || type === "signup" || type === "recovery")) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash: hash, type });
    if (!error)
      return NextResponse.redirect(
        `${config.origin}${type === "recovery" ? "/account/password" : "/account"}`,
      );
  }
  return NextResponse.redirect(
    `${config.origin}/login?notice=confirmation-error`,
  );
}

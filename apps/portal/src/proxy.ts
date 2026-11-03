import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { portalConfig } from "@/lib/config";

export async function proxy(request: NextRequest) {
  const config = portalConfig();
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.origin.startsWith("https:"),
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/signup"],
};

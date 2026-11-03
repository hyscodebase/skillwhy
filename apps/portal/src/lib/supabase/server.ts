import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { portalConfig } from "@/lib/config";

export async function supabaseServer() {
  const config = portalConfig();
  if (!config) throw new Error("PORTAL_NOT_CONFIGURED");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.origin.startsWith("https:"),
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies; Proxy refreshes them. */
        }
      },
    },
  });
}

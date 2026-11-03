export function portalConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const site = process.env.PORTAL_SITE_URL;
  if (!url || !key || !site || key.startsWith("replace_")) return null;
  try {
    const api = new URL(url);
    const origin = new URL(site);
    if (
      api.protocol !== "https:" &&
      !(api.protocol === "http:" && ["localhost", "127.0.0.1"].includes(api.hostname))
    )
      return null;
    if (
      origin.protocol !== "https:" &&
      !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))
    )
      return null;
    return { url, key, origin: origin.origin };
  } catch {
    return null;
  }
}

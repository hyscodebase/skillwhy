import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { portalConfig } from "@/lib/config";

export type Member = {
  id: string;
  display_name: string;
  email: string;
  role: "member" | "admin";
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
};
export async function sessionUser() {
  if (!portalConfig()) redirect("/login?notice=unavailable");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}
export async function activeMember(admin = false) {
  const session = await sessionUser();
  const { data, error } = await session.supabase
    .from("member_profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data || data.status !== "active")
    redirect("/account/restricted");
  const member = data as Member;
  if (admin && member.role !== "admin") redirect("/account?notice=forbidden");
  return { ...session, member };
}

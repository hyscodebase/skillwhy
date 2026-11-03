"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { portalConfig } from "@/lib/config";
import { activeMember, sessionUser } from "@/lib/member";
import { trustedOrigin, validDisplayName } from "@/lib/security.mjs";

async function checkOrigin() {
  const config = portalConfig();
  if (!config || !trustedOrigin((await headers()).get("origin"), config.origin))
    throw new Error(
      "요청 출처를 확인할 수 없습니다. 정식 주소에서 다시 시도해 주세요.",
    );
  return config;
}
const text = (data: FormData, key: string) =>
  typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
export async function login(data: FormData) {
  await checkOrigin();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(data, "email"),
    password: String(data.get("password") ?? ""),
  });
  if (error) redirect("/login?notice=credentials");
  redirect("/account");
}
export async function signup(data: FormData) {
  const config = await checkOrigin();
  const name = text(data, "display_name");
  const password = String(data.get("password") ?? "");
  if (
    !validDisplayName(name) ||
    password.length < 12 ||
    password.length > 128 ||
    data.get("privacy") !== "on"
  )
    redirect("/signup?notice=invalid");
  const supabase = await supabaseServer();
  const { data: result, error } = await supabase.auth.signUp({
    email: text(data, "email"),
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: `${config.origin}/auth/callback`,
    },
  });
  if (error) redirect("/signup?notice=signup");
  if (result.session) redirect("/account");
  redirect("/login?notice=check-email");
}
export async function logout() {
  await checkOrigin();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut();
  if (error) redirect("/login?notice=signout-error");
  redirect("/login?notice=signed-out");
}
export async function sendPasswordReset(data: FormData) {
  const config = await checkOrigin();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(
    text(data, "email"),
    { redirectTo: `${config.origin}/auth/callback?flow=recovery` },
  );
  if (error) redirect("/forgot-password?notice=reset-error");
  redirect("/forgot-password?notice=reset-sent");
}
export async function updatePassword(data: FormData) {
  await checkOrigin();
  const { supabase } = await sessionUser();
  const password = String(data.get("password") ?? "");
  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== String(data.get("password_confirmation") ?? "")
  )
    redirect("/account/password?notice=invalid-password");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account/password?notice=password-error");
  const { error: signoutError } = await supabase.auth.signOut();
  if (signoutError)
    redirect("/account/password?notice=password-updated-session-error");
  redirect("/login?notice=password-updated");
}
export async function updateProfile(data: FormData) {
  await checkOrigin();
  const { supabase, user } = await activeMember();
  const display_name = text(data, "display_name");
  if (!validDisplayName(display_name)) redirect("/account?notice=invalid-name");
  const { data: rows, error } = await supabase
    .from("member_profiles")
    .update({ display_name })
    .eq("id", user.id)
    .select("id");
  if (error || !rows?.length) redirect("/account?notice=save-error");
  revalidatePath("/account");
  redirect("/account?notice=saved");
}
export async function changeStatus(data: FormData) {
  await checkOrigin();
  const { supabase, user } = await activeMember(true);
  const target = text(data, "target_user");
  const status = text(data, "desired_status");
  if (target === user.id || !["active", "suspended"].includes(status))
    redirect("/admin?notice=invalid-status");
  const { error } = await supabase.rpc("portal_set_member_status", {
    target_user: target,
    desired_status: status,
  });
  if (error) redirect("/admin?notice=change-error");
  revalidatePath("/admin");
  redirect("/admin?notice=updated");
}
export async function requestDeletion(data: FormData) {
  await checkOrigin();
  const { supabase } = await sessionUser();
  if (data.get("confirm") !== "on") redirect("/account?notice=confirm-request");
  const reason = text(data, "reason");
  if (reason.length > 500) redirect("/account?notice=invalid-reason");
  const { error } = await supabase.rpc("portal_request_account_deletion", {
    request_reason: reason,
  });
  if (error) redirect("/account?notice=request-error");
  redirect("/account/requests?notice=requested");
}
export async function reviewDeletion(data: FormData) {
  await checkOrigin();
  const { supabase } = await activeMember(true);
  const { error } = await supabase.rpc("portal_review_account_deletion", {
    request_id: text(data, "request_id"),
  });
  if (error) redirect("/admin?notice=review-error");
  revalidatePath("/admin");
  redirect("/admin?notice=reviewed");
}

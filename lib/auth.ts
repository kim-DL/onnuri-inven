import { supabase } from "./supabaseClient";

export type UserProfile = {
  user_id: string;
  active: boolean | null;
};

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { user: null, error };
  }

  return { user: data.session?.user ?? null, error: null };
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("users_profile")
    .select("user_id, active")
    .eq("user_id", userId)
    .maybeSingle();

  return { profile: data ?? null, error };
}

export function signOut() {
  return supabase.auth.signOut();
}

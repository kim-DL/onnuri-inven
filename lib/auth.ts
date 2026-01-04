import { supabase } from "./supabaseClient";

export type UserProfile = {
    user_id: string;
    active: boolean;
    role: string | null;
};

export async function getSessionUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { user: null, error };
    return { user: data.user ?? null, error: null };
}

export async function getUserProfile(userId: string) {
    const { data, error } = await supabase
        .from("users_profile")
        .select("user_id, active, role")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) return { profile: null as UserProfile | null, error };
    return { profile: (data as UserProfile | null) ?? null, error: null };
}

export async function signOut() {
    await supabase.auth.signOut();
}

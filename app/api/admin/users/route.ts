import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateUserPayload = {
  display_name?: string;
  email?: string;
  password?: string;
};

function parseBearerToken(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) {
    return null;
  }
  return headerValue.slice(prefix.length).trim() || null;
}

function mapAuthCreateError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("duplicate")) {
    return "duplicate_email";
  }
  if (normalized.includes("invalid email")) {
    return "invalid_email";
  }
  if (normalized.includes("password") && normalized.includes("least")) {
    return "weak_password";
  }
  return "create_user_failed";
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("Missing Supabase server configuration.");
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 }
    );
  }

  const accessToken = parseBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } =
    await authClient.auth.getUser(accessToken);

  if (userError || !userData.user) {
    console.error("Failed to verify requester", userError);
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const requesterId = userData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from("users_profile")
    .select("user_id, role, active")
    .eq("user_id", requesterId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch requester profile", profileError);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  if (!profile || profile.active !== true || profile.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let payload: CreateUserPayload;
  try {
    payload = (await request.json()) as CreateUserPayload;
  } catch (error) {
    console.error("Invalid payload", error);
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const displayName =
    typeof payload.display_name === "string" ? payload.display_name.trim() : "";
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!displayName || !email || !password) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const { data: createData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !createData.user) {
    const errorCode = mapAuthCreateError(createError?.message ?? "");
    console.error("Failed to create auth user", createError);
    return NextResponse.json({ ok: false, error: errorCode }, { status: 400 });
  }

  const newUserId = createData.user.id;
  const { error: profileUpsertError } = await adminClient
    .from("users_profile")
    .upsert(
      {
        user_id: newUserId,
        role: "staff",
        active: true,
        display_name: displayName,
      },
      { onConflict: "user_id" }
    );

  if (profileUpsertError) {
    console.error("Failed to upsert user profile", profileUpsertError);
    try {
      await adminClient.auth.admin.deleteUser(newUserId);
    } catch (error) {
      console.error("Failed to rollback auth user", error);
    }
    return NextResponse.json(
      { ok: false, error: "profile_upsert_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user_id: newUserId });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type DeleteProductPayload = {
  product_id?: string;
  confirm_name?: string;
};

type DeleteErrorCode =
  | "unauthorized"
  | "forbidden"
  | "missing_fields"
  | "product_not_found"
  | "not_archived"
  | "name_mismatch"
  | "invalid_photo_path"
  | "storage_delete_failed"
  | "delete_failed"
  | "server_misconfigured";

const BUCKET_NAME = "product-photos";

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

function normalizeConfirmName(value: string) {
  return value.trim().toLowerCase();
}

function extractStoragePath(photoRef: string | null) {
  const trimmed = typeof photoRef === "string" ? photoRef.trim() : "";
  if (!trimmed) {
    return { paths: [] as string[], invalid: false, external: false };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      const objectIndex = segments.findIndex((segment) => segment === "object");
      if (objectIndex === -1) {
        return { paths: [] as string[], invalid: false, external: true };
      }
      const bucket = segments[objectIndex + 2];
      if (!bucket || bucket !== BUCKET_NAME) {
        return { paths: [] as string[], invalid: true, external: false };
      }
      const objectPath = segments.slice(objectIndex + 3).join("/");
      if (!objectPath) {
        return { paths: [] as string[], invalid: true, external: false };
      }
      return { paths: [objectPath], invalid: false, external: false };
    } catch (error) {
      console.error("Failed to parse photo URL", error);
      return { paths: [] as string[], invalid: false, external: true };
    }
  }

  let normalized = trimmed;
  if (normalized.startsWith(`${BUCKET_NAME}/`)) {
    normalized = normalized.slice(`${BUCKET_NAME}/`.length);
  }
  normalized = normalized.replace(/^\/+/, "");
  if (!normalized) {
    return { paths: [] as string[], invalid: false, external: false };
  }
  return { paths: [normalized], invalid: false, external: false };
}

function mapDeleteError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("not authenticated")) {
    return { status: 401, code: "unauthorized" as DeleteErrorCode };
  }
  if (normalized.includes("inactive user") || normalized.includes("admin only")) {
    return { status: 403, code: "forbidden" as DeleteErrorCode };
  }
  if (normalized.includes("name mismatch")) {
    return { status: 400, code: "name_mismatch" as DeleteErrorCode };
  }
  if (normalized.includes("not archived")) {
    return { status: 400, code: "not_archived" as DeleteErrorCode };
  }
  if (normalized.includes("not found")) {
    return { status: 404, code: "product_not_found" as DeleteErrorCode };
  }
  return { status: 500, code: "delete_failed" as DeleteErrorCode };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("Missing Supabase server configuration.");
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" satisfies DeleteErrorCode },
      { status: 500 }
    );
  }

  const accessToken = parseBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" satisfies DeleteErrorCode },
      { status: 401 }
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(
    accessToken
  );

  if (userError || !userData.user) {
    console.error("Failed to verify requester", userError);
    return NextResponse.json(
      { ok: false, error: "unauthorized" satisfies DeleteErrorCode },
      { status: 401 }
    );
  }

  const requesterId = userData.user.id;
  const { data: profile, error: profileError } = await adminClient
    .from("users_profile")
    .select("user_id, role, active")
    .eq("user_id", requesterId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch requester profile", profileError);
    return NextResponse.json(
      { ok: false, error: "delete_failed" satisfies DeleteErrorCode },
      { status: 500 }
    );
  }

  if (!profile || profile.active !== true || profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "forbidden" satisfies DeleteErrorCode },
      { status: 403 }
    );
  }

  let payload: DeleteProductPayload;
  try {
    payload = (await request.json()) as DeleteProductPayload;
  } catch (error) {
    console.error("Invalid payload", error);
    return NextResponse.json(
      { ok: false, error: "missing_fields" satisfies DeleteErrorCode },
      { status: 400 }
    );
  }

  const productId =
    typeof payload.product_id === "string" ? payload.product_id.trim() : "";
  const confirmName =
    typeof payload.confirm_name === "string" ? payload.confirm_name.trim() : "";

  if (!productId || !confirmName) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" satisfies DeleteErrorCode },
      { status: 400 }
    );
  }

  const { data: product, error: productError } = await adminClient
    .from("products")
    .select("id, name, active, photo_url")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    console.error("Failed to fetch product", productError);
    return NextResponse.json(
      { ok: false, error: "delete_failed" satisfies DeleteErrorCode },
      { status: 500 }
    );
  }

  if (!product) {
    return NextResponse.json(
      { ok: false, error: "product_not_found" satisfies DeleteErrorCode },
      { status: 404 }
    );
  }

  if (product.active === true) {
    return NextResponse.json(
      { ok: false, error: "not_archived" satisfies DeleteErrorCode },
      { status: 400 }
    );
  }

  const normalizedConfirm = normalizeConfirmName(confirmName);
  const normalizedName = normalizeConfirmName(product.name ?? "");
  if (!normalizedName || normalizedConfirm !== normalizedName) {
    return NextResponse.json(
      { ok: false, error: "name_mismatch" satisfies DeleteErrorCode },
      { status: 400 }
    );
  }

  const storageInfo = extractStoragePath(product.photo_url ?? null);
  if (storageInfo.invalid) {
    return NextResponse.json(
      { ok: false, error: "invalid_photo_path" satisfies DeleteErrorCode },
      { status: 400 }
    );
  }

  if (storageInfo.paths.length > 0) {
    const { error: storageError } = await adminClient.storage
      .from(BUCKET_NAME)
      .remove(storageInfo.paths);

    if (storageError) {
      console.error("Failed to remove product photo", {
        message: storageError?.message,
        details: storageError?.details,
        hint: storageError?.hint,
      });
      return NextResponse.json(
        { ok: false, error: "storage_delete_failed" satisfies DeleteErrorCode },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await userClient.rpc("delete_product", {
    p_product_id: productId,
    p_confirm_name: confirmName,
  });

  if (deleteError) {
    console.error("Failed to delete product", {
      message: deleteError?.message,
      details: deleteError?.details,
      hint: deleteError?.hint,
      code: deleteError?.code,
    });
    const mapped = mapDeleteError(deleteError?.message);
    return NextResponse.json(
      { ok: false, error: mapped.code },
      { status: mapped.status }
    );
  }

  return NextResponse.json({ ok: true });
}

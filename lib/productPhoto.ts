"use client";

import { supabase } from "@/lib/supabaseClient";

export const PRODUCT_PHOTO_BUCKET = "product-photos";

// UUID-based paths let unchanged image URLs stay cacheable while changed photos get a new URL.
export const PRODUCT_PHOTO_UPLOAD_CACHE_CONTROL = "31536000";

export function resolveProductPhotoUrl(photoRef: string | null | undefined) {
  const normalized = photoRef?.trim() ?? "";
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  const { data } = supabase.storage
    .from(PRODUCT_PHOTO_BUCKET)
    .getPublicUrl(normalized);
  return data.publicUrl ?? "";
}

export function isStorageProductPhotoRef(photoRef: string | null | undefined) {
  const normalized = photoRef?.trim() ?? "";
  if (!normalized) {
    return false;
  }
  return !normalized.startsWith("http://") && !normalized.startsWith("https://");
}

function getPhotoExtension(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg") {
    return "jpg";
  }
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  if (type === "image/heic") {
    return "heic";
  }
  if (type === "image/heif") {
    return "heif";
  }
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "jpg";
}

export function buildProductPhotoPath(productId: string, file: File) {
  const extension = getPhotoExtension(file);
  const fileId = crypto.randomUUID();
  return `products/${productId}/${fileId}.${extension}`;
}

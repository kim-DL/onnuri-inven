"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { resizeImageForUpload } from "@/lib/resizeImageForUpload";
import { supabase } from "@/lib/supabaseClient";
import { useExpiryWarningDays } from "@/lib/useExpiryWarningDays";

type Product = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_id: string | null;
  unit: string | null;
  spec: string | null;
  origin_country: string | null;
  expiry_date: string | null;
  photo_url: string | null;
};

type Zone = {
  id: string;
  name: string;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type InventoryLog = {
  id: string;
  created_at: string;
  delta: number;
  before_stock: number;
  after_stock: number;
  actor_name?: string | null;
  created_by?: string | null;
  note?: string | null;
};

type AdjustMode = "in" | "out";

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";

type EditFormState = {
  name: string;
  manufacturer: string;
  zoneId: string;
  unit: string;
  spec: string;
  originCountry: string;
  expiryDate: string;
};

type EditFormErrors = Partial<Record<keyof EditFormState, string>>;

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F9F8F6",
  padding: "16px",
};

const containerStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const backLinkStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
};

const titleStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
};

const cardStyle: CSSProperties = {
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const infoTopRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(96px, 128px) minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
};

const photoFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#F1EDE7",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const photoPlaceholderStyle: CSSProperties = {
  fontSize: "14px",
  color: "#8C847D",
  fontWeight: 600,
  textAlign: "center",
};

const photoImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const kpiBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  justifyContent: "center",
  minWidth: 0,
  textAlign: "center",
};

const kpiBadgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "center",
};

const factsSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  paddingTop: "12px",
  borderTop: "1px solid #E8E2DB",
};

const factsRowStyle: CSSProperties = {
  display: "flex",
};

const factsRowDividerStyle: CSSProperties = {
  borderTop: "1px solid #E8E2DB",
  paddingTop: "12px",
};

const factsCellStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
  textAlign: "center",
};

const factsCellDividerStyle: CSSProperties = {
  ...factsCellStyle,
  borderRight: "1px solid #E8E2DB",
  paddingRight: "12px",
  marginRight: "12px",
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const valueStyle: CSSProperties = {
  fontSize: "17px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const stockValueStyle: CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  color: "#2E2A27",
  margin: 0,
};

const badgeBaseStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
};

const badgeExpiredStyle: CSSProperties = {
  ...badgeBaseStyle,
  color: "#B42318",
  background: "#FEE4E2",
  borderColor: "#FECDCA",
};

const badgeWarningStyle: CSSProperties = {
  ...badgeBaseStyle,
  color: "#B54708",
  background: "#FEF0C7",
  borderColor: "#FEDF89",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const logListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const logRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
};

const logMetaStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const logValueStyle: CSSProperties = {
  fontSize: "13px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const helperTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#5A514B",
  margin: 0,
};

const skeletonBlockStyle: CSSProperties = {
  background: "#E7E3DD",
  borderRadius: "10px",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2E2A27",
  color: "#FFFFFF",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const archiveButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  color: "#B42318",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const editButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const actionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const actionButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: "100%",
};

const actionButtonAltStyle: CSSProperties = {
  ...buttonStyle,
  width: "100%",
  background: "#FFFFFF",
  color: "#2E2A27",
  border: "1px solid #D6D2CC",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(46, 42, 39, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 50,
};

const modalCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "360px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const modalTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
  color: "#2E2A27",
};

const modalInputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "16px",
  background: "#FFFFFF",
};

const modalSelectStyle: CSSProperties = {
  ...modalInputStyle,
};

const modalButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
};

const modalFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const modalTextareaStyle: CSSProperties = {
  minHeight: "96px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "15px",
  background: "#FFFFFF",
  resize: "vertical",
};

const modalCancelStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

const modalConfirmStyle: CSSProperties = {
  ...buttonStyle,
  flex: 1,
};

const modalDangerStyle: CSSProperties = {
  ...buttonStyle,
  flex: 1,
  background: "#B42318",
};

function SkeletonDetail() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...skeletonBlockStyle, height: "44px", width: "120px" }} />
      <div style={{ ...skeletonBlockStyle, height: "28px", width: "60%" }} />
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
        <div style={{ ...skeletonBlockStyle, height: "18px", width: "70%" }} />
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "35%" }} />
      </div>
      <div style={{ ...cardStyle, border: "none" }}>
        <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
        <div style={{ ...skeletonBlockStyle, height: "24px", width: "30%" }} />
      </div>
      <div style={{ ...skeletonBlockStyle, height: "18px", width: "120px" }} />
      <div style={{ ...skeletonBlockStyle, height: "48px", width: "100%" }} />
      <div style={{ ...skeletonBlockStyle, height: "48px", width: "100%" }} />
    </div>
  );
}

function formatDelta(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }
  return `${delta}`;
}

function formatTimestamp(raw: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("ko-KR");
}

function getActorLabel(log: InventoryLog) {
  const actorName = log.actor_name?.trim();
  if (actorName) {
    return actorName;
  }
  const createdBy = log.created_by?.trim();
  if (createdBy) {
    return createdBy.slice(0, 8);
  }
  return "Unknown";
}

function getAdjustErrorMessage(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message ?? "")
      : "";
  const lowered = message.toLowerCase();

  if (
    lowered.includes("after_stock") ||
    lowered.includes("insufficient") ||
    lowered.includes("negative") ||
    lowered.includes("below")
  ) {
    return "재고가 부족해요.";
  }

  return "재고 조정에 실패했어요.";
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDaysLeft(dateValue: string) {
  const parts = dateValue.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [yearRaw, monthRaw, dayRaw] = parts;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const targetDate = new Date(year, month - 1, day);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }
  if (
    targetDate.getFullYear() !== year ||
    targetDate.getMonth() !== month - 1 ||
    targetDate.getDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((targetDate.getTime() - todayLocal.getTime()) / MS_PER_DAY);
}

function formatOptionalLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "미입력";
}

function resolvePhotoUrl(photoRef: string) {
  if (!photoRef) {
    return "";
  }
  if (photoRef.startsWith("http://") || photoRef.startsWith("https://")) {
    return photoRef;
  }
  const { data } = supabase.storage.from("product-photos").getPublicUrl(photoRef);
  return data.publicUrl ?? "";
}

function isStoragePhotoRef(photoRef: string) {
  if (!photoRef) {
    return false;
  }
  return !photoRef.startsWith("http://") && !photoRef.startsWith("https://");
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

function buildPhotoPath(productId: string, file: File) {
  const extension = getPhotoExtension(file);
  const fileId = crypto.randomUUID();
  return `products/${productId}/${fileId}.${extension}`;
}

function getPhotoErrorMessage(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string
) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("not authenticated") || message.includes("jwt")) {
    return "세션이 만료되었어요. 다시 로그인해 주세요.";
  }
  if (message.includes("inactive user") || error?.code === "42501") {
    return "권한이 없어요.";
  }
  return fallback;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const productId = Array.isArray(rawId) ? rawId[0] : rawId;
  const hasValidId = typeof productId === "string" && productId.length > 0;

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [product, setProduct] = useState<Product | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [stock, setStock] = useState(0);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { value: expiryWarningDays } = useExpiryWarningDays({
    enabled: authState === "authed",
  });
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesState, setZonesState] = useState<DataState>("idle");
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    manufacturer: "",
    zoneId: "",
    unit: "",
    spec: "",
    originCountry: "",
    expiryDate: "",
  });
  const [editErrors, setEditErrors] = useState<EditFormErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoErrorSrc, setPhotoErrorSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [adjustMode, setAdjustMode] = useState<AdjustMode | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustValidationError, setAdjustValidationError] = useState<
    string | null
  >(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveValidationError, setArchiveValidationError] = useState<
    string | null
  >(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const queryString = searchParams.toString();
  const backHref = queryString ? `/products?${queryString}` : "/products";

  const openAdjustModal = (mode: AdjustMode) => {
    setAdjustMode(mode);
    setAdjustQty("");
    setAdjustError(null);
    setAdjustValidationError(null);
  };

  const loadZones = async () => {
    setZonesState("loading");
    setZonesError(null);

    const { data, error } = await supabase
      .from("zones")
      .select("id, name, sort_order, active")
      .eq("active", true)
      .order("sort_order")
      .order("name");

    if (error) {
      console.error("Failed to fetch zones", error);
      setZonesError("구역 정보를 불러오지 못했어요.");
      setZonesState("error");
      return;
    }

    setZones(data ?? []);
    setZonesState("ready");
  };

  const openEditModal = () => {
    if (!product) {
      return;
    }

    setIsEditOpen(true);
    setEditForm({
      name: product.name ?? "",
      manufacturer: product.manufacturer ?? "",
      zoneId: product.zone_id ?? "",
      unit: product.unit ?? "",
      spec: product.spec ?? "",
      originCountry: product.origin_country ?? "",
      expiryDate: product.expiry_date ?? "",
    });
    setEditErrors({});
    setEditError(null);
    setPhotoError(null);
    setPhotoSuccess(null);

    if (zonesState !== "ready" && zonesState !== "loading") {
      void loadZones();
    }
  };

  const openArchiveModal = () => {
    setAdjustMode(null);
    setIsArchiveOpen(true);
    setArchiveReason("");
    setArchiveError(null);
    setArchiveValidationError(null);
  };

  const closeAdjustModal = () => {
    if (isAdjusting) {
      return;
    }
    setAdjustMode(null);
    setAdjustQty("");
    setAdjustError(null);
    setAdjustValidationError(null);
  };

  const closeEditModal = () => {
    if (isSaving || isPhotoUpdating) {
      return;
    }
    setIsEditOpen(false);
    setEditErrors({});
    setEditError(null);
    setPhotoError(null);
    setPhotoSuccess(null);
  };

  const closeArchiveModal = () => {
    if (isArchiving) {
      return;
    }
    setIsArchiveOpen(false);
    setArchiveReason("");
    setArchiveError(null);
    setArchiveValidationError(null);
  };

  const refreshInventoryAndLogs = async (targetId: string) => {
    const [inventoryResult, logsResult] = await Promise.all([
      supabase
        .from("inventory")
        .select("product_id, stock")
        .eq("product_id", targetId)
        .maybeSingle(),
      supabase.rpc("get_inventory_logs_for_product", {
        p_product_id: targetId,
        p_limit: 50,
      }),
    ]);

    if (inventoryResult.error || logsResult.error) {
      if (inventoryResult.error) {
        console.error("Failed to fetch inventory", inventoryResult.error);
      }
      if (logsResult.error) {
        console.error("Failed to fetch inventory logs", logsResult.error);
      }
      return false;
    }

    setStock((inventoryResult.data as InventoryRow | null)?.stock ?? 0);
    setLogs(logsResult.data ?? []);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);

      const { user, error: sessionError } = await getSessionUser();
      if (cancelled) {
        return;
      }

      if (sessionError) {
        console.error("Failed to read session", sessionError);
        setErrorMessage("인증 정보를 불러오지 못했어요.");
        setAuthState("error");
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      if (cancelled) {
        return;
      }

      if (profileError) {
        console.error("Failed to fetch users_profile", profileError);
        setErrorMessage("프로필 정보를 불러오지 못했어요.");
        setAuthState("error");
        return;
      }

      if (!profile) {
        const { error: signOutError } = await signOut();
        if (signOutError) {
          console.error("Failed to sign out", signOutError);
        }
        router.replace("/login?notice=profile-missing");
        return;
      }

      if (profile.active === false) {
        setAuthState("blocked");
        return;
      }

      setAuthState("authed");
    };

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authState !== "authed") {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      if (!hasValidId) {
        setErrorMessage("상품 정보를 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      setDataState("loading");
      setErrorMessage(null);
      setNotFound(false);

      const productResult = await supabase
        .from("products")
        .select(
          "id, name, manufacturer, zone_id, unit, spec, origin_country, expiry_date, photo_url"
        )
        .eq("id", productId)
        .eq("active", true)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (productResult.error) {
        console.error("Failed to fetch product", productResult.error);
        setErrorMessage("상품 정보를 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      if (!productResult.data) {
        setNotFound(true);
        setProduct(null);
        setZoneName(null);
        setStock(0);
        setLogs([]);
        setDataState("ready");
        return;
      }

      const productData = productResult.data;
      const inventoryPromise = supabase
        .from("inventory")
        .select("product_id, stock")
        .eq("product_id", productData.id)
        .maybeSingle();

      const logsPromise = supabase.rpc("get_inventory_logs_for_product", {
        p_product_id: productData.id,
        p_limit: 50,
      });

      const zonePromise = productData.zone_id
        ? supabase
          .from("zones")
          .select("id, name")
          .eq("id", productData.zone_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [inventoryResult, logsResult, zoneResult] = await Promise.all([
        inventoryPromise,
        logsPromise,
        zonePromise,
      ]);

      if (cancelled) {
        return;
      }

      if (inventoryResult.error || logsResult.error || zoneResult.error) {
        if (inventoryResult.error) {
          console.error("Failed to fetch inventory", inventoryResult.error);
        }
        if (logsResult.error) {
          console.error("Failed to fetch inventory logs", logsResult.error);
        }
        if (zoneResult.error) {
          console.error("Failed to fetch zones", zoneResult.error);
        }
        setErrorMessage("상품 정보를 불러오지 못했어요.");
        setDataState("error");
        return;
      }

      setProduct(productData);
      setZoneName(zoneResult.data?.name ?? null);
      setStock((inventoryResult.data as InventoryRow | null)?.stock ?? 0);
      setLogs(logsResult.data ?? []);
      setDataState("ready");
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [authState, hasValidId, productId]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const manufacturerLabel = formatOptionalLabel(product?.manufacturer);
  const zoneLabel = formatOptionalLabel(zoneName);
  const unitLabel = formatOptionalLabel(product?.unit);
  const specLabel = formatOptionalLabel(product?.spec);
  const originLabel = formatOptionalLabel(product?.origin_country);
  const expiryInfo: {
    label: string;
    badge: { text: string; style: CSSProperties } | null;
  } = (() => {
    const expiryDate = product?.expiry_date;
    if (!expiryDate) {
      return { label: "미입력", badge: null };
    }

    const daysLeft = getDaysLeft(expiryDate);
    if (daysLeft === null) {
      return { label: expiryDate, badge: null };
    }
    if (daysLeft < 0) {
      return {
        label: expiryDate,
        badge: { text: "만료", style: badgeExpiredStyle },
      };
    }
    if (daysLeft <= expiryWarningDays) {
      return {
        label: expiryDate,
        badge: { text: `임박 D-${daysLeft}`, style: badgeWarningStyle },
      };
    }

    return { label: expiryDate, badge: null };
  })();
  const photoRef = product?.photo_url?.trim() ?? "";
  const photoSrc = photoRef ? resolvePhotoUrl(photoRef) : "";
  const hasPhoto = photoSrc.length > 0 && photoErrorSrc !== photoSrc;
  const isZonesLoading = zonesState === "loading";
  const zoneOptions = useMemo(
    () =>
      zones.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.name}
        </option>
      )),
    [zones]
  );

  const updateEditField = (field: keyof EditFormState, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (editErrors[field]) {
      setEditErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePhotoSelect = () => {
    if (isPhotoUpdating) {
      return;
    }
    setPhotoError(null);
    setPhotoSuccess(null);
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    if (!hasValidId || !productId) {
      setPhotoError("사진 변경에 실패했어요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("이미지 파일만 업로드할 수 있어요.");
      return;
    }

    setPhotoError(null);
    setPhotoSuccess(null);
    setIsPhotoUpdating(true);

    const previousPhotoRef = product?.photo_url?.trim() ?? "";
    const uploadFile = await resizeImageForUpload(file);
    const nextPath = buildPhotoPath(productId, uploadFile);

    const { error: uploadError } = await supabase.storage
      .from("product-photos")
      .upload(nextPath, uploadFile, { upsert: false });

    if (uploadError) {
      console.error("Failed to upload photo", {
        message: uploadError?.message,

      });
      setPhotoError(getPhotoErrorMessage(uploadError, "사진 업로드에 실패했어요."));
      setIsPhotoUpdating(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ photo_url: nextPath })
      .eq("id", productId);

    if (updateError) {
      console.error("Failed to update product photo", {
        message: updateError?.message,
        details: updateError?.details,
        hint: updateError?.hint,
        code: updateError?.code,
      });
      setPhotoError(getPhotoErrorMessage(updateError, "사진 변경에 실패했어요."));
      const { error: cleanupError } = await supabase.storage
        .from("product-photos")
        .remove([nextPath]);
      if (cleanupError) {
        console.error("Failed to clean up photo upload", {
          message: cleanupError?.message,

        });
      }
      setIsPhotoUpdating(false);
      return;
    }

    setProduct((prev) => (prev ? { ...prev, photo_url: nextPath } : prev));
    setPhotoSuccess("사진을 변경했어요.");
    setIsPhotoUpdating(false);

    if (isStoragePhotoRef(previousPhotoRef)) {
      const { error: removeError } = await supabase.storage
        .from("product-photos")
        .remove([previousPhotoRef]);
      if (removeError) {
        console.error("Failed to remove old photo", {
          message: removeError?.message,

        });
      }
    }
  };

  const handlePhotoDelete = async () => {
    if (!hasValidId || !productId) {
      setPhotoError("사진 삭제에 실패했어요.");
      return;
    }

    const currentPhotoRef = product?.photo_url?.trim() ?? "";
    if (!currentPhotoRef) {
      return;
    }

    setPhotoError(null);
    setPhotoSuccess(null);
    setIsPhotoUpdating(true);

    if (isStoragePhotoRef(currentPhotoRef)) {
      const { error: removeError } = await supabase.storage
        .from("product-photos")
        .remove([currentPhotoRef]);
      if (removeError) {
        console.error("Failed to remove photo", {
          message: removeError?.message,

        });
      }
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ photo_url: null })
      .eq("id", productId);

    if (updateError) {
      console.error("Failed to clear product photo", {
        message: updateError?.message,
        details: updateError?.details,
        hint: updateError?.hint,
        code: updateError?.code,
      });
      setPhotoError(getPhotoErrorMessage(updateError, "사진 삭제에 실패했어요."));
      setIsPhotoUpdating(false);
      return;
    }

    setProduct((prev) => (prev ? { ...prev, photo_url: null } : prev));
    setPhotoSuccess("사진을 삭제했어요.");
    setIsPhotoUpdating(false);
  };

  const handleEditConfirm = async () => {
    if (!hasValidId || !productId) {
      setEditError("수정에 실패했어요.");
      return;
    }

    const trimmedName = editForm.name.trim();
    const errors: EditFormErrors = {};
    if (!trimmedName) {
      errors.name = "제품명을 입력해 주세요.";
    }
    if (!editForm.zoneId) {
      errors.zoneId = "구역을 선택해 주세요.";
    }

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setEditError(null);
    setIsSaving(true);

    const nextManufacturer = normalizeOptional(editForm.manufacturer);
    const nextUnit = normalizeOptional(editForm.unit);
    const nextSpec = normalizeOptional(editForm.spec);
    const nextOrigin = normalizeOptional(editForm.originCountry);
    const nextExpiry = normalizeOptional(editForm.expiryDate);

    const { error } = await supabase.rpc("update_product", {
      p_product_id: productId,
      p_name: trimmedName,
      p_zone_id: editForm.zoneId,
      p_manufacturer: nextManufacturer,
      p_unit: nextUnit,
      p_spec: nextSpec,
      p_origin_country: nextOrigin,
      p_expiry_date: nextExpiry,
    });

    if (error) {
      console.error("Failed to update product", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setEditError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else if (message.includes("inactive user")) {
        setEditError("권한이 없어요.");
      } else if (message.includes("name required")) {
        setEditErrors({ name: "제품명을 입력해 주세요." });
      } else if (message.includes("zone required")) {
        setEditErrors({ zoneId: "구역을 선택해 주세요." });
      } else {
        setEditError("수정에 실패했어요.");
      }
      setIsSaving(false);
      return;
    }

    setProduct((prev) =>
      prev
        ? {
          ...prev,
          name: trimmedName,
          manufacturer: nextManufacturer,
          zone_id: editForm.zoneId,
          unit: nextUnit,
          spec: nextSpec,
          origin_country: nextOrigin,
          expiry_date: nextExpiry,
        }
        : prev
    );

    const zoneMatch = zones.find((zone) => zone.id === editForm.zoneId);
    if (zoneMatch) {
      setZoneName(zoneMatch.name);
    } else if (editForm.zoneId) {
      const { data, error: zoneError } = await supabase
        .from("zones")
        .select("name")
        .eq("id", editForm.zoneId)
        .maybeSingle();
      if (zoneError) {
        console.error("Failed to fetch zone", zoneError);
      } else {
        setZoneName(data?.name ?? null);
      }
    }

    setIsSaving(false);
    setIsEditOpen(false);
    setEditErrors({});
    setEditError(null);
  };

  const handleAdjustConfirm = async () => {
    if (!hasValidId || !productId || !adjustMode) {
      setAdjustError("재고 조정에 실패했어요.");
      return;
    }

    const normalized = adjustQty.trim();
    if (!/^\d+$/.test(normalized)) {
      setAdjustValidationError("수량을 올바르게 입력해 주세요.");
      return;
    }

    const quantity = Number(normalized);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setAdjustValidationError("수량을 올바르게 입력해 주세요.");
      return;
    }

    setAdjustValidationError(null);
    setAdjustError(null);
    setIsAdjusting(true);

    const delta = adjustMode === "in" ? quantity : -quantity;
    const { error } = await supabase.rpc("adjust_stock", {
      p_product_id: productId,
      p_delta: delta,
      p_note: null,
    });

    if (error) {
      console.error("Failed to adjust stock", error);
      setAdjustError(getAdjustErrorMessage(error));
      setIsAdjusting(false);
      return;
    }

    const refreshed = await refreshInventoryAndLogs(productId);
    setIsAdjusting(false);
    setAdjustMode(null);
    setAdjustQty("");
    setAdjustValidationError(null);

    if (!refreshed) {
      setAdjustError("재고 정보를 갱신하지 못했어요.");
    }
  };

  const handleArchiveConfirm = async () => {
    if (!hasValidId || !productId) {
      setArchiveError("비활성화에 실패했어요.");
      return;
    }

    const reason = archiveReason.trim();
    if (!reason) {
      setArchiveValidationError("사유를 입력해 주세요.");
      return;
    }

    setArchiveValidationError(null);
    setArchiveError(null);

    setIsArchiving(true);

    const { error } = await supabase.rpc("archive_product", {
      p_product_id: productId,
      p_reason: reason,
    });

    if (error) {
      console.error("Failed to archive product", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("reason required")) {
        setArchiveValidationError("사유를 입력해 주세요.");
      } else if (message.includes("inactive user")) {
        setArchiveError("권한이 없어요.");
      } else if (message.includes("not authenticated")) {
        setArchiveError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else {
        setArchiveError("비활성화에 실패했어요.");
      }
      setIsArchiving(false);
      return;
    }

    setIsArchiving(false);
    router.replace(backHref);
  };

  const handleLogout = async () => {
    setSignOutError(null);
    const { error } = await signOut();
    if (error) {
      console.error("Failed to sign out", error);
      setSignOutError("로그아웃에 실패했어요.");
      return;
    }
    router.replace("/login");
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {authState === "blocked" ? (
          <div style={{ ...cardStyle, gap: "12px" }}>
            <p style={helperTextStyle}>
              계정이 비활성화되어 있어 접근할 수 없어요.
            </p>
            <button type="button" style={buttonStyle} onClick={handleLogout}>
              로그아웃
            </button>
            {signOutError ? (
              <p style={helperTextStyle}>{signOutError}</p>
            ) : null}
          </div>
        ) : isLoading ? (
          <SkeletonDetail />
        ) : hasError ? (
          <div style={cardStyle}>
            <p style={helperTextStyle}>
              {errorMessage ?? "상품 정보를 불러오지 못했어요."}
            </p>
          </div>
        ) : notFound ? (
          <div style={cardStyle}>
            <p style={helperTextStyle}>상품을 찾을 수 없어요.</p>
            <Link href={backHref} style={backLinkStyle}>
              목록으로 돌아가기
            </Link>
          </div>
        ) : product ? (
          <>
            <header style={headerStyle}>
              <Link href={backHref} style={backLinkStyle}>
                목록으로
              </Link>
              <h1 style={titleStyle}>{product.name}</h1>
            </header>

            <div style={cardStyle}>
              <div style={infoTopRowStyle}>
                <div style={photoFrameStyle}>
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoSrc}
                      alt={`${product.name} 사진`}
                      style={photoImageStyle}
                      loading="lazy"
                      onError={() => setPhotoErrorSrc(photoSrc)}
                    />
                  ) : (
                    <span style={photoPlaceholderStyle}>사진</span>
                  )}
                </div>
                <div style={kpiBlockStyle}>
                  <p style={labelStyle}>현재 재고</p>
                  <p style={stockValueStyle}>{stock}</p>
                  {expiryInfo.badge ? (
                    <div style={kpiBadgeRowStyle}>
                      <span style={expiryInfo.badge.style}>
                        {expiryInfo.badge.text}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={factsSectionStyle}>
                <div style={factsRowStyle}>
                  <div style={factsCellDividerStyle}>
                    <p style={labelStyle}>제조사</p>
                    <p style={valueStyle}>{manufacturerLabel}</p>
                  </div>
                  <div style={factsCellStyle}>
                    <p style={labelStyle}>구역</p>
                    <p style={valueStyle}>{zoneLabel}</p>
                  </div>
                </div>
                <div style={{ ...factsRowStyle, ...factsRowDividerStyle }}>
                  <div style={factsCellDividerStyle}>
                    <p style={labelStyle}>단위</p>
                    <p style={valueStyle}>{unitLabel}</p>
                  </div>
                  <div style={factsCellStyle}>
                    <p style={labelStyle}>규격</p>
                    <p style={valueStyle}>{specLabel}</p>
                  </div>
                </div>
                <div style={{ ...factsRowStyle, ...factsRowDividerStyle }}>
                  <div style={factsCellDividerStyle}>
                    <p style={labelStyle}>원산지</p>
                    <p style={valueStyle}>{originLabel}</p>
                  </div>
                  <div style={factsCellStyle}>
                    <p style={labelStyle}>유통기한</p>
                    <p style={valueStyle}>{expiryInfo.label}</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={actionRowStyle}>
                <button
                  type="button"
                  style={actionButtonStyle}
                  onClick={() => openAdjustModal("in")}
                  disabled={isAdjusting}
                >
                  입고
                </button>
                <button
                  type="button"
                  style={actionButtonAltStyle}
                  onClick={() => openAdjustModal("out")}
                  disabled={isAdjusting}
                >
                  출고
                </button>
              </div>
              <button
                type="button"
                style={editButtonStyle}
                onClick={openEditModal}
                disabled={isSaving}
              >
                수정
              </button>
              {adjustMode ? null : adjustError ? (
                <p style={helperTextStyle}>{adjustError}</p>
              ) : null}
            </div>

            <div style={cardStyle}>
              <button
                type="button"
                style={archiveButtonStyle}
                onClick={openArchiveModal}
                disabled={isArchiving}
              >
                비활성화(아카이브)
              </button>
            </div>

            <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <h2 style={sectionTitleStyle}>최근 입출고 이력</h2>
              {logs.length === 0 ? (
                <div style={cardStyle}>
                  <p style={helperTextStyle}>이력 없음</p>
                </div>
              ) : (
                <div style={logListStyle}>
                  {logs.map((log) => (
                    <div key={log.id} style={logRowStyle}>
                      <p style={logMetaStyle}>
                        {formatTimestamp(log.created_at)} · {getActorLabel(log)}
                      </p>
                      <p style={logValueStyle}>
                        {formatDelta(log.delta)} · {log.before_stock} →{" "}
                        {log.after_stock}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
        {adjustMode ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="adjust-title"
            >
              <h2 id="adjust-title" style={modalTitleStyle}>
                {adjustMode === "in" ? "입고 수량" : "출고 수량"}
              </h2>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adjustQty}
                onChange={(event) => {
                  setAdjustQty(event.currentTarget.value);
                  if (adjustValidationError) {
                    setAdjustValidationError(null);
                  }
                }}
                placeholder="수량"
                aria-label="수량 입력"
                style={modalInputStyle}
              />
              {adjustValidationError ? (
                <p style={helperTextStyle}>{adjustValidationError}</p>
              ) : null}
              {adjustError ? <p style={helperTextStyle}>{adjustError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeAdjustModal}
                  disabled={isAdjusting}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalConfirmStyle}
                  onClick={handleAdjustConfirm}
                  disabled={isAdjusting}
                >
                  {isAdjusting ? "처리 중..." : "확인"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isEditOpen ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-title"
            >
              <h2 id="edit-title" style={modalTitleStyle}>
                상품 수정
              </h2>
              <div style={modalFieldStyle}>
                <span style={labelStyle}>사진</span>
                <div style={modalButtonRowStyle}>
                  <button
                    type="button"
                    style={modalCancelStyle}
                    onClick={handlePhotoSelect}
                    disabled={isPhotoUpdating}
                  >
                    {isPhotoUpdating ? "처리 중..." : "사진 변경"}
                  </button>
                  <button
                    type="button"
                    style={modalDangerStyle}
                    onClick={handlePhotoDelete}
                    disabled={isPhotoUpdating || !photoRef}
                  >
                    {isPhotoUpdating ? "처리 중..." : "사진 삭제"}
                  </button>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFileChange}
                  style={{ display: "none" }}
                />
                {photoError ? <p style={helperTextStyle}>{photoError}</p> : null}
                {photoSuccess ? (
                  <p style={helperTextStyle}>{photoSuccess}</p>
                ) : null}
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-name" style={labelStyle}>
                  제품명
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(event) => updateEditField("name", event.currentTarget.value)}
                  placeholder="제품명"
                  style={modalInputStyle}
                />
                {editErrors.name ? (
                  <p style={helperTextStyle}>{editErrors.name}</p>
                ) : null}
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-zone" style={labelStyle}>
                  구역
                </label>
                <select
                  id="edit-zone"
                  value={editForm.zoneId}
                  onChange={(event) =>
                    updateEditField("zoneId", event.currentTarget.value)
                  }
                  style={modalSelectStyle}
                  disabled={isZonesLoading}
                >
                  <option value="">
                    {isZonesLoading ? "구역 불러오는 중..." : "구역을 선택해 주세요"}
                  </option>
                  {zoneOptions}
                </select>
                {editErrors.zoneId ? (
                  <p style={helperTextStyle}>{editErrors.zoneId}</p>
                ) : null}
                {zonesError ? <p style={helperTextStyle}>{zonesError}</p> : null}
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-manufacturer" style={labelStyle}>
                  제조사
                </label>
                <input
                  id="edit-manufacturer"
                  type="text"
                  value={editForm.manufacturer}
                  onChange={(event) =>
                    updateEditField("manufacturer", event.currentTarget.value)
                  }
                  placeholder="제조사"
                  style={modalInputStyle}
                />
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-unit" style={labelStyle}>
                  단위
                </label>
                <input
                  id="edit-unit"
                  type="text"
                  value={editForm.unit}
                  onChange={(event) => updateEditField("unit", event.currentTarget.value)}
                  placeholder="단위"
                  style={modalInputStyle}
                />
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-spec" style={labelStyle}>
                  규격
                </label>
                <input
                  id="edit-spec"
                  type="text"
                  value={editForm.spec}
                  onChange={(event) => updateEditField("spec", event.currentTarget.value)}
                  placeholder="규격"
                  style={modalInputStyle}
                />
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-origin" style={labelStyle}>
                  원산지
                </label>
                <input
                  id="edit-origin"
                  type="text"
                  value={editForm.originCountry}
                  onChange={(event) =>
                    updateEditField("originCountry", event.currentTarget.value)
                  }
                  placeholder="원산지"
                  style={modalInputStyle}
                />
              </div>
              <div style={modalFieldStyle}>
                <label htmlFor="edit-expiry" style={labelStyle}>
                  유통기한
                </label>
                <input
                  id="edit-expiry"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(event) =>
                    updateEditField("expiryDate", event.currentTarget.value)
                  }
                  style={modalInputStyle}
                />
              </div>
              {editError ? <p style={helperTextStyle}>{editError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeEditModal}
                  disabled={isSaving}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalConfirmStyle}
                  onClick={handleEditConfirm}
                  disabled={isSaving}
                >
                  {isSaving ? "처리 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {isArchiveOpen ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-title"
            >
              <h2 id="archive-title" style={modalTitleStyle}>
                상품 비활성화
              </h2>
              <textarea
                value={archiveReason}
                onChange={(event) => {
                  setArchiveReason(event.currentTarget.value);
                  if (archiveValidationError) {
                    setArchiveValidationError(null);
                  }
                }}
                placeholder="사유 입력(필수)"
                aria-label="사유 입력"
                style={modalTextareaStyle}
              />
              {archiveValidationError ? (
                <p style={helperTextStyle}>{archiveValidationError}</p>
              ) : null}
              {archiveError ? <p style={helperTextStyle}>{archiveError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeArchiveModal}
                  disabled={isArchiving}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalDangerStyle}
                  onClick={handleArchiveConfirm}
                  disabled={isArchiving}
                >
                  {isArchiving ? "처리 중..." : "비활성화"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

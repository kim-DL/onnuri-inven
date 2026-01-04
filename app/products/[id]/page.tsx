"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_id: string | null;
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
};

type AdjustMode = "in" | "out";

type AuthState = "checking" | "authed" | "blocked" | "error";
type DataState = "idle" | "loading" | "ready" | "error";

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

const labelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#7B736C",
  margin: 0,
};

const valueStyle: CSSProperties = {
  fontSize: "15px",
  color: "#2E2A27",
  margin: 0,
  fontWeight: 600,
};

const stockValueStyle: CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#2E2A27",
  margin: 0,
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

const modalButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
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
      supabase
        .from("inventory_logs")
        .select("id, created_at, delta, before_stock, after_stock")
        .eq("product_id", targetId)
        .order("created_at", { ascending: false })
        .limit(20),
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
        .select("id, name, manufacturer, zone_id")
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

      const logsPromise = supabase
        .from("inventory_logs")
        .select("id, created_at, delta, before_stock, after_stock")
        .eq("product_id", productData.id)
        .order("created_at", { ascending: false })
        .limit(20);

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

  const manufacturerLabel = useMemo(() => {
    if (!product) {
      return "";
    }
    const trimmed = product.manufacturer?.trim();
    return trimmed ? trimmed : "제조사 미입력";
  }, [product]);

  const zoneLabel = zoneName ?? "구역 미지정";

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
              <div>
                <p style={labelStyle}>제조사</p>
                <p style={valueStyle}>{manufacturerLabel}</p>
              </div>
              <div>
                <p style={labelStyle}>구역</p>
                <p style={valueStyle}>{zoneLabel}</p>
              </div>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>현재 재고</p>
              <p style={stockValueStyle}>재고 {stock}</p>
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
                      <p style={logMetaStyle}>{formatTimestamp(log.created_at)}</p>
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

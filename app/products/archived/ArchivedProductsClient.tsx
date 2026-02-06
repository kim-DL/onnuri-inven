"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompositionEvent, CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSessionUser, getUserProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { ZONE_KEYWORDS, parseSearchTokens, tokensMatchText } from "@/lib/search";

type Zone = {
  id: string;
  name: string;
};

type ArchivedProduct = {
  id: string;
  name: string;
  manufacturer: string | null;
  zone_id: string | null;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type AuthState = "checking" | "authed" | "blocked" | "error";

type DataState = "idle" | "loading" | "ready" | "error";

const ZONE_PARAM_MAP = new Map(
  ZONE_KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword])
);

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

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
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

const logoutButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const chipBaseStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const chipActiveStyle: CSSProperties = {
  background: "#2E2A27",
  color: "#FFFFFF",
  border: "1px solid #2E2A27",
};

const inputStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  fontSize: "15px",
  background: "#FFFFFF",
};

const cardStyle: CSSProperties = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #E3DED8",
  background: "#FFFFFF",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const cardRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const cardRowLeftStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const cardRowRightStyle: CSSProperties = {
  fontSize: "13px",
  color: "#5A514B",
  margin: 0,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const cardActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
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

const restoreButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #D6D2CC",
  background: "#FFFFFF",
  color: "#2E2A27",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid #B42318",
  background: "#B42318",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
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

function normalizeZoneParam(zoneParam: string | null): string | null {
  if (!zoneParam) {
    return null;
  }
  const match = ZONE_PARAM_MAP.get(zoneParam.toLowerCase());
  return match ?? null;
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[0, 1, 2].map((item) => (
        <div key={item} style={{ ...cardStyle, border: "none" }}>
          <div style={{ ...skeletonBlockStyle, height: "18px", width: "60%" }} />
          <div style={{ ...skeletonBlockStyle, height: "14px", width: "40%" }} />
          <div style={{ ...skeletonBlockStyle, height: "12px", width: "30%" }} />
        </div>
      ))}
    </div>
  );
}

export default function ArchivedProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const backHref = queryString ? `/products?${queryString}` : "/products";

  const selectedZone = normalizeZoneParam(searchParams.get("zone"));
  const query = searchParams.get("q") ?? "";

  const [authState, setAuthState] = useState<AuthState>("checking");
  const [dataState, setDataState] = useState<DataState>("idle");
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [products, setProducts] = useState<ArchivedProduct[]>([]);
  const [stockByProductId, setStockByProductId] = useState<Map<string, number>>(
    new Map()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState(query);
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);
  const pendingUpdatesRef = useRef<{ zone?: string | null; q?: string } | null>(
    null
  );
  const [restoreTarget, setRestoreTarget] = useState<ArchivedProduct | null>(
    null
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedProduct | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = async () => {
      setAuthState("checking");
      setErrorMessage(null);
      setProfileRole(null);

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

      const { data: roleData, error: roleError } = await supabase
        .from("users_profile")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        console.error("Failed to fetch user role", roleError);
      } else {
        setProfileRole(roleData?.role ?? null);
      }

      setAuthState("authed");
    };

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadArchived = useCallback(async () => {
    setDataState("loading");
    setErrorMessage(null);

    const [zonesResult, productsResult, inventoryResult] = await Promise.all([
      supabase.from("zones").select("id, name").order("sort_order"),
      supabase
        .from("products")
        .select("id, name, manufacturer, zone_id")
        .eq("active", false)
        .order("name"),
      supabase.from("inventory").select("product_id, stock"),
    ]);

    if (zonesResult.error || productsResult.error || inventoryResult.error) {
      if (zonesResult.error) {
        console.error("Failed to fetch zones", zonesResult.error);
      }
      if (productsResult.error) {
        console.error("Failed to fetch archived products", productsResult.error);
      }
      if (inventoryResult.error) {
        console.error("Failed to fetch inventory", inventoryResult.error);
      }
      setErrorMessage("목록을 불러오지 못했어요.");
      setDataState("error");
      return;
    }

    const stockMap = new Map<string, number>();
    (inventoryResult.data as InventoryRow[] | null | undefined)?.forEach(
      (row) => {
        stockMap.set(row.product_id, row.stock);
      }
    );

    setZones(zonesResult.data ?? []);
    setProducts(productsResult.data ?? []);
    setStockByProductId(stockMap);
    setDataState("ready");
  }, []);

  useEffect(() => {
    if (authState !== "authed") {
      return;
    }

    const loadData = async () => {
      await loadArchived();
    };

    loadData();
  }, [authState, loadArchived]);

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((zone) => {
      map.set(zone.id, zone.name);
    });
    return map;
  }, [zones]);

  const committedQuery = query.trim();
  const tokens = useMemo(
    () => parseSearchTokens(committedQuery),
    [committedQuery]
  );
  const shouldApplyZone = committedQuery.length === 0;
  const activeZone = shouldApplyZone ? selectedZone : null;

  const filteredProducts = useMemo(() => {
    if (products.length === 0) {
      return [];
    }

    return products.filter((product) => {
      const zoneName = product.zone_id
        ? zoneNameById.get(product.zone_id)
        : null;

      if (activeZone && zoneName !== activeZone) {
        return false;
      }

      const haystack = `${product.name} ${product.manufacturer ?? ""}`;
      return tokensMatchText(haystack, tokens);
    });
  }, [activeZone, products, tokens, zoneNameById]);

  const isLoading =
    authState === "checking" ||
    (authState === "authed" && (dataState === "idle" || dataState === "loading"));

  const hasError =
    authState === "error" || (authState === "authed" && dataState === "error");

  const updateSearchParams = useCallback(
    (updates: { zone?: string | null; q?: string }) => {
      if (isComposingRef.current) {
        pendingUpdatesRef.current = {
          ...pendingUpdatesRef.current,
          ...updates,
        };
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());

      if (updates.zone !== undefined) {
        if (updates.zone) {
          nextParams.set("zone", updates.zone);
        } else {
          nextParams.delete("zone");
        }
      }

      if (updates.q !== undefined) {
        if (updates.q) {
          nextParams.set("q", updates.q);
        } else {
          nextParams.delete("q");
        }
      }

      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      router.replace(nextUrl);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (isComposing) {
      return;
    }

    const nextQuery = draftQuery.trim();
    if (nextQuery === committedQuery) {
      return;
    }

    const timeoutId = setTimeout(() => {
      updateSearchParams({ q: nextQuery });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [committedQuery, draftQuery, isComposing, updateSearchParams]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    setIsComposing(true);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    setIsComposing(false);

    const nextValue = event.currentTarget.value;
    setDraftQuery(nextValue);

    const nextQuery = nextValue.trim();
    const pendingUpdates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = null;

    if (!pendingUpdates && nextQuery === committedQuery) {
      return;
    }

    updateSearchParams({ ...(pendingUpdates ?? {}), q: nextQuery });
  };

  const handleZoneClick = (zone: string) => {
    const nextZone = selectedZone === zone ? null : zone;
    updateSearchParams({ zone: nextZone });
  };

  const openRestoreModal = (target: ArchivedProduct) => {
    setRestoreTarget(target);
    setRestoreError(null);
  };

  const closeRestoreModal = () => {
    if (isRestoring) {
      return;
    }
    setRestoreTarget(null);
    setRestoreError(null);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget?.id) {
      setRestoreError("복구에 실패했어요.");
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);

    const { error } = await supabase.rpc("restore_product", {
      p_product_id: restoreTarget.id,
    });

    if (error) {
      console.error("Failed to restore product", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const message = error?.message?.toLowerCase() ?? "";
      if (message.includes("not authenticated")) {
        setRestoreError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else if (message.includes("inactive user")) {
        setRestoreError("권한이 없어요.");
      } else if (message.includes("not archived")) {
        setRestoreError("이미 복구된 상품이에요.");
      } else {
        setRestoreError("복구에 실패했어요.");
      }
      setIsRestoring(false);
      return;
    }

    setRestoreTarget(null);
    setIsRestoring(false);
    await loadArchived();
  };

  const openDeleteModal = (target: ArchivedProduct) => {
    setDeleteTarget(target);
    setDeleteConfirmName("");
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    if (isDeleting) {
      return;
    }
    setDeleteTarget(null);
    setDeleteConfirmName("");
    setDeleteError(null);
  };

  const deleteTargetName = deleteTarget?.name ?? "";
  const isAdmin = profileRole === "admin";
  const isDeleteConfirmMatch =
    deleteTargetName.trim().length > 0 &&
    deleteConfirmName.trim().toLowerCase() ===
    deleteTargetName.trim().toLowerCase();

  const handleDeleteConfirm = async () => {
    if (!isAdmin) {
      setDeleteError("관리자만 삭제할 수 있어요.");
      return;
    }
    if (!deleteTarget?.id) {
      setDeleteError("삭제에 실패했어요.");
      return;
    }
    if (!isDeleteConfirmMatch) {
      setDeleteError("상품명이 일치하지 않아요.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setDeleteError("세션이 만료되었어요. 다시 로그인해 주세요.");
      setIsDeleting(false);
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/admin/products/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          product_id: deleteTarget.id,
          confirm_name: deleteConfirmName.trim(),
        }),
      });
    } catch (error) {
      console.error("Failed to delete product", error);
      setDeleteError("삭제에 실패했어요.");
      setIsDeleting(false);
      return;
    }

    let payload: { ok?: boolean; error?: string } | null = null;
    try {
      payload = (await response.json()) as { ok?: boolean; error?: string };
    } catch (error) {
      console.error("Failed to parse delete response", error);
    }

    if (!response.ok || !payload?.ok) {
      const errorCode = payload?.error ?? "";
      if (response.status === 401 || errorCode === "unauthorized") {
        setDeleteError("세션이 만료되었어요. 다시 로그인해 주세요.");
      } else if (response.status === 403 || errorCode === "forbidden") {
        setDeleteError("관리자만 삭제할 수 있어요.");
      } else if (errorCode === "name_mismatch") {
        setDeleteError("상품명이 일치하지 않아요.");
      } else if (errorCode === "not_archived") {
        setDeleteError("비활성화된 상품만 삭제할 수 있어요.");
      } else if (errorCode === "product_not_found") {
        setDeleteError("상품을 찾을 수 없어요.");
      } else if (
        errorCode === "invalid_photo_path" ||
        errorCode === "storage_delete_failed"
      ) {
        setDeleteError("이미지 삭제에 실패했어요.");
      } else {
        setDeleteError("삭제에 실패했어요.");
      }
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
    setDeleteTarget(null);
    await loadArchived();
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
        ) : (
          <>
            <header style={headerStyle}>
              <div style={headerRowStyle}>
                <Link href={backHref} style={backLinkStyle}>
                  목록으로
                </Link>
                {authState === "authed" ? (
                  <button
                    type="button"
                    style={logoutButtonStyle}
                    onClick={handleLogout}
                  >
                    로그아웃
                  </button>
                ) : null}

              </div>
              <h1 style={titleStyle}>비활성화 상품</h1>
            </header>
            {authState === "authed" && signOutError ? (
              <p style={helperTextStyle}>{signOutError}</p>
            ) : null}


            <div style={chipRowStyle}>
              <button
                type="button"
                style={{
                  ...chipBaseStyle,
                  ...(!selectedZone ? chipActiveStyle : null),
                }}
                onClick={() => updateSearchParams({ zone: null })}
              >
                All
              </button>
              {ZONE_KEYWORDS.map((zone) => {
                const isActive = selectedZone === zone;
                return (
                  <button
                    key={zone}
                    type="button"
                    style={{
                      ...chipBaseStyle,
                      ...(isActive ? chipActiveStyle : null),
                    }}
                    onClick={() => handleZoneClick(zone)}
                  >
                    {zone}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.currentTarget.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="상품명, 제조사 검색"
              aria-label="상품명 또는 제조사 검색"
              style={inputStyle}
            />

            {isLoading ? (
              <SkeletonList />
            ) : hasError ? (
              <div style={cardStyle}>
                <p style={helperTextStyle}>
                  {errorMessage ?? "목록을 불러오지 못했어요."}
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={cardStyle}>
                <p style={helperTextStyle}>비활성화된 상품이 없어요.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredProducts.map((product) => {
                  const zoneName = product.zone_id
                    ? zoneNameById.get(product.zone_id)
                    : null;
                  const manufacturer =
                    product.manufacturer?.trim() || "제조사 미입력";
                  const stock = stockByProductId.get(product.id) ?? 0;
                  const metaLeft = `${manufacturer} · ${zoneName ?? "구역 미지정"
                    }`;
                  return (
                    <div key={product.id} style={cardStyle}>
                      <p style={cardTitleStyle}>{product.name}</p>
                      <div style={cardRowStyle}>
                        <p style={cardRowLeftStyle}>{metaLeft}</p>
                        <p style={cardRowRightStyle}>재고 {stock}</p>
                      </div>
                      <div style={cardActionRowStyle}>
                        <button
                          type="button"
                          style={restoreButtonStyle}
                          onClick={() => openRestoreModal(product)}
                          disabled={isRestoring || isDeleting}
                        >
                          복구
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            style={deleteButtonStyle}
                            onClick={() => openDeleteModal(product)}
                            disabled={isRestoring || isDeleting}
                          >
                            완전삭제
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {restoreTarget ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="restore-title"
            >
              <h2 id="restore-title" style={modalTitleStyle}>
                상품을 복구할까요?
              </h2>
              <p style={helperTextStyle}>
                복구하면 상품이 다시 목록에 표시돼요.
              </p>
              {restoreError ? <p style={helperTextStyle}>{restoreError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeRestoreModal}
                  disabled={isRestoring}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalConfirmStyle}
                  onClick={handleRestoreConfirm}
                  disabled={isRestoring}
                >
                  {isRestoring ? "처리 중..." : "복구"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {deleteTarget ? (
          <div style={modalOverlayStyle}>
            <div
              style={modalCardStyle}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-title"
            >
              <h2 id="delete-title" style={modalTitleStyle}>
                완전삭제 확인
              </h2>
              <p style={helperTextStyle}>삭제하면 복구할 수 없어요.</p>
              <p style={helperTextStyle}>
                상품명 <strong>{deleteTargetName}</strong> 를 입력해 주세요.
              </p>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.currentTarget.value)}
                placeholder="상품명 입력"
                aria-label="상품명 입력"
                style={modalInputStyle}
              />
              {deleteError ? <p style={helperTextStyle}>{deleteError}</p> : null}
              <div style={modalButtonRowStyle}>
                <button
                  type="button"
                  style={modalCancelStyle}
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  style={modalConfirmStyle}
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting || !isDeleteConfirmMatch}
                >
                  {isDeleting ? "처리 중..." : "완전삭제"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
